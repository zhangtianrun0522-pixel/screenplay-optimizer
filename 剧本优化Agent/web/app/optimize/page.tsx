"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import ApiSettingsToolbarButton from "@/components/ApiSettingsToolbarButton";
import { useApiSettings } from "@/components/ApiSettingsProvider";
import OptimizeModulesPanel from "@/components/OptimizeModulesPanel";
import AssetCard from "@/components/AssetCard";
import HighlightedScript from "@/components/HighlightedScript";
import PacingDetailPanel, { type PacingResult } from "@/components/PacingDetailPanel";

interface Episode {
  index: number;
  title: string;
  content: string;
}

type DiagnosticIssueStatus = "open" | "ignored" | "resolved";

interface DiagnosticIssue {
  id: string;
  episode: number;
  type: string;
  description: string;
  suggestion: string;
  fixOptions?: {
    label?: string;
    suggestion?: string;
    text?: string;
    targetEpisode?: number;
    rationale?: string;
    recommended?: boolean;
  }[];
  textSnippet: string;
  severity: "高" | "中" | "低";
  status?: DiagnosticIssueStatus;
}

interface IssueActionOptions {
  selectedSuggestion?: string;
  targetEpisode?: number;
  userCorrection?: string;
}

interface AssetImage {
  imageUrl: string;
  prompt: string;
  generatedAt: string;
}

interface StateKeyframe {
  fromEpisode: number;
  state: string;
  change?: string;
  trigger?: string;
}

interface ProductionUnitRef {
  assetId: string;
  stateEpisode?: number;
  role: string;
}

interface ProductionUnitSourceFragment {
  episode: number;
  label: string;
  text: string;
}

interface ProductionUnit {
  id: string;
  episodeRange: number[];
  sceneName: string;
  tasks: string[];
  note: string;
  refs: ProductionUnitRef[];
  basis: string[];
  owner: string;
  scriptExcerpt: string;
  consistencyLocks: string[];
  prompt?: string;
  fullScript?: string;
  sourceFragments?: ProductionUnitSourceFragment[];
  coverageNote?: string;
  editStatus?: "系统识别" | "人工校正中" | "人工已确认";
}

interface Character {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  emotionTags: string[];
  appearsIn: number[];
  referenceImages: AssetImage[];
  stateTimeline: StateKeyframe[];
  linkedTo: string[];
}

interface Scene {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  appearsIn: number[];
  referenceImages: AssetImage[];
  stateTimeline: StateKeyframe[];
  linkedTo: string[];
}

interface Prop {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  appearsIn: number[];
  referenceImages: AssetImage[];
  stateTimeline: StateKeyframe[];
  linkedTo: string[];
}

interface Assets {
  characters: Character[];
  scenes: Scene[];
  props: Prop[];
  productionUnits: ProductionUnit[];
}

const interactionTestEpisodes: Episode[] = [
  {
    index: 1,
    title: "第1集 身份错位",
    content: "【林家客厅】林晚站在家族照片墙前，米白针织衫显得格外安静。顾承川带着银色戒指出现，林母要求她立刻离开林家。戒指被放在茶几上的首饰盒里，所有人的目光都落在林晚身上。",
  },
  {
    index: 3,
    title: "第3集 证据藏入",
    content: "【林家书房】夜深，林家书房只亮着一盏台灯。深木书桌被拉开，暗格露出。黑色录音笔被放入暗格，红色指示灯关闭。书桌被推回原位，房间恢复安静。",
  },
  {
    index: 7,
    title: "第7集 停车场反转",
    content: "【地下停车场】冷色灯管闪烁，顾承川黑色大衣领口微乱。争执中银色戒指从他掌心滑落，录音笔被摔裂却仍在播放。林晚听见真相后冲向雨夜，顾承川捡起戒指追出去。",
  },
  {
    index: 8,
    title: "第8集 雨夜确认",
    content: "【雨夜天台】林晚推开铁门冲上天台，黑色风衣被雨水打透。顾承川把银色戒指递到她面前，脸侧仍有擦伤。两人在栏杆边对峙，林晚看清戒指内圈刻字后重新戴上戒指。",
  },
];

const interactionTestAssets: Assets = {
  characters: [
    {
      id: "test-lin-wan",
      name: "林晚",
      aliases: ["晚晚", "林小姐", "假千金"],
      description: "女主，外柔内韧，围绕身世反转和情感误会推动主线。",
      emotionTags: ["克制", "倔强", "受伤"],
      appearsIn: [1, 7, 8],
      referenceImages: [],
      linkedTo: ["顾承川", "银色戒指"],
      stateTimeline: [
        { fromEpisode: 1, state: "米白针织衫，淡妆，长发自然垂落，站在林家客厅照片墙前。", change: "初始造型", trigger: "首次登场" },
        { fromEpisode: 8, state: "黑色风衣被雨水打湿，发丝贴脸，眼妆轻微晕开。", change: "雨夜决裂", trigger: "天台对峙" },
      ],
    },
    {
      id: "test-gu-chengchuan",
      name: "顾承川",
      aliases: ["顾总", "承川"],
      description: "男主，集团继承人，前期冷硬克制，后期主动追查真相。",
      emotionTags: ["冷硬", "保护", "追查"],
      appearsIn: [1, 7, 8],
      referenceImages: [],
      linkedTo: ["林晚", "银色戒指"],
      stateTimeline: [
        { fromEpisode: 1, state: "深灰西装，白衬衫，无领带，腕表明显。", change: "初始造型", trigger: "林家客厅出现" },
        { fromEpisode: 7, state: "黑色大衣，领口微乱，脸侧有轻微擦伤。", change: "冲突后", trigger: "停车场争执" },
      ],
    },
  ],
  scenes: [
    {
      id: "test-lin-house",
      name: "林家老宅",
      aliases: ["林家", "林家客厅", "林家书房"],
      description: "女主成长空间，家族秘密与身份揭露的核心场景。",
      appearsIn: [1, 3],
      referenceImages: [],
      linkedTo: ["录音笔"],
      stateTimeline: [
        { fromEpisode: 1, state: "老钱风客厅，暖色壁灯，家族照片墙，茶几上有首饰盒。", change: "客厅基准", trigger: "身份错位" },
        { fromEpisode: 3, state: "深木书房，书桌暗格开启，台灯照亮桌面。", change: "书房暗格", trigger: "藏入证据" },
      ],
    },
    {
      id: "test-parking",
      name: "地下停车场",
      aliases: ["停车场", "地下车库"],
      description: "第七集反转场，戒指和录音笔状态发生关键变化。",
      appearsIn: [7],
      referenceImages: [],
      linkedTo: ["银色戒指", "录音笔"],
      stateTimeline: [
        { fromEpisode: 7, state: "冷色灯管闪烁，地面潮湿，车辆阴影切割空间。", change: "夜晚追赶后", trigger: "反转冲突" },
      ],
    },
    {
      id: "test-rooftop",
      name: "雨夜天台",
      aliases: ["天台", "楼顶", "雨夜楼顶"],
      description: "第八集情绪爆点场景，承担对峙、告白和真相确认。",
      appearsIn: [8],
      referenceImages: [],
      linkedTo: ["林晚", "顾承川"],
      stateTimeline: [
        { fromEpisode: 8, state: "城市高楼天台，夜雨，霓虹反光，金属栏杆湿亮。", change: "单场核心状态", trigger: "最终对峙" },
      ],
    },
  ],
  props: [
    {
      id: "test-ring",
      name: "银色戒指",
      aliases: ["戒指", "订婚戒", "旧戒指"],
      description: "女主身世线索之一，也是男女主误会与和解的信物。",
      appearsIn: [1, 7, 8],
      referenceImages: [],
      linkedTo: ["林晚", "顾承川"],
      stateTimeline: [
        { fromEpisode: 1, state: "戒指在首饰盒里，内圈刻字暂未露出。", change: "首次出现", trigger: "林家客厅" },
        { fromEpisode: 7, state: "戒指从男主掌心滑落，表面沾有雨水。", change: "转移到男主手中", trigger: "停车场争执" },
        { fromEpisode: 8, state: "戒指被女主重新戴上，雨水顺着指节流下。", change: "关系确认", trigger: "天台和解" },
      ],
    },
    {
      id: "test-recorder",
      name: "录音笔",
      aliases: ["录音器", "黑色录音笔"],
      description: "反派交易证据，道具流转决定第七集反转是否成立。",
      appearsIn: [3, 7],
      referenceImages: [],
      linkedTo: ["林家老宅"],
      stateTimeline: [
        { fromEpisode: 3, state: "录音笔藏在书桌暗格内，指示灯关闭。", change: "藏匿状态", trigger: "林家书房藏入" },
        { fromEpisode: 7, state: "录音笔被摔在地上，外壳裂开但还能播放。", change: "损坏后", trigger: "停车场反转" },
      ],
    },
  ],
  productionUnits: [
    normalizeProductionUnit({
      id: "test-unit-rooftop",
      episodeRange: [8],
      sceneName: "雨夜天台",
      tasks: ["剧照生成", "连续性检查"],
      note: "最终确认关系的情绪爆点，生成时必须锁定女主湿发黑风衣和戒指重新戴上的状态。",
      refs: [
        { assetId: "test-lin-wan", stateEpisode: 8, role: "女主雨夜决裂状态" },
        { assetId: "test-gu-chengchuan", stateEpisode: 7, role: "男主冲突后状态" },
        { assetId: "test-rooftop", stateEpisode: 8, role: "对峙场景" },
        { assetId: "test-ring", stateEpisode: 8, role: "和解信物" },
      ],
      basis: ["同一地点：雨夜天台", "同一时间：夜雨", "同一动作段落：最终对峙与和解"],
      owner: "A组 · 情绪主场",
      scriptExcerpt: "林晚冲上天台，雨水打湿黑色风衣。顾承川追上来，把戒指递到她面前。两人在栏杆边对峙，林晚终于确认戒指内圈的刻字。",
      consistencyLocks: ["夜雨强度", "天台栏杆位置", "林晚黑色湿风衣", "顾承川脸侧擦伤", "戒指重新戴上"],
      prompt: "雨夜城市天台，林晚黑色湿风衣、顾承川黑色大衣脸侧擦伤，银色戒指在女主指间。",
      fullScript: "【雨夜天台】\n林晚推开铁门冲上天台，黑色风衣被雨水打透。顾承川把银色戒指递到她面前，脸侧仍有擦伤。两人在栏杆边对峙，林晚看清戒指内圈刻字后重新戴上戒指。",
      sourceFragments: [
        { episode: 7, label: "前序钩子状态", text: "停车场里，戒指滑落，录音笔摔裂仍在播放。林晚冲向雨夜，顾承川追出去。" },
        { episode: 8, label: "本场完整戏", text: "林晚推开铁门冲上天台，顾承川把银色戒指递到她面前。两人在栏杆边对峙。" },
      ],
      coverageNote: "承接 E7 道具状态，但不把停车场动作并入本场；E8 天台对峙到关系确认必须完整覆盖。",
      editStatus: "系统识别",
    }),
    normalizeProductionUnit({
      id: "test-unit-parking",
      episodeRange: [7],
      sceneName: "地下停车场",
      tasks: ["连续性检查", "分镜生成"],
      note: "戒指和录音笔在停车场发生状态变化，后续天台戏只引用这些状态。",
      refs: [
        { assetId: "test-gu-chengchuan", stateEpisode: 7, role: "临时持有人" },
        { assetId: "test-parking", stateEpisode: 7, role: "停车场基准" },
        { assetId: "test-ring", stateEpisode: 7, role: "滑落道具" },
        { assetId: "test-recorder", stateEpisode: 7, role: "损坏证据" },
      ],
      basis: ["同一地点：地下停车场", "同一时间：夜晚追赶后", "同一动作段落：戒指滑落与录音笔摔裂"],
      owner: "B组 · 动作衔接",
      scriptExcerpt: "地下停车场里，顾承川捡起戒指，录音笔被摔裂仍在播放。林晚转身冲向雨夜，顾承川追出去。",
      consistencyLocks: ["停车场冷色灯", "戒指沾雨水", "录音笔破裂", "顾承川黑色大衣", "追赶动作方向"],
      fullScript: "【地下停车场】\n冷色灯管闪烁，顾承川黑色大衣领口微乱。争执中银色戒指从他掌心滑落，录音笔被摔裂却仍在播放。林晚听见真相后冲向雨夜，顾承川捡起戒指追出去。",
      sourceFragments: [
        { episode: 7, label: "本场完整戏", text: "争执中银色戒指从他掌心滑落，录音笔被摔裂却仍在播放。" },
        { episode: 8, label: "后续引用", text: "顾承川把银色戒指递到她面前，天台戏引用停车场状态。" },
      ],
      coverageNote: "本单元只覆盖停车场内的动作与道具变化；追出后的天台对峙拆到独立制作单元。",
      editStatus: "系统识别",
    }),
    normalizeProductionUnit({
      id: "test-unit-study-hide",
      episodeRange: [3],
      sceneName: "林家书房 · 藏匿",
      tasks: ["道具特写", "连续性检查"],
      note: "录音笔藏匿位置需要和后续发现动作一致，适合生成道具特写和场景参考。",
      refs: [
        { assetId: "test-lin-house", stateEpisode: 3, role: "书房空间" },
        { assetId: "test-recorder", stateEpisode: 3, role: "藏匿证据" },
      ],
      basis: ["同一地点：林家书房", "同一时间：藏匿当晚", "同一动作段落：录音笔放入暗格"],
      owner: "C组 · 证据道具",
      scriptExcerpt: "第3集，录音笔被藏进林家书房暗格，书桌被重新推回原位，房间恢复安静。",
      consistencyLocks: ["书桌暗格位置", "深木书房", "录音笔红灯关闭", "藏匿动作方向"],
      fullScript: "【林家书房 · 藏匿】\n夜深，林家书房只亮着一盏台灯。深木书桌被拉开，暗格露出。黑色录音笔被放入暗格，红色指示灯关闭。",
      sourceFragments: [
        { episode: 3, label: "本场完整戏", text: "黑色录音笔被放入暗格，红色指示灯关闭。书桌被推回原位，房间恢复安静。" },
      ],
      coverageNote: "E3 藏匿和后续发现是同一空间基准下的不同动作段落，不能合并成一个制作单元。",
      editStatus: "系统识别",
    }),
  ],
};

type Asset = Character | Scene | Prop;
type AssetTab = "combos" | "characters" | "scenes" | "props";
type WorkspaceView = "script" | "assetLibrary";
type AssetUpdateValue = string | string[] | number[] | StateKeyframe[];
type RelationFilter = "all" | "characters" | "scenes" | "props";

function episodeLabel(values: number[]) {
  return values.map((value) => `E${value}`).join(" ");
}

function parseEpisodeLabel(value: string): number[] {
  return value
    .split(/[\s,，/]+/)
    .map((item) => item.replace(/^E/i, ""))
    .map((item) => Number.parseInt(item, 10))
    .filter((episode) => Number.isFinite(episode) && episode > 0);
}

function stateAtEpisode(timeline: StateKeyframe[], episode: number) {
  return timeline.reduce<StateKeyframe | undefined>((current, point) => {
    if (point.fromEpisode <= episode && (!current || point.fromEpisode >= current.fromEpisode)) return point;
    return current;
  }, undefined);
}

function pointMatchesEpisode(point: StateKeyframe, episode: number) {
  return point.fromEpisode === episode;
}

function contiguousEpisodeGroups(values: number[]): number[][] {
  const sorted = Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const episode of sorted) {
    const current = groups[groups.length - 1];
    if (!current || episode !== current[current.length - 1] + 1) {
      groups.push([episode]);
    } else {
      current.push(episode);
    }
  }
  return groups;
}

function allAssets(input: Pick<Assets, "characters" | "scenes" | "props">): Asset[] {
  return [...input.characters, ...input.scenes, ...input.props];
}

function assetTypeOf(asset: Asset | null, assets: Pick<Assets, "characters" | "scenes" | "props">): "character" | "scene" | "prop" | null {
  if (!asset) return null;
  if (assets.characters.some((item) => item.id === asset.id)) return "character";
  if (assets.scenes.some((item) => item.id === asset.id)) return "scene";
  if (assets.props.some((item) => item.id === asset.id)) return "prop";
  return null;
}

function assetTypeLabel(type: "character" | "scene" | "prop" | null) {
  if (type === "character") return "角色";
  if (type === "scene") return "场景";
  if (type === "prop") return "道具";
  return "资产";
}

function assetTabFromType(type: "character" | "scene" | "prop" | null): Exclude<AssetTab, "combos"> | null {
  if (type === "character") return "characters";
  if (type === "scene") return "scenes";
  if (type === "prop") return "props";
  return null;
}

function relationFilterLabel(filter: RelationFilter) {
  if (filter === "all") return "全部";
  if (filter === "characters") return "角色";
  if (filter === "scenes") return "场景";
  return "道具";
}

function findAssetById(assets: Pick<Assets, "characters" | "scenes" | "props">, id: string): Asset | null {
  return allAssets(assets).find((asset) => asset.id === id) ?? null;
}

function assetIdentityKeys(asset: Pick<Asset, "name" | "aliases">) {
  return [asset.name, ...asset.aliases].map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function mergeAssetList<T extends Asset>(previous: T[], incoming: T[]): T[] {
  return incoming.map((asset) => {
    const keys = new Set(assetIdentityKeys(asset));
    const existing = previous.find((item) => assetIdentityKeys(item).some((key) => keys.has(key)));
    if (!existing) return asset;
    return {
      ...asset,
      id: existing.id,
      referenceImages: existing.referenceImages.length > 0 ? existing.referenceImages : asset.referenceImages,
      linkedTo: existing.linkedTo.length > 0 ? existing.linkedTo : asset.linkedTo,
    };
  });
}

function mergeExtractedAssets(previous: Assets | null, incoming: Assets): Assets {
  if (!previous) return incoming;

  const characters = mergeAssetList(previous.characters, incoming.characters);
  const scenes = mergeAssetList(previous.scenes, incoming.scenes);
  const props = mergeAssetList(previous.props, incoming.props);
  const incomingIdToMergedId = new Map<string, string>();

  const collectIdMap = <T extends Asset>(incomingList: T[], mergedList: T[]) => {
    incomingList.forEach((asset, index) => {
      const merged = mergedList[index];
      if (merged) incomingIdToMergedId.set(asset.id, merged.id);
    });
  };

  collectIdMap(incoming.characters, characters);
  collectIdMap(incoming.scenes, scenes);
  collectIdMap(incoming.props, props);

  for (const asset of [...characters, ...scenes, ...props]) {
    for (const key of assetIdentityKeys(asset)) incomingIdToMergedId.set(key, asset.id);
  }

  const remapRef = (ref: ProductionUnitRef): ProductionUnitRef => {
    const matchedId = incomingIdToMergedId.get(ref.assetId);
    return matchedId ? { ...ref, assetId: matchedId } : ref;
  };

  return {
    characters,
    scenes,
    props,
    productionUnits: incoming.productionUnits.map((unit) => ({
      ...unit,
      refs: unit.refs.map(remapRef),
    })),
  };
}

function scriptVersionKey(episodes: Episode[]) {
  return episodes.map((episode) => `${episode.index}:${episode.content.length}:${episode.content.slice(0, 32)}:${episode.content.slice(-32)}`).join("|");
}

function assetInitials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "?";
}

function stateLabel(point?: StateKeyframe) {
  if (!point) return "未指定状态";
  return `E${point.fromEpisode}${point.change ? ` · ${point.change}` : ""}`;
}

function stateKey(assetId: string, point: StateKeyframe, index: number) {
  return `${assetId}:${point.fromEpisode}:${index}`;
}

function sourceFragmentKey(fragment: ProductionUnitSourceFragment) {
  return `${fragment.episode}:${fragment.text.replace(/\s+/g, "")}`;
}

function normalizedSourceText(fragment: ProductionUnitSourceFragment) {
  return fragment.text.replace(/[，。！？、,.!?\s]/g, "");
}

function sourceFragmentSimilarity(a: ProductionUnitSourceFragment, b: ProductionUnitSourceFragment) {
  if (a.episode !== b.episode) return 0;
  const left = normalizedSourceText(a);
  const right = normalizedSourceText(b);
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) return 1;
  const leftChars = new Set(Array.from(left));
  const rightChars = new Set(Array.from(right));
  let shared = 0;
  for (const char of leftChars) {
    if (rightChars.has(char)) shared += 1;
  }
  return shared / Math.min(leftChars.size, rightChars.size);
}

function uniqueSourceFragments(fragments: ProductionUnitSourceFragment[]) {
  const seen = new Set<string>();
  const result: ProductionUnitSourceFragment[] = [];
  for (const fragment of fragments) {
    const key = sourceFragmentKey(fragment);
    if (seen.has(key)) continue;
    const similarIndex = result.findIndex((existing) => sourceFragmentSimilarity(existing, fragment) >= 0.82);
    if (similarIndex >= 0) {
      if (fragment.label.includes("本场") || fragment.label.includes("系统")) {
        result[similarIndex] = fragment;
      }
      seen.add(key);
      continue;
    }
    seen.add(key);
    result.push(fragment);
  }
  return result;
}

function sourceScriptFromFragments(fragments: ProductionUnitSourceFragment[]) {
  return fragments.map((fragment) => `【E${fragment.episode} · ${fragment.label}】\n${fragment.text}`).join("\n\n");
}

function normalizeProductionUnit(unit: ProductionUnit): ProductionUnit {
  const sourceFragments = Array.isArray(unit.sourceFragments) ? unit.sourceFragments : [];
  const fallbackFullScript = sourceFragments.length > 0
    ? sourceFragments.map((fragment) => fragment.text).join("\n\n")
    : unit.scriptExcerpt;
  return {
    ...unit,
    prompt: unit.prompt ?? "",
    fullScript: unit.fullScript ?? fallbackFullScript,
    sourceFragments,
    coverageNote: unit.coverageNote ?? "按制作连续戏份覆盖；跨集因果作为状态引用，不自动合并进同一制作单元。",
    editStatus: unit.editStatus ?? "系统识别",
  };
}

function deriveProductionUnits(input: Pick<Assets, "characters" | "scenes" | "props">): ProductionUnit[] {
  type DerivedProductionUnit = ProductionUnit & { sourceOrder: number };
  return input.scenes.flatMap<DerivedProductionUnit>((scene, sceneIndex) => {
    const episodes = scene.appearsIn.length > 0 ? scene.appearsIn : [scene.stateTimeline[0]?.fromEpisode ?? 1];
    return contiguousEpisodeGroups(episodes).map((episodeRange) => {
      const firstEpisode = episodeRange[0] ?? 1;
      const sceneState = stateAtEpisode(scene.stateTimeline, firstEpisode) ?? scene.stateTimeline[0];
      const inRange = (asset: Asset) => asset.appearsIn.some((episode) => episodeRange.includes(episode));
      const refs: ProductionUnitRef[] = [
        { assetId: scene.id, stateEpisode: sceneState?.fromEpisode ?? firstEpisode, role: "场景基准" },
        ...input.characters
          .filter(inRange)
          .slice(0, 3)
          .map((asset) => ({
            assetId: asset.id,
            stateEpisode: stateAtEpisode(asset.stateTimeline, firstEpisode)?.fromEpisode ?? firstEpisode,
            role: "同场角色",
          })),
        ...input.props
          .filter(inRange)
          .slice(0, 2)
          .map((asset) => ({
            assetId: asset.id,
            stateEpisode: stateAtEpisode(asset.stateTimeline, firstEpisode)?.fromEpisode ?? firstEpisode,
            role: "同场道具",
          })),
      ];
      return {
        id: `unit-${scene.id}-${episodeRange.join("-")}`,
        episodeRange,
        sceneName: scene.name,
        tasks: ["连续性检查", "剧照生成"],
        note: scene.description || "从连续场景资产自动生成的制作单元，可人工调整。",
        refs,
        basis: [`同一地点：${scene.name}`, `连续集段：${episodeLabel(episodeRange)}`],
        owner: "未分配",
        scriptExcerpt: sceneState?.trigger || scene.description || "待从剧本段落确认完整剧情。",
        consistencyLocks: [sceneState?.state, scene.description].filter(Boolean).slice(0, 3) as string[],
        prompt: "",
        fullScript: sceneState?.trigger || scene.description || "",
        sourceFragments: [],
        coverageNote: "从场景资产自动生成的制作单元，需要人工核对原始剧本段落是否完整覆盖。",
        editStatus: "系统识别",
        sourceOrder: sceneIndex,
      };
    });
  })
    .sort((a, b) => {
      const aEpisode = a.episodeRange[0] ?? Number.MAX_SAFE_INTEGER;
      const bEpisode = b.episodeRange[0] ?? Number.MAX_SAFE_INTEGER;
      if (aEpisode !== bEpisode) return aEpisode - bEpisode;
      return a.sourceOrder - b.sourceOrder;
    })
    .map((unit) => {
      const next: ProductionUnit = {
        id: unit.id,
        episodeRange: unit.episodeRange,
        sceneName: unit.sceneName,
        tasks: unit.tasks,
        note: unit.note,
        refs: unit.refs,
        basis: unit.basis,
        owner: unit.owner,
        scriptExcerpt: unit.scriptExcerpt,
        consistencyLocks: unit.consistencyLocks,
        prompt: unit.prompt,
        fullScript: unit.fullScript,
        sourceFragments: unit.sourceFragments,
        coverageNote: unit.coverageNote,
        editStatus: unit.editStatus,
      };
      return next;
    });
}

export default function OptimizePage() {
  const { settings, openSettings } = useApiSettings();

  const [phase, setPhase] = useState<"upload" | "workspace">("upload");
  const [rawText, setRawText] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisode, setActiveEpisode] = useState(0);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [assetTab, setAssetTab] = useState<AssetTab>("combos");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("script");
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedProductionUnitId, setSelectedProductionUnitId] = useState<string | null>(null);
  const [draggingProductionUnitId, setDraggingProductionUnitId] = useState<string | null>(null);
  const [dragOverProductionUnitId, setDragOverProductionUnitId] = useState<string | null>(null);
  const [contextEpisodeNumber, setContextEpisodeNumber] = useState(1);
  const [selectedProductionUnitAssetId, setSelectedProductionUnitAssetId] = useState<string | null>(null);
  const [expandedProductionUnitId, setExpandedProductionUnitId] = useState<string | null>(null);
  const [productionUnitSourcePickerId, setProductionUnitSourcePickerId] = useState<string | null>(null);
  const [selectedSourceFragmentKeys, setSelectedSourceFragmentKeys] = useState<Record<string, string[]>>({});
  const [assetRefPickerUnitId, setAssetRefPickerUnitId] = useState<string | null>(null);
  const [selectedAssetStateKey, setSelectedAssetStateKey] = useState<string | null>(null);
  const [selectedBoundSceneId, setSelectedBoundSceneId] = useState<string | null>(null);
  const [stateBindPickerKey, setStateBindPickerKey] = useState<string | null>(null);
  const [relationFilter, setRelationFilter] = useState<RelationFilter>("all");
  const [splitting, setSplitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [modulesCompleted, setModulesCompleted] = useState(false);
  const [finalScriptReady, setFinalScriptReady] = useState(false);
  const [splitError, setSplitError] = useState("");
  const [assetWarnings, setAssetWarnings] = useState<string[]>([]);
  const [assetScriptVersion, setAssetScriptVersion] = useState<string | null>(null);
  const [diagnosticIssues, setDiagnosticIssues] = useState<DiagnosticIssue[]>([]);
  const [pacingBeatFocusIssue, setPacingBeatFocusIssue] = useState<DiagnosticIssue | null>(null);
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null);
  const [rewritingIssueId, setRewritingIssueId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showPacingDetail, setShowPacingDetail] = useState(false);
  const [pacingDetailResult, setPacingDetailResult] = useState<PacingResult | null>(null);
  const [adoptedPacingIssues, setAdoptedPacingIssues] = useState<DiagnosticIssue[]>([]);
  const [pacingContentSnapshot, setPacingContentSnapshot] = useState<Record<number, string>>({});
  const [scriptEditMode, setScriptEditMode] = useState(false);
  const [reanalyzingPacingEpisode, setReanalyzingPacingEpisode] = useState(false);
  const [pacingEpisodeUpdate, setPacingEpisodeUpdate] = useState<{ episode: number; beats: unknown[]; issues: unknown[] } | null>(null);

  const episodeRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { setScriptEditMode(false); }, [activeEpisode]);

  const selectedAsset = assets
    ? [...assets.characters, ...assets.scenes, ...assets.props].find((asset) => asset.id === selectedAssetId) ?? null
    : null;
  const selectedAssetType: "character" | "scene" | "prop" | null = selectedAsset && assets
    ? assets.characters.some((asset) => asset.id === selectedAsset.id)
      ? "character"
      : assets.scenes.some((asset) => asset.id === selectedAsset.id)
        ? "scene"
        : "prop"
    : null;
  const activeLibraryAssets = assets
    ? assetTab === "characters"
      ? assets.characters
      : assetTab === "scenes"
        ? assets.scenes
        : assetTab === "props"
          ? assets.props
          : []
    : [];
  const selectedProductionUnit = assets
    ? assets.productionUnits.find((unit) => unit.id === selectedProductionUnitId) ?? assets.productionUnits[0] ?? null
    : null;
  const productionUnitContextEpisodeNumbers = useMemo(
    () => new Set(
      selectedProductionUnit
        ? selectedProductionUnit.episodeRange.flatMap((episode) => [episode - 1, episode, episode + 1]).filter((episode) => episode > 0)
        : [],
    ),
    [selectedProductionUnit],
  );
  const productionUnitContextFragments = useMemo(
    () => selectedProductionUnit
      ? uniqueSourceFragments([
          ...episodes
            .filter((episode) => productionUnitContextEpisodeNumbers.has(episode.index))
            .map((episode) => ({
              episode: episode.index,
              label: episode.title || "相邻集片段",
              text: episode.content,
            })),
          ...(selectedProductionUnit.sourceFragments ?? []),
        ])
      : [],
    [episodes, productionUnitContextEpisodeNumbers, selectedProductionUnit],
  );
  const defaultSourceFragmentKeys = useMemo(
    () => selectedProductionUnit
      ? (selectedProductionUnit.sourceFragments ?? []).map((fragment) => sourceFragmentKey(fragment))
      : [],
    [selectedProductionUnit],
  );
  const activeSourceFragmentKeys = selectedProductionUnit
    ? selectedSourceFragmentKeys[selectedProductionUnit.id] ?? defaultSourceFragmentKeys
    : [];
  const activeSourceFragments = productionUnitContextFragments.filter((fragment) =>
    activeSourceFragmentKeys.includes(sourceFragmentKey(fragment)),
  );
  const productionUnitContextEpisodeLabel = Array.from(productionUnitContextEpisodeNumbers)
    .sort((a, b) => a - b)
    .map((episode) => `E${episode}`)
    .join(" / ");
  const selectedProductionUnitAsset = assets && selectedProductionUnit
    ? findAssetById(assets, selectedProductionUnitAssetId ?? selectedProductionUnit.refs[0]?.assetId ?? "")
    : null;
  const selectedProductionUnitAssetType = assets ? assetTypeOf(selectedProductionUnitAsset, assets) : null;
  const selectedProductionUnitRef = selectedProductionUnit && selectedProductionUnitAsset
    ? selectedProductionUnit.refs.find((ref) => ref.assetId === selectedProductionUnitAsset.id) ?? null
    : null;
  const selectedProductionUnitState = selectedProductionUnitAsset
    ? selectedProductionUnitAsset.stateTimeline.find((point) => point.fromEpisode === selectedProductionUnitRef?.stateEpisode) ??
      stateAtEpisode(selectedProductionUnitAsset.stateTimeline, selectedProductionUnit?.episodeRange[0] ?? selectedProductionUnitAsset.appearsIn[0] ?? 1) ??
      selectedProductionUnitAsset.stateTimeline[0]
    : undefined;
  const selectedAssetStateEntry = selectedAsset
    ? selectedAsset.stateTimeline
        .map((point, index) => ({ point, index, key: stateKey(selectedAsset.id, point, index) }))
        .find((entry) => entry.key === selectedAssetStateKey) ??
      selectedAsset.stateTimeline
        .map((point, index) => ({ point, index, key: stateKey(selectedAsset.id, point, index) }))
        .find((entry) => pointMatchesEpisode(entry.point, contextEpisodeNumber)) ??
      selectedAsset.stateTimeline.map((point, index) => ({ point, index, key: stateKey(selectedAsset.id, point, index) }))[0] ??
      null
    : null;
  const selectedAssetState = selectedAssetStateEntry?.point;
  const assetBoundScenes = assets && selectedAsset
    ? assets.productionUnits.filter((unit) =>
        unit.refs.some((ref) =>
          ref.assetId === selectedAsset.id &&
          (!selectedAssetState || ref.stateEpisode === selectedAssetState.fromEpisode || unit.episodeRange.includes(selectedAssetState.fromEpisode))
        )
      )
    : [];
  const selectedBoundScene = assetBoundScenes.find((unit) => unit.id === selectedBoundSceneId) ?? assetBoundScenes[0] ?? null;
  const selectedBoundSceneIndex = selectedBoundScene ? assetBoundScenes.findIndex((unit) => unit.id === selectedBoundScene.id) : -1;
  const selectedBoundSceneRefs = assets && selectedBoundScene
    ? selectedBoundScene.refs
        .map((ref) => {
          const asset = findAssetById(assets, ref.assetId);
          const type = assetTypeOf(asset, assets);
          return { ref, asset, type };
        })
        .filter((item) => item.asset)
    : [];
  const relatedAssets = assets && selectedAsset
    ? selectedBoundSceneRefs.filter((item) => {
        if (!item.asset || item.asset.id === selectedAsset.id) return false;
        if (relationFilter === "all") return true;
        const tab = assetTabFromType(item.type);
        return tab === relationFilter;
      })
    : [];
  const pickerAssetGroups = assets
    ? ([
        ["characters", "角色", assets.characters],
        ["scenes", "场景", assets.scenes],
        ["props", "道具", assets.props],
      ] as const)
    : [];
  const currentScriptVersion = useMemo(() => scriptVersionKey(episodes), [episodes]);
  const assetsNeedRefresh = Boolean(assets && assetScriptVersion && assetScriptVersion !== currentScriptVersion);
  const issueStatuses = useMemo(() => {
    return Object.fromEntries(diagnosticIssues.map((issue) => [issue.id, issue.status ?? "open"])) as Record<string, DiagnosticIssueStatus>;
  }, [diagnosticIssues]);
  const activeEpisodeIsStaleForPacing = useMemo(() => {
    const ep = episodes[activeEpisode];
    if (!ep || !pacingDetailResult) return false;
    return ep.content !== (pacingContentSnapshot[ep.index] ?? null);
  }, [episodes, activeEpisode, pacingDetailResult, pacingContentSnapshot]);
  const activeEpisodeIssues = episodes[activeEpisode]
    ? [
        ...diagnosticIssues,
        ...(pacingBeatFocusIssue ? [pacingBeatFocusIssue] : []),
      ].filter((issue) => issue.episode === episodes[activeEpisode].index && (issue.status ?? "open") === "open")
    : [];
  const showHighlightedScript = Boolean(finalScriptReady || assets || activeEpisodeIssues.length > 0);

  const handleFileUpload = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    setSplitError("");

    if (ext === "txt") {
      setRawText(await file.text());
    } else if (ext === "docx") {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/parse-docx", { method: "POST", body: fd });
        const data = (await res.json()) as { text?: string };
        setRawText(data.text ?? "");
      } catch {
        setSplitError("解析 docx 文件失败");
      }
    } else if (ext === "pdf") {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/parse-pdf", { method: "POST", body: fd });
        const data = (await res.json()) as { text?: string };
        setRawText(data.text ?? "");
      } catch {
        setSplitError("解析 pdf 文件失败");
      }
    }
  }, []);

  const handleSplit = useCallback(async () => {
    if (!rawText.trim()) return;

    setSplitting(true);
    setSplitError("");

    try {
      const res = await fetch("/api/optimize/split-episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, settings }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `请求失败 (${res.status})`);
      }

      const data = (await res.json()) as {
        episodes?: { index?: number; title?: string; content?: string }[];
      };

      const eps: Episode[] = (data.episodes ?? []).map((ep, i) => ({
        index: ep.index ?? i + 1,
        title: ep.title ?? `第${i + 1}集`,
        content: ep.content ?? "",
      }));

      if (eps.length === 0) throw new Error("未能拆分出任何集，请检查剧本格式");

      setEpisodes(eps);
      setActiveEpisode(0);
      setAssets(null);
      setAssetWarnings([]);
      setAssetScriptVersion(null);
      setDiagnosticIssues([]);
      setPacingBeatFocusIssue(null);
      setFocusedIssueId(null);
      setModulesCompleted(false);
      setFinalScriptReady(false);
      setHoveredAssetId(null);
      setSelectedAssetId(null);
      setContextEpisodeNumber(eps[0]?.index ?? 1);
      setPhase("workspace");
    } catch (e) {
      setSplitError(e instanceof Error ? e.message : "拆集失败");
    } finally {
      setSplitting(false);
    }
  }, [rawText, settings]);

  const handleExtractAssets = useCallback(async () => {
    if (episodes.length === 0) return;

    setExtracting(true);
    setAssetWarnings([]);

    try {
      const res = await fetch("/api/optimize/extract-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodes, settings }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `请求失败 (${res.status})`);
      }

      const data = (await res.json()) as Assets & { warnings?: string[] };
      const baseAssets = {
        characters: data.characters ?? [],
        scenes: data.scenes ?? [],
        props: data.props ?? [],
      };
      const productionUnits = Array.isArray(data.productionUnits) && data.productionUnits.length > 0
        ? data.productionUnits.map(normalizeProductionUnit)
        : deriveProductionUnits(baseAssets);

      const nextAssets = {
        ...baseAssets,
        productionUnits,
      };
      setAssets((previous) => mergeExtractedAssets(previous, nextAssets));
      setAssetScriptVersion(currentScriptVersion);
      setAssetTab("combos");
      setSelectedProductionUnitId(productionUnits[0]?.id ?? null);
      setSelectedProductionUnitAssetId(productionUnits[0]?.refs[0]?.assetId ?? null);
      setExpandedProductionUnitId(productionUnits[0]?.id ?? null);
      setAssetWarnings([
        ...(Array.isArray(data.warnings) ? data.warnings : []),
        assets ? "已根据当前剧本刷新资产；同名资产会保留原 ID 与参考图，场面组合已按新剧本重建。" : "已根据当前剧本提取资产。",
      ]);
      if (!assets) setWorkspaceView("assetLibrary");
    } catch (e) {
      const message = e instanceof Error ? e.message : "提取资产失败";
      alert(`${message}\n\n请检查 API 设置里的模型名和 Key 是否被当前服务商支持。`);
      openSettings();
    } finally {
      setExtracting(false);
    }
  }, [episodes, settings, openSettings, currentScriptVersion, assets]);

  const handleFinalEpisodesReady = useCallback((nextEpisodes: Episode[]) => {
    setEpisodes(nextEpisodes);
    setActiveEpisode(0);
    setAssetWarnings([assets ? "已采用优化后的剧本；资产和场面组合需要基于当前版本刷新。" : "已采用优化后的剧本；可以基于当前版本提取资产。"]);
    setFinalScriptReady(true);
    setWorkspaceView("script");
    setAssetTab("combos");
    setDiagnosticIssues([]);
    setPacingBeatFocusIssue(null);
    setFocusedIssueId(null);
    setSelectedAssetId(null);
    setSelectedProductionUnitId(null);
    setSelectedProductionUnitAssetId(null);
    setHoveredAssetId(null);
    setContextEpisodeNumber(nextEpisodes[0]?.index ?? 1);
  }, [assets]);

  const handleModulesComplete = useCallback((completedKeys: string[]) => {
    setModulesCompleted(completedKeys.length > 0);
  }, []);

  const handleEpisodeContentChange = useCallback((episodeIndex: number, content: string) => {
    setEpisodes((prev) =>
      prev.map((episode, index) =>
        index === episodeIndex ? { ...episode, content } : episode
      )
    );
  }, []);

  const handleApplyLocalizeEpisode = useCallback((episodeNumber: number, content: string) => {
    setEpisodes((prev) =>
      prev.map((ep) => ep.index === episodeNumber ? { ...ep, content } : ep)
    );
  }, []);

  const handleOpenPacingDetail = useCallback((result: PacingResult) => {
    setPacingDetailResult(result);
    setShowPacingDetail(true);
    setPacingContentSnapshot(Object.fromEntries(episodes.map((e) => [e.index, e.content])));
  }, [episodes]);

  const handleAdoptPacingIssue = useCallback((issue: { id: string; episode: number; type: string; description: string; suggestion: string; fixOptions?: { label?: string; suggestion?: string; targetEpisode?: number; recommended?: boolean }[]; textSnippet: string; severity: "高" | "中" | "低"; status: "open" }) => {
    setAdoptedPacingIssues((prev) => prev.some((i) => i.id === issue.id) ? prev : [...prev, issue]);
  }, []);

  const handleReanalyzePacingEpisode = useCallback(async () => {
    const ep = episodes[activeEpisode];
    if (!ep) return;
    setReanalyzingPacingEpisode(true);
    try {
      const res = await fetch("/api/optimize/pacing-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodes: [ep], settings }),
      });
      const data = await res.json() as { beats?: unknown[]; issues?: unknown[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "分析失败");
      setPacingEpisodeUpdate({ episode: ep.index, beats: data.beats ?? [], issues: data.issues ?? [] });
      if (pacingDetailResult) {
        const filteredBeats = pacingDetailResult.beats.filter((b) => b.episode !== ep.index);
        const newBeats = (data.beats ?? []) as typeof pacingDetailResult.beats;
        const reordered = [...filteredBeats, ...newBeats].sort((a, b) => a.episode - b.episode || a.order - b.order);
        setPacingDetailResult({ ...pacingDetailResult, beats: reordered });
      }
      setPacingContentSnapshot((prev) => ({ ...prev, [ep.index]: ep.content }));
      setDiagnosticIssues((prev) => prev.map((i) => i.episode === ep.index ? { ...i, status: "resolved" as const } : i));
    } catch (e) {
      console.error(e);
    } finally {
      setReanalyzingPacingEpisode(false);
    }
  }, [activeEpisode, episodes, settings, pacingDetailResult]);

  const handleIssueAction = useCallback(async (issueId: string, action: "ai" | "ignore", options?: IssueActionOptions) => {
    if (action === "ignore") {
      setDiagnosticIssues((prev) =>
        prev.map((issue) => issue.id === issueId ? { ...issue, status: "ignored" } : issue)
      );
      setPacingBeatFocusIssue((current) => current?.id === issueId ? null : current);
      setFocusedIssueId((current) => current === issueId ? null : current);
      return;
    }

    const issue = diagnosticIssues.find((item) => item.id === issueId) ??
      (pacingBeatFocusIssue?.id === issueId ? pacingBeatFocusIssue : undefined);
    const targetEpisodeNumber = options?.targetEpisode ?? issue?.episode;
    const episodeIndex = targetEpisodeNumber
      ? episodes.findIndex((episode) => episode.index === targetEpisodeNumber)
      : -1;
    const episode = episodeIndex >= 0 ? episodes[episodeIndex] : null;
    if (!issue || !episode) return;

    setRewritingIssueId(issueId);
    try {
      const res = await fetch("/api/optimize/rewrite-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode,
          issue: {
            ...issue,
            selectedSuggestion: options?.selectedSuggestion ?? issue.suggestion,
            userCorrection: options?.userCorrection,
          },
          settings,
        }),
      });

      const data = await res.json() as { content?: string; error?: string };
      if (!res.ok || data.error || !data.content) {
        throw new Error(data.error ?? "AI局部修改失败");
      }

      setEpisodes((prev) =>
        prev.map((item) =>
          item.index === episode.index ? { ...item, content: data.content ?? item.content } : item
        )
      );
      setDiagnosticIssues((prev) => prev.map((item) => item.id === issueId ? { ...item, status: "resolved" } : item));
      setPacingBeatFocusIssue((current) => current?.id === issueId ? null : current);
      setFocusedIssueId(null);
      setAssetWarnings((prev) => [
        ...prev.filter((warning) => !warning.includes("资产") || !warning.includes("刷新")),
        assets ? "AI 已修改当前剧本；资产和场面组合需要刷新。" : "AI 已修改当前剧本；可基于当前版本提取资产。",
      ]);
      setFinalScriptReady(true);
    } catch (e) {
      setAssetWarnings((prev) => [
        ...prev,
        `AI局部修改失败：${e instanceof Error ? e.message : String(e)}`,
      ]);
    } finally {
      setRewritingIssueId(null);
    }
  }, [assets, diagnosticIssues, episodes, pacingBeatFocusIssue, settings]);

  const handleIssueRestore = useCallback((issueId: string) => {
    setDiagnosticIssues((prev) =>
      prev.map((issue) => issue.id === issueId ? { ...issue, status: "open" } : issue)
    );
  }, []);

  const handleIssueFocus = useCallback((issue: DiagnosticIssue) => {
    if ((issue.status ?? issueStatuses[issue.id] ?? "open") === "ignored") return;
    const index = episodes.findIndex((episode) => episode.index === issue.episode);
    if (index < 0) return;
    setWorkspaceView("script");
    setActiveEpisode(index);
    setFocusedIssueId(null);
    window.requestAnimationFrame(() => {
      setFocusedIssueId(issue.id);
      episodeRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [episodes, issueStatuses]);

  const handlePacingBeatFocus = useCallback((issue: DiagnosticIssue) => {
    setPacingBeatFocusIssue(issue);
    handleIssueFocus(issue);
  }, [handleIssueFocus]);

  const scrollToEpisode = useCallback((idx: number) => {
    setActiveEpisode(idx);
    episodeRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleAssetUpdate = useCallback((id: string, field: string, value: AssetUpdateValue) => {
    setAssets((prev) => {
      if (!prev) return prev;
      const up = <T extends { id: string }>(list: T[]) =>
        list.map((item) => (item.id === id ? { ...item, [field]: value } : item));
      return {
        characters: up(prev.characters),
        scenes: up(prev.scenes),
        props: up(prev.props),
        productionUnits: prev.productionUnits,
      };
    });
  }, []);

  const handleAssetDelete = useCallback((id: string) => {
    setAssets((prev) => {
      if (!prev) return prev;
      return {
        characters: prev.characters.filter((asset) => asset.id !== id),
        scenes: prev.scenes.filter((asset) => asset.id !== id),
        props: prev.props.filter((asset) => asset.id !== id),
        productionUnits: prev.productionUnits.map((unit) => ({
          ...unit,
          refs: unit.refs.filter((ref) => ref.assetId !== id),
        })),
      };
    });
    setSelectedAssetId((prev) => (prev === id ? null : prev));
    setSelectedProductionUnitAssetId((prev) => (prev === id ? null : prev));
  }, []);

  const handleAssetAdd = useCallback((tab: Exclude<AssetTab, "combos">) => {
    const id = `${tab.slice(0, -1)}-${Date.now()}`;
    const base = {
      id,
      aliases: [],
      description: "",
      appearsIn: [contextEpisodeNumber],
      referenceImages: [],
      stateTimeline: [
        { fromEpisode: contextEpisodeNumber, state: "填写这个资产在当前集的视觉状态", change: "初始状态", trigger: "人工新增" },
      ],
      linkedTo: [],
    };
    setAssets((prev) => {
      if (!prev) return prev;
      if (tab === "characters") {
        const asset: Character = {
          ...base,
          name: "新角色",
          description: "填写角色身份、外貌和剧情作用。",
          emotionTags: [],
        };
        return { ...prev, characters: [asset, ...prev.characters] };
      }
      if (tab === "scenes") {
        const asset: Scene = {
          ...base,
          name: "新场景",
          description: "填写场景空间、光线、时代质感和连续性要点。",
        };
        return { ...prev, scenes: [asset, ...prev.scenes] };
      }
      const asset: Prop = {
        ...base,
        name: "新道具",
        description: "填写道具外观、持有人和剧情作用。",
      };
      return { ...prev, props: [asset, ...prev.props] };
    });
    setAssetTab(tab);
    setSelectedAssetId(id);
    setSelectedAssetStateKey(`${id}:${contextEpisodeNumber}:0`);
    setSelectedBoundSceneId(null);
  }, [contextEpisodeNumber]);

  const handleProductionUnitUpdate = useCallback((id: string, updates: Partial<ProductionUnit>) => {
    setAssets((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        productionUnits: prev.productionUnits.map((unit) => (unit.id === id ? normalizeProductionUnit({ ...unit, ...updates }) : unit)),
      };
    });
  }, []);

  const handleProductionUnitEpisodesChange = useCallback((id: string, value: string) => {
    const episodeRange = parseEpisodeLabel(value);
    handleProductionUnitUpdate(id, { episodeRange });
  }, [handleProductionUnitUpdate]);

  const handleProductionUnitAdd = useCallback(() => {
    const id = `unit-${Date.now()}`;
    const unit: ProductionUnit = {
      id,
      episodeRange: [],
      sceneName: "新场面组合",
      tasks: ["连续性检查"],
      note: "填写场面说明、连续性风险和生成注意点。",
      refs: [],
      basis: ["同一地点：待填写", "同一时间：待填写"],
      owner: "未分配",
      scriptExcerpt: "填写该制作单元覆盖的剧情摘要。",
      consistencyLocks: [],
      prompt: "",
      fullScript: "",
      sourceFragments: [],
      coverageNote: "",
      editStatus: "人工校正中",
    };
    setAssets((prev) => prev ? { ...prev, productionUnits: [unit, ...prev.productionUnits] } : prev);
    setSelectedProductionUnitId(id);
    setSelectedProductionUnitAssetId(null);
    setExpandedProductionUnitId(id);
    setAssetTab("combos");
  }, []);

  const handleProductionUnitDelete = useCallback((id: string) => {
    setAssets((prev) => {
      if (!prev) return prev;
      const next = prev.productionUnits.filter((unit) => unit.id !== id);
      setSelectedProductionUnitId((current) => (current === id ? next[0]?.id ?? null : current));
      return { ...prev, productionUnits: next };
    });
  }, []);

  const moveProductionUnit = useCallback((dragId: string, targetId: string) => {
    if (dragId === targetId) return;
    setAssets((prev) => {
      if (!prev) return prev;
      const dragIndex = prev.productionUnits.findIndex((unit) => unit.id === dragId);
      const targetIndex = prev.productionUnits.findIndex((unit) => unit.id === targetId);
      if (dragIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev.productionUnits];
      const [item] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, item);
      return { ...prev, productionUnits: next };
    });
  }, []);

  const clearProductionUnitDragState = useCallback(() => {
    setDraggingProductionUnitId(null);
    setDragOverProductionUnitId(null);
  }, []);

  const selectProductionUnit = useCallback((unit: ProductionUnit) => {
    setSelectedProductionUnitId(unit.id);
    setSelectedProductionUnitAssetId((current) => {
      if (current && unit.refs.some((ref) => ref.assetId === current)) return current;
      return unit.refs[0]?.assetId ?? null;
    });
  }, []);

  const removeProductionUnitRef = useCallback((unitId: string, refToRemove: ProductionUnitRef) => {
    setAssets((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        productionUnits: prev.productionUnits.map((unit) => {
          if (unit.id !== unitId) return unit;
          return normalizeProductionUnit({
            ...unit,
            refs: unit.refs.filter((ref) =>
              ref.assetId !== refToRemove.assetId ||
              ref.role !== refToRemove.role ||
              ref.stateEpisode !== refToRemove.stateEpisode
            ),
            editStatus: "人工校正中",
          });
        }),
      };
    });
    setSelectedProductionUnitAssetId((current) => (current === refToRemove.assetId ? null : current));
  }, []);

  const updateProductionUnitRefState = useCallback((unitId: string, refToUpdate: ProductionUnitRef, nextStateEpisode: number) => {
    setAssets((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        productionUnits: prev.productionUnits.map((unit) => {
          if (unit.id !== unitId) return unit;
          return normalizeProductionUnit({
            ...unit,
            refs: unit.refs.map((ref) => {
              const isTarget =
                ref.assetId === refToUpdate.assetId &&
                ref.role === refToUpdate.role &&
                ref.stateEpisode === refToUpdate.stateEpisode;
              return isTarget ? { ...ref, stateEpisode: nextStateEpisode } : ref;
            }),
            editStatus: "人工校正中",
          });
        }),
      };
    });
    setSelectedProductionUnitAssetId(refToUpdate.assetId);
  }, []);

  const addProductionUnitRef = useCallback((unitId: string, asset: Asset, type: "character" | "scene" | "prop" | null) => {
    setAssets((prev) => {
      if (!prev) return prev;
      const unit = prev.productionUnits.find((item) => item.id === unitId);
      const firstEpisode = unit?.episodeRange[0] ?? asset.appearsIn[0] ?? contextEpisodeNumber;
      const selectedState = stateAtEpisode(asset.stateTimeline, firstEpisode) ?? asset.stateTimeline[0];
      const rolePrefix = type === "scene" ? "场景基准" : type === "prop" ? "本场道具" : "本场角色";
      const nextRef: ProductionUnitRef = {
        assetId: asset.id,
        stateEpisode: selectedState?.fromEpisode ?? firstEpisode,
        role: rolePrefix,
      };
      return {
        ...prev,
        productionUnits: prev.productionUnits.map((item) => {
          if (item.id !== unitId) return item;
          const hasSameAsset = item.refs.some((ref) => ref.assetId === asset.id);
          if (hasSameAsset) return item;
          return normalizeProductionUnit({
            ...item,
            refs: [...item.refs, nextRef],
            editStatus: "人工校正中",
          });
        }),
      };
    });
    setSelectedProductionUnitAssetId(asset.id);
    setAssetRefPickerUnitId(null);
  }, [contextEpisodeNumber]);

  const bindAssetStateToProductionUnit = useCallback((unitId: string, asset: Asset, point: StateKeyframe, type: "character" | "scene" | "prop" | null) => {
    const rolePrefix = type === "scene" ? "场景基准" : type === "prop" ? "本场道具" : "本场角色";
    setAssets((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        productionUnits: prev.productionUnits.map((unit) => {
          if (unit.id !== unitId) return unit;
          const hasSameAsset = unit.refs.some((ref) => ref.assetId === asset.id);
          return normalizeProductionUnit({
            ...unit,
            refs: hasSameAsset
              ? unit.refs.map((ref) => ref.assetId === asset.id ? { ...ref, stateEpisode: point.fromEpisode } : ref)
              : [...unit.refs, { assetId: asset.id, stateEpisode: point.fromEpisode, role: rolePrefix }],
            editStatus: "人工校正中",
          });
        }),
      };
    });
    setSelectedProductionUnitId(unitId);
    setSelectedProductionUnitAssetId(asset.id);
    setSelectedBoundSceneId(unitId);
    setStateBindPickerKey(null);
  }, []);

  const markProductionUnitConfirmed = useCallback((id: string) => {
    handleProductionUnitUpdate(id, { editStatus: "人工已确认" });
  }, [handleProductionUnitUpdate]);

  const updateProductionUnitScript = useCallback((id: string, value: string) => {
    handleProductionUnitUpdate(id, { fullScript: value, editStatus: "人工校正中" });
  }, [handleProductionUnitUpdate]);

  const resetProductionUnitScript = useCallback((unit: ProductionUnit) => {
    const sourceText = (unit.sourceFragments ?? []).map((fragment) => fragment.text).join("\n\n");
    handleProductionUnitUpdate(unit.id, {
      fullScript: sourceText || unit.scriptExcerpt,
      editStatus: "人工校正中",
    });
  }, [handleProductionUnitUpdate]);

  const toggleProductionUnitSourceFragment = useCallback((fragment: ProductionUnitSourceFragment) => {
    if (!selectedProductionUnit) return;
    const key = sourceFragmentKey(fragment);
    const unitId = selectedProductionUnit.id;
    setSelectedSourceFragmentKeys((prev) => {
      const current = prev[unitId] ?? defaultSourceFragmentKeys;
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      const nextFragments = productionUnitContextFragments.filter((item) => next.includes(sourceFragmentKey(item)));
      handleProductionUnitUpdate(unitId, {
        fullScript: sourceScriptFromFragments(nextFragments),
        sourceFragments: nextFragments,
        editStatus: "人工校正中",
      });
      return { ...prev, [unitId]: next };
    });
  }, [defaultSourceFragmentKeys, handleProductionUnitUpdate, productionUnitContextFragments, selectedProductionUnit]);

  const selectAllProductionUnitSourceFragments = useCallback(() => {
    if (!selectedProductionUnit) return;
    const keys = productionUnitContextFragments.map((fragment) => sourceFragmentKey(fragment));
    setSelectedSourceFragmentKeys((prev) => ({ ...prev, [selectedProductionUnit.id]: keys }));
    handleProductionUnitUpdate(selectedProductionUnit.id, {
      fullScript: sourceScriptFromFragments(productionUnitContextFragments),
      sourceFragments: productionUnitContextFragments,
      editStatus: "人工校正中",
    });
  }, [handleProductionUnitUpdate, productionUnitContextFragments, selectedProductionUnit]);

  const clearProductionUnitSourceFragments = useCallback(() => {
    if (!selectedProductionUnit) return;
    setSelectedSourceFragmentKeys((prev) => ({ ...prev, [selectedProductionUnit.id]: [] }));
    handleProductionUnitUpdate(selectedProductionUnit.id, {
      fullScript: "",
      sourceFragments: [],
      editStatus: "人工校正中",
    });
  }, [handleProductionUnitUpdate, selectedProductionUnit]);

  const openAssetLibrary = useCallback((targetTab: Exclude<AssetTab, "combos"> = "characters") => {
    setAssetTab(targetTab);
    setWorkspaceView("assetLibrary");
    setSelectedAssetId((current) => {
      if (current && assets && [...assets.characters, ...assets.scenes, ...assets.props].some((asset) => asset.id === current)) {
        return current;
      }
      if (!assets) return current;
      const first = targetTab === "characters" ? assets.characters[0] : targetTab === "scenes" ? assets.scenes[0] : assets.props[0];
      return first?.id ?? current;
    });
  }, [assets]);

  const handleAssetSelect = useCallback(
    (asset: Asset) => {
      setSelectedAssetId(asset.id);
      setSelectedAssetStateKey(asset.stateTimeline[0] ? stateKey(asset.id, asset.stateTimeline[0], 0) : null);
      setSelectedBoundSceneId(null);
      setWorkspaceView("assetLibrary");

      const firstEp = asset.appearsIn?.[0];
      if (typeof firstEp === "number") setContextEpisodeNumber(firstEp);

      const firstEpisode = asset.appearsIn?.[0];
      if (typeof firstEpisode !== "number") return;

      const episodeIdx = episodes.findIndex((ep) => ep.index === firstEpisode);
      if (episodeIdx >= 0) {
        scrollToEpisode(episodeIdx);
      } else {
        const fallbackIdx = firstEpisode - 1;
        if (fallbackIdx >= 0 && fallbackIdx < episodes.length) {
          scrollToEpisode(fallbackIdx);
        }
      }
    },
    [episodes, scrollToEpisode],
  );

  const loadInteractionTestData = useCallback(() => {
    const testAssets: Assets = {
      characters: interactionTestAssets.characters.map((asset) => ({ ...asset, stateTimeline: [...asset.stateTimeline], referenceImages: [...asset.referenceImages], aliases: [...asset.aliases], emotionTags: [...asset.emotionTags], appearsIn: [...asset.appearsIn], linkedTo: [...asset.linkedTo] })),
      scenes: interactionTestAssets.scenes.map((asset) => ({ ...asset, stateTimeline: [...asset.stateTimeline], referenceImages: [...asset.referenceImages], aliases: [...asset.aliases], appearsIn: [...asset.appearsIn], linkedTo: [...asset.linkedTo] })),
      props: interactionTestAssets.props.map((asset) => ({ ...asset, stateTimeline: [...asset.stateTimeline], referenceImages: [...asset.referenceImages], aliases: [...asset.aliases], appearsIn: [...asset.appearsIn], linkedTo: [...asset.linkedTo] })),
      productionUnits: interactionTestAssets.productionUnits.map((unit) => normalizeProductionUnit({
        ...unit,
        episodeRange: [...unit.episodeRange],
        tasks: [...unit.tasks],
        refs: unit.refs.map((ref) => ({ ...ref })),
        basis: [...unit.basis],
        consistencyLocks: [...unit.consistencyLocks],
        sourceFragments: (unit.sourceFragments ?? []).map((fragment) => ({ ...fragment })),
      })),
    };
    const firstUnit = testAssets.productionUnits[0];
    setRawText(interactionTestEpisodes.map((ep) => `# ${ep.title}\n${ep.content}`).join("\n\n"));
    setEpisodes(interactionTestEpisodes.map((ep) => ({ ...ep })));
    setAssets(testAssets);
    setAssetScriptVersion(scriptVersionKey(interactionTestEpisodes));
    setDiagnosticIssues([]);
    setAssetWarnings(["已加载本地交互测试数据：可先确认组件和交互，不会调用模型。"]);
    setModulesCompleted(true);
    setFinalScriptReady(true);
    setPhase("workspace");
    setWorkspaceView("assetLibrary");
    setAssetTab("combos");
    setActiveEpisode(0);
    setContextEpisodeNumber(firstUnit?.episodeRange[0] ?? 1);
    setSelectedProductionUnitId(firstUnit?.id ?? null);
    setSelectedProductionUnitAssetId(firstUnit?.refs[0]?.assetId ?? null);
    setExpandedProductionUnitId(firstUnit?.id ?? null);
    setAssetRefPickerUnitId(null);
    setProductionUnitSourcePickerId(null);
    setSelectedAssetId(null);
    setSelectedAssetStateKey(null);
    setSelectedBoundSceneId(null);
    setHoveredAssetId(null);
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-200">
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur-md">
        <h1 className="text-lg font-bold text-zinc-100">剧本优化</h1>
        <div className="flex items-center gap-2">
          <ApiSettingsToolbarButton />
          <Link
            href="/"
            className="rounded-lg border border-zinc-600/80 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900/60"
          >
            ← 模式选择
          </Link>
        </div>
      </header>

      {phase === "upload" && (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/40 p-8">
            <h2 className="mb-6 text-center text-2xl font-bold text-zinc-100">剧本优化工作台</h2>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="粘贴剧本全文…"
              className="min-h-[200px] w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
            />

            <div className="mt-4 flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-700/60">
                <input
                  type="file"
                  accept=".txt,.docx,.pdf"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                    e.target.value = "";
                  }}
                />
                上传文件
              </label>
              <span className="text-xs text-zinc-500">支持 .txt .docx .pdf</span>
              {rawText && (
                <span className="ml-auto text-xs text-zinc-500">
                  {rawText.length.toLocaleString()} 字
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleSplit()}
              disabled={splitting || !rawText.trim()}
              className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {splitting ? "正在拆集…" : "上传并拆集"}
            </button>
            <button
              type="button"
              onClick={loadInteractionTestData}
              className="mt-3 w-full rounded-lg border border-dashed border-emerald-700/60 bg-emerald-950/20 py-2.5 text-sm font-medium text-emerald-200 transition hover:border-emerald-500 hover:bg-emerald-950/35"
            >
              加载交互测试数据
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500">
              跳过拆集和优化模块，直接进入最终资产处理调试组件交互。
            </p>

            {splitError && (
              <p className="mt-3 text-center text-sm text-red-400">{splitError}</p>
            )}
          </div>
        </div>
      )}

      {phase === "workspace" && (
        <div className="flex flex-1 overflow-hidden">
          {/* 左栏：集数导航 */}
          <aside
            className={`flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200 ${
              collapsed ? "w-10" : "w-48"
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
              {!collapsed && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  集数
                </span>
              )}
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                {collapsed ? "▶" : "◀"}
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-1">
              {episodes.map((ep, idx) => (
                <button
                  key={ep.index}
                  type="button"
                  onClick={() => scrollToEpisode(idx)}
                  title={ep.title}
                  className={`w-full truncate py-2 text-left text-sm transition-colors ${
                    collapsed ? "px-1 text-center" : "px-3"
                  } ${
                    activeEpisode === idx
                      ? "border-r-2 border-emerald-500 bg-emerald-600/15 text-emerald-400"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  {collapsed ? `${ep.index}` : `第 ${ep.index} 集`}
                </button>
              ))}
            </nav>

            <div className="border-t border-zinc-800 p-2">
              <button
                type="button"
                onClick={() => {
                  setPhase("upload");
                  setContextEpisodeNumber(1);
                  setEpisodes([]);
                  setAssets(null);
                  setAssetScriptVersion(null);
                  setDiagnosticIssues([]);
                  setFocusedIssueId(null);
                  setRawText("");
                  setActiveEpisode(0);
                  setModulesCompleted(false);
                  setFinalScriptReady(false);
                  setHoveredAssetId(null);
                  setSelectedAssetId(null);
                  setWorkspaceView("script");
                }}
                className="w-full rounded-lg border border-zinc-700 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
              >
                {collapsed ? "↩" : "重新上传"}
              </button>
            </div>
          </aside>

          {/* 中栏：剧本正文 */}
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/30 px-4 py-2.5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">
                  {episodes[activeEpisode]?.title ?? `第${activeEpisode + 1}集`}
                </h2>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {assetsNeedRefresh ? "当前剧本已变化：建议刷新资产与场面组合" : finalScriptReady ? "已采用优化剧本：可继续优化或刷新资产" : "四模块过滤阶段：正文可直接编辑"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleExtractAssets()}
                disabled={extracting || episodes.length === 0}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  assetsNeedRefresh
                    ? "bg-amber-600 text-white hover:bg-amber-500"
                    : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {extracting ? "处理中..." : assets ? "刷新资产" : "提取资产"}
              </button>
            </div>
            {assetWarnings.length > 0 && (
              <div className="border-b border-amber-700/30 bg-amber-950/20 px-4 py-2">
                {assetWarnings.map((warning, i) => (
                  <p key={`${warning}-${i}`} className="text-[11px] text-amber-300">
                    {warning}
                  </p>
                ))}
              </div>
            )}

            {workspaceView === "assetLibrary" && assets ? (
              <div className="flex-1 overflow-hidden">
                <div className="grid h-full grid-cols-[170px_300px_minmax(0,1fr)]">
                  <aside className="border-r border-zinc-800 bg-zinc-950/80 p-3">
                    <button
                      type="button"
                      onClick={() => setWorkspaceView("script")}
                      className="mb-4 w-full rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                    >
                      返回剧本
                    </button>
                    <div className="space-y-1">
                      {([
                        ["combos", "场面组合", assets.productionUnits.length],
                        ["characters", "角色", assets.characters.length],
                        ["scenes", "场景", assets.scenes.length],
                        ["props", "道具", assets.props.length],
                      ] as const).map(([tab, label, count]) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => {
                            setAssetTab(tab);
                            const firstAsset = tab === "characters" ? assets.characters[0] : tab === "scenes" ? assets.scenes[0] : tab === "props" ? assets.props[0] : null;
                            if (firstAsset) {
                              setSelectedAssetId(firstAsset.id);
                              setSelectedAssetStateKey(firstAsset.stateTimeline[0] ? stateKey(firstAsset.id, firstAsset.stateTimeline[0], 0) : null);
                              setSelectedBoundSceneId(null);
                            }
                          }}
                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                            assetTab === tab ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                          }`}
                        >
                          <span>{label}</span>
                          <span className="text-xs text-zinc-500">{count}</span>
                        </button>
                      ))}
                    </div>
                  </aside>

                  <section className="border-r border-zinc-800 bg-zinc-950/60 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          {assetTab === "combos" ? "场面组合" : assetTab === "characters" ? "角色" : assetTab === "scenes" ? "场景" : "道具"}
                        </h3>
                        <p className="text-xs text-zinc-500">
                          {assetTab === "combos" ? `${assets.productionUnits.length} 个制作单元` : `${activeLibraryAssets.length} 个资产`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (assetTab === "combos") handleProductionUnitAdd();
                          else handleAssetAdd(assetTab);
                        }}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                      >
                        新增
                      </button>
                    </div>
                    <div className="space-y-2 overflow-y-auto">
                      {assetTab === "combos" ? (
                        assets.productionUnits.map((unit) => (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => selectProductionUnit(unit)}
                            className={`w-full rounded-lg border p-3 text-left transition ${
                              selectedProductionUnitId === unit.id ? "border-sky-500/60 bg-sky-950/20" : "border-zinc-800 bg-zinc-900/35 hover:border-zinc-700"
                            }`}
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-sky-200">{episodeLabel(unit.episodeRange) || "E?"}</span>
                              <span className="truncate text-sm font-semibold text-zinc-100">{unit.sceneName}</span>
                            </div>
                            <p className="line-clamp-2 text-xs leading-5 text-zinc-500">{unit.note}</p>
                          </button>
                        ))
                      ) : (
                        activeLibraryAssets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => {
                              setSelectedAssetId(asset.id);
                              setSelectedAssetStateKey(asset.stateTimeline[0] ? stateKey(asset.id, asset.stateTimeline[0], 0) : null);
                              setSelectedBoundSceneId(null);
                            }}
                            className={`w-full rounded-lg border p-3 text-left transition ${
                              selectedAssetId === asset.id ? "border-emerald-500/60 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900/35 hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-zinc-100">{asset.name}</span>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{asset.description}</p>
                              </div>
                              <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{episodeLabel(asset.appearsIn.slice(0, 1))}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </section>

                  <div className="overflow-y-auto px-6 py-5">
                    {assetTab === "combos" ? (
                      <div>
                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <h2 className="text-2xl font-semibold text-zinc-100">{selectedProductionUnit?.sceneName ?? "场面组合"}</h2>
                            <p className="mt-1 text-sm text-zinc-500">按剧本制作顺序管理制作单元，支持资产绑定、剧情核对和状态预览。</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleProductionUnitAdd}
                            className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white"
                          >
                            新增场面组合
                          </button>
                        </div>
                        {selectedProductionUnit ? (
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <input
                                      value={episodeLabel(selectedProductionUnit.episodeRange)}
                                      onChange={(event) => handleProductionUnitEpisodesChange(selectedProductionUnit.id, event.target.value)}
                                      placeholder="E?"
                                      className="w-28 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-sky-200 outline-none focus:border-sky-700"
                                    />
                                    {selectedProductionUnit.tasks.map((task, index) => (
                                      <span key={`${task}-${index}`} className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{task}</span>
                                    ))}
                                    <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-400">
                                      {selectedProductionUnit.editStatus ?? "系统识别"}
                                    </span>
                                  </div>
                                  <input
                                    value={selectedProductionUnit.sceneName}
                                    onChange={(event) => handleProductionUnitUpdate(selectedProductionUnit.id, { sceneName: event.target.value, editStatus: "人工校正中" })}
                                    className="w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-xl font-semibold text-zinc-100 outline-none focus:border-zinc-800 focus:bg-zinc-950"
                                  />
                                  <input
                                    value={selectedProductionUnit.owner}
                                    onChange={(event) => handleProductionUnitUpdate(selectedProductionUnit.id, { owner: event.target.value, editStatus: "人工校正中" })}
                                    className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 py-1 text-xs text-zinc-600 outline-none focus:border-zinc-800 focus:bg-zinc-950"
                                  />
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAssetRefPickerUnitId((current) => current === selectedProductionUnit.id ? null : selectedProductionUnit.id)}
                                    className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white"
                                  >
                                    引用资产
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleProductionUnitDelete(selectedProductionUnit.id)}
                                    className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-500 transition hover:border-red-800 hover:bg-red-950/20 hover:text-red-200"
                                  >
                                    删除
                                  </button>
                                </div>
                              </div>

                              <textarea
                                value={selectedProductionUnit.note}
                                onChange={(event) => handleProductionUnitUpdate(selectedProductionUnit.id, { note: event.target.value, editStatus: "人工校正中" })}
                                className="mt-4 min-h-16 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-300 outline-none focus:border-sky-700"
                              />

                              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/70">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedProductionUnitId((current) => current === selectedProductionUnit.id ? null : selectedProductionUnit.id);
                                    setProductionUnitSourcePickerId(null);
                                  }}
                                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-900/70"
                                >
                                  <span>
                                    <span className="block text-sm font-medium text-zinc-200">制作单元剧情</span>
                                    <span className="mt-0.5 block text-xs text-zinc-600">用于核对本场戏是否覆盖完整</span>
                                  </span>
                                  <span className="text-xs text-zinc-500">{expandedProductionUnitId === selectedProductionUnit.id ? "收起" : "展开"}</span>
                                </button>
                                <div className="border-t border-zinc-800/70 px-4 py-3">
                                  <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
                                    <span className="text-xs text-zinc-500">剧情覆盖</span>
                                    <div>
                                      <p className="text-xs text-zinc-600">按制作连续戏份覆盖，不按原集尾钩子拆分。</p>
                                      <textarea
                                        value={selectedProductionUnit.scriptExcerpt}
                                        onChange={(event) => handleProductionUnitUpdate(selectedProductionUnit.id, { scriptExcerpt: event.target.value, editStatus: "人工校正中" })}
                                        className="mt-2 min-h-20 w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-6 text-zinc-300 outline-none focus:border-sky-700"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-5 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-zinc-100">本场绑定资产</h3>
                                <span className="text-xs text-zinc-500">{selectedProductionUnit.refs.length} 个引用</span>
                              </div>
                              {assetRefPickerUnitId === selectedProductionUnit.id && (
                                <div className="mt-3 rounded-lg border border-emerald-800/60 bg-emerald-950/10 p-3">
                                  <div className="mb-3 flex items-center justify-between">
                                    <div>
                                      <h4 className="text-sm font-semibold text-zinc-100">引用资产</h4>
                                      <p className="mt-1 text-xs text-zinc-500">从现有资产库绑定到当前制作单元，不在这里新建资产。</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setAssetRefPickerUnitId(null)}
                                      className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                                    >
                                      关闭
                                    </button>
                                  </div>
                                  <div className="grid gap-3 lg:grid-cols-3">
                                    {pickerAssetGroups.map(([groupKey, groupLabel, groupAssets]) => (
                                      <div key={groupKey} className="rounded-md border border-zinc-800 bg-zinc-950/80 p-2">
                                        <div className="mb-2 flex items-center justify-between">
                                          <span className="text-xs font-medium text-zinc-300">{groupLabel}</span>
                                          <span className="text-[10px] text-zinc-600">{groupAssets.length}</span>
                                        </div>
                                        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                          {groupAssets.map((asset) => {
                                            const type = assetTypeOf(asset, assets);
                                            const isBound = selectedProductionUnit.refs.some((ref) => ref.assetId === asset.id);
                                            const targetState = stateAtEpisode(asset.stateTimeline, selectedProductionUnit.episodeRange[0] ?? asset.appearsIn[0] ?? contextEpisodeNumber) ?? asset.stateTimeline[0];
                                            return (
                                              <button
                                                key={`${selectedProductionUnit.id}-picker-${asset.id}`}
                                                type="button"
                                                disabled={isBound}
                                                onClick={() => addProductionUnitRef(selectedProductionUnit.id, asset, type)}
                                                className={`w-full rounded-md border px-2 py-2 text-left transition ${
                                                  isBound
                                                    ? "cursor-default border-zinc-800 bg-zinc-900/40 opacity-50"
                                                    : "border-zinc-800 bg-zinc-900/70 hover:border-emerald-700/70 hover:bg-emerald-950/20"
                                                }`}
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="truncate text-xs font-medium text-zinc-200">{asset.name}</span>
                                                  <span className="text-[10px] text-zinc-600">{isBound ? "已引用" : "引用"}</span>
                                                </div>
                                                <p className="mt-1 line-clamp-1 text-[10px] text-zinc-500">
                                                  {stateLabel(targetState)}
                                                </p>
                                              </button>
                                            );
                                          })}
                                          {groupAssets.length === 0 && (
                                            <div className="rounded-md border border-dashed border-zinc-800 p-2 text-xs text-zinc-500">
                                              暂无{groupLabel}资产
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {selectedProductionUnit.refs.map((ref, index) => {
                                  const asset = assets ? findAssetById(assets, ref.assetId) : null;
                                  const type = assets ? assetTypeOf(asset, assets) : null;
                                  const state = asset
                                    ? asset.stateTimeline.find((point) => point.fromEpisode === ref.stateEpisode) ??
                                      stateAtEpisode(asset.stateTimeline, selectedProductionUnit.episodeRange[0] ?? asset.appearsIn[0] ?? 1) ??
                                      asset.stateTimeline[0]
                                    : undefined;
                                  if (!asset) return null;
                                  return (
                                    <div
                                      key={`${selectedProductionUnit.id}-${ref.assetId}-${ref.role}-${index}`}
                                      className={`rounded-lg border bg-zinc-950/70 p-3 transition ${
                                        selectedProductionUnitAsset?.id === asset.id ? "border-emerald-500/60" : "border-zinc-800 hover:border-sky-700"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedProductionUnitAssetId(asset.id)}
                                          className="min-w-0 text-left"
                                        >
                                          <span className="block truncate text-sm font-medium text-zinc-100">{asset.name}</span>
                                        </button>
                                        <div className="flex shrink-0 items-center gap-2">
                                          <span className="text-xs text-zinc-500">{assetTypeLabel(type)}</span>
                                          <button
                                            type="button"
                                            onClick={() => removeProductionUnitRef(selectedProductionUnit.id, ref)}
                                            className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500 transition hover:border-red-500/60 hover:bg-red-950/30 hover:text-red-200"
                                          >
                                            删除
                                          </button>
                                        </div>
                                      </div>
                                      <p className="mt-1 text-xs text-zinc-500">{ref.role}</p>
                                      {asset.stateTimeline.length > 0 && (
                                        <label className="mt-3 block">
                                          <span className="mb-1 block text-[10px] text-zinc-600">切换本场状态</span>
                                          <select
                                            value={state?.fromEpisode ?? ref.stateEpisode ?? ""}
                                            onChange={(event) => updateProductionUnitRefState(selectedProductionUnit.id, ref, Number(event.target.value))}
                                            className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-emerald-600"
                                          >
                                            {asset.stateTimeline.map((point, stateIndex) => (
                                              <option key={`${asset.id}-${point.fromEpisode}-${stateIndex}`} value={point.fromEpisode}>
                                                {stateLabel(point)}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedProductionUnitAssetId(asset.id)}
                                        className="mt-3 flex w-full items-center gap-2 text-left"
                                      >
                                        <div className="flex h-12 w-16 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-400">
                                          {assetInitials(asset.name)}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate text-xs text-zinc-300">{stateLabel(state)}</p>
                                          <p className="mt-1 line-clamp-1 text-xs text-zinc-600">{state?.state ?? "未找到对应状态"}</p>
                                        </div>
                                      </button>
                                    </div>
                                  );
                                })}
                                {selectedProductionUnit.refs.length === 0 && (
                                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs leading-5 text-zinc-500 md:col-span-2">
                                    当前场面组合没有绑定资产。请点击「引用资产」从分类资产库绑定角色、场景或道具。
                                  </div>
                                )}
                              </div>

                              {expandedProductionUnitId === selectedProductionUnit.id && (
                                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                                  <div className="rounded-md border border-zinc-800 bg-zinc-950/80 p-3">
                                    <div className="mb-3 flex items-center justify-between">
                                      <span className="text-xs text-zinc-400">生成约束清单</span>
                                      <span className="text-xs text-zinc-600">{selectedProductionUnit.consistencyLocks.length}</span>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {selectedProductionUnit.consistencyLocks.map((item, index) => (
                                        <label key={`${item}-${index}`} className="flex items-center gap-2 rounded-md bg-zinc-900/80 px-2.5 py-2 text-sm text-zinc-300">
                                          <input type="checkbox" readOnly className="h-3.5 w-3.5 accent-emerald-500" />
                                          <span>{item}</span>
                                        </label>
                                      ))}
                                      {selectedProductionUnit.consistencyLocks.length === 0 && (
                                        <div className="rounded-md border border-dashed border-zinc-800 px-2.5 py-2 text-xs text-zinc-500">
                                          还没有锁定项。后续可从场景基准、灯光、角色状态和道具状态生成。
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_280px]">
                                    <div className="rounded-md border border-zinc-800 bg-zinc-950/80 p-3">
                                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                                        <span className="text-xs text-zinc-400">制作分工剧本</span>
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setProductionUnitSourcePickerId((current) => current === selectedProductionUnit.id ? null : selectedProductionUnit.id)}
                                            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
                                          >
                                            {productionUnitSourcePickerId === selectedProductionUnit.id ? "完成画选" : "重画段落"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => markProductionUnitConfirmed(selectedProductionUnit.id)}
                                            className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                                          >
                                            确认无遗漏
                                          </button>
                                        </div>
                                      </div>
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs text-zinc-500">精修稿</span>
                                        <button
                                          type="button"
                                          onClick={() => resetProductionUnitScript(selectedProductionUnit)}
                                          className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                                        >
                                          用已选段落重置
                                        </button>
                                      </div>
                                      <textarea
                                        value={selectedProductionUnit.fullScript ?? selectedProductionUnit.scriptExcerpt}
                                        onChange={(event) => updateProductionUnitScript(selectedProductionUnit.id, event.target.value)}
                                        placeholder="先选择来源段落，再删改、补充当前制作单元需要交接给制作人员的完整剧情。"
                                        className="min-h-72 w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-6 text-zinc-200 outline-none focus:border-sky-600"
                                      />
                                      {selectedProductionUnit.coverageNote && (
                                        <p className="mt-2 text-xs leading-5 text-zinc-500">{selectedProductionUnit.coverageNote}</p>
                                      )}
                                    </div>

                                    <div className={`rounded-md border bg-zinc-950/80 p-3 ${
                                      productionUnitSourcePickerId === selectedProductionUnit.id ? "border-amber-800/70" : "border-zinc-800"
                                    }`}>
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs text-zinc-400">上下文来源池</span>
                                        <span className="text-xs text-zinc-600">{activeSourceFragments.length}/{productionUnitContextFragments.length} 段</span>
                                      </div>
                                      {productionUnitSourcePickerId !== selectedProductionUnit.id ? (
                                        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2">
                                          <div className="mb-1 flex items-center justify-between gap-2">
                                            <span className="text-[10px] text-zinc-500">{productionUnitContextEpisodeLabel || "待指定集数"}</span>
                                            <span className="text-[10px] text-zinc-600">进入画选后展开</span>
                                          </div>
                                          <p className="line-clamp-3 text-xs leading-5 text-zinc-400">
                                            已准备当前集、前一集、后一集的来源片段。长剧本场景下这里默认只保留摘要，避免单集长文本占满右栏。
                                          </p>
                                        </div>
                                      ) : (
                                        <>
                                          <p className="mb-3 text-xs leading-5 text-zinc-500">
                                            显示当前制作单元所在集，并露出前一集、后一集。长剧本时应按集数、场景标题和关键词筛选后再画选。
                                          </p>
                                          <div className="mb-3 flex gap-2">
                                            <button
                                              type="button"
                                              onClick={selectAllProductionUnitSourceFragments}
                                              className="flex-1 rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
                                            >
                                              全选
                                            </button>
                                            <button
                                              type="button"
                                              onClick={clearProductionUnitSourceFragments}
                                              className="flex-1 rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
                                            >
                                              清空
                                            </button>
                                          </div>
                                          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                                            {productionUnitContextFragments.map((fragment, index) => {
                                              const key = sourceFragmentKey(fragment);
                                              const isSelectedSource = activeSourceFragmentKeys.includes(key);
                                              const isCoreEpisode = selectedProductionUnit.episodeRange.includes(fragment.episode);
                                              const firstEpisode = Math.min(...selectedProductionUnit.episodeRange);
                                              const isRecognizedSource = (selectedProductionUnit.sourceFragments ?? []).some((source) => sourceFragmentKey(source) === key);
                                              return (
                                                <button
                                                  key={`${selectedProductionUnit.id}-${fragment.episode}-${fragment.label}-${index}`}
                                                  type="button"
                                                  onClick={() => toggleProductionUnitSourceFragment(fragment)}
                                                  className={[
                                                    "w-full rounded-md p-2 text-left transition hover:border-amber-600/70 hover:bg-amber-950/20",
                                                    isSelectedSource
                                                      ? "border border-sky-700/70 bg-sky-950/25"
                                                      : "border border-zinc-800 bg-zinc-900/80",
                                                  ].join(" ")}
                                                >
                                                  <div className="mb-1 flex items-center justify-between gap-2">
                                                    <span className={[
                                                      "rounded px-1.5 py-0.5 text-[10px]",
                                                      isCoreEpisode ? "bg-sky-900/70 text-sky-100" : "bg-zinc-800 text-zinc-400",
                                                    ].join(" ")}>
                                                      E{fragment.episode}
                                                    </span>
                                                    <span className="truncate text-[10px] text-zinc-500">
                                                      {isSelectedSource ? "已选 · " : "未选 · "}
                                                      {fragment.label}
                                                    </span>
                                                  </div>
                                                  <div className="mb-1 flex flex-wrap gap-1">
                                                    <span className={[
                                                      "rounded px-1.5 py-0.5 text-[10px]",
                                                      isCoreEpisode ? "bg-sky-950/70 text-sky-200" : "bg-zinc-800/80 text-zinc-500",
                                                    ].join(" ")}>
                                                      {isCoreEpisode ? "所在集" : fragment.episode < firstEpisode ? "前一集" : "后一集"}
                                                    </span>
                                                    {isRecognizedSource && (
                                                      <span className="rounded bg-emerald-950/50 px-1.5 py-0.5 text-[10px] text-emerald-200">
                                                        系统已划入
                                                      </span>
                                                    )}
                                                  </div>
                                                  <p className="text-xs leading-5 text-zinc-400">{fragment.text}</p>
                                                </button>
                                              );
                                            })}
                                          {productionUnitContextFragments.length === 0 && (
                                            <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs leading-5 text-zinc-500">
                                              暂无来源段落。请先完成拆集，或让后端把当前集、前一集和后一集的候选片段一起返回。
                                            </div>
                                          )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            <aside className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                              <div className="rounded-lg border border-zinc-800 bg-zinc-900/35 p-3">
                                <div className="mb-3 flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-zinc-100">本场资产状态</h4>
                                  <span className="text-xs text-zinc-600">当前选中</span>
                                </div>
                                {selectedProductionUnitAsset ? (
                                  <>
                                    <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-2xl font-semibold text-zinc-300">
                                      {assetInitials(selectedProductionUnitAsset.name)}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between gap-2">
                                      <span className="text-xs text-zinc-500">本场状态图</span>
                                      <span className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                                        {stateLabel(selectedProductionUnitState)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="mt-3 w-full rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white"
                                    >
                                      生成本场状态
                                    </button>
                                    <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
                                      <div className="mb-2 flex items-center gap-2">
                                        <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{assetTypeLabel(selectedProductionUnitAssetType)}</span>
                                      </div>
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <h4 className="truncate text-lg font-semibold text-zinc-100">{selectedProductionUnitAsset.name}</h4>
                                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{selectedProductionUnitAsset.description}</p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedAssetId(selectedProductionUnitAsset.id);
                                            const targetTab = assetTabFromType(selectedProductionUnitAssetType);
                                            if (targetTab) setAssetTab(targetTab);
                                            if (selectedProductionUnitState) {
                                              const stateIndex = selectedProductionUnitAsset.stateTimeline.findIndex((point) => point === selectedProductionUnitState);
                                              setSelectedAssetStateKey(stateKey(selectedProductionUnitAsset.id, selectedProductionUnitState, Math.max(stateIndex, 0)));
                                            }
                                            setSelectedBoundSceneId(selectedProductionUnit.id);
                                          }}
                                          className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                                        >
                                          完整编辑
                                        </button>
                                      </div>
                                      <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 p-2">
                                        <div className="mb-1 flex items-center justify-between">
                                          <span className="text-xs text-zinc-500">本场使用状态</span>
                                          <span className="text-xs text-zinc-600">{stateLabel(selectedProductionUnitState)}</span>
                                        </div>
                                        {selectedProductionUnitRef && selectedProductionUnitAsset.stateTimeline.length > 0 && (
                                          <select
                                            value={selectedProductionUnitState?.fromEpisode ?? selectedProductionUnitRef.stateEpisode ?? ""}
                                            onChange={(event) => updateProductionUnitRefState(selectedProductionUnit.id, selectedProductionUnitRef, Number(event.target.value))}
                                            className="mb-2 w-full rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 outline-none transition focus:border-emerald-600"
                                          >
                                            {selectedProductionUnitAsset.stateTimeline.map((point, index) => (
                                              <option key={`${selectedProductionUnitAsset.id}-${point.fromEpisode}-${index}`} value={point.fromEpisode}>
                                                {stateLabel(point)}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                        <p className="text-xs leading-5 text-zinc-300">{selectedProductionUnitState?.state ?? "未指定状态"}</p>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs leading-5 text-zinc-500">
                                    选择一个本场绑定资产后，这里会显示它在当前制作单元里的状态。
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/25 p-3">
                                <h4 className="text-sm font-semibold text-zinc-100">协作提示</h4>
                                <p className="mt-2 text-xs leading-5 text-zinc-400">
                                  同一场戏由同一组维护场景基准图和状态锁定项；跨集前后场只引用状态，不共享同一个场面组合。
                                </p>
                              </div>
                            </aside>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">
                            还没有场面组合。可以点击新增创建。
                          </div>
                        )}
                      </div>
                    ) : selectedAsset && selectedAssetType ? (
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                        <div>
                          <div className="mb-5 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">
                                  {assetTypeLabel(selectedAssetType)}
                                </span>
                                <h2 className="text-2xl font-semibold text-zinc-100">{selectedAsset.name}</h2>
                              </div>
                              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{selectedAsset.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAssetDelete(selectedAsset.id)}
                              className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:border-red-500/60 hover:bg-red-950/30 hover:text-red-200"
                            >
                              删除资产
                            </button>
                          </div>

                          <div className="grid grid-cols-[190px_1fr] gap-5">
                            <div>
                              <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-emerald-700/60 bg-emerald-950/25 text-3xl font-semibold text-emerald-100">
                                {assetInitials(selectedAsset.name)}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-zinc-500">
                                主体裁切：从当前 16:9 状态图裁出，可人工调整构图。
                              </p>
                              <button
                                type="button"
                                className="mt-3 w-full rounded-md bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-950 transition hover:bg-white"
                              >
                                调整裁切
                              </button>
                            </div>

                            <div>
                              <div className="grid grid-cols-2 gap-3">
                                <label className="block">
                                  <span className="mb-1 block text-xs text-zinc-500">标准名</span>
                                  <input
                                    value={selectedAsset.name}
                                    onChange={(event) => handleAssetUpdate(selectedAsset.id, "name", event.target.value)}
                                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-700"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-zinc-500">出现集数</span>
                                  <input
                                    value={episodeLabel(selectedAsset.appearsIn)}
                                    onChange={(event) => {
                                      const next = parseEpisodeLabel(event.target.value);
                                      handleAssetUpdate(selectedAsset.id, "appearsIn", next);
                                    }}
                                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-700"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-zinc-500">别名</span>
                                  <input
                                    value={selectedAsset.aliases.join("，")}
                                    onChange={(event) => handleAssetUpdate(selectedAsset.id, "aliases", event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean))}
                                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-700"
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1 block text-xs text-zinc-500">关联资产</span>
                                  <input
                                    value={selectedAsset.linkedTo.join("，")}
                                    onChange={(event) => handleAssetUpdate(selectedAsset.id, "linkedTo", event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean))}
                                    className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-700"
                                  />
                                </label>
                              </div>
                              <label className="mt-3 block">
                                <span className="mb-1 block text-xs text-zinc-500">描述</span>
                                <textarea
                                  value={selectedAsset.description}
                                  onChange={(event) => handleAssetUpdate(selectedAsset.id, "description", event.target.value)}
                                  className="min-h-20 w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm leading-6 text-zinc-200 outline-none focus:border-emerald-700"
                                />
                              </label>
                            </div>
                          </div>

                          <div className="mt-7">
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-zinc-100">视觉连续性</h3>
                              <button
                                type="button"
                                onClick={() => handleAssetUpdate(selectedAsset.id, "stateTimeline", [
                                  ...selectedAsset.stateTimeline,
                                  { fromEpisode: contextEpisodeNumber, state: "填写这个状态的16:9资产图描述", change: "新状态", trigger: "人工新增" },
                                ])}
                                className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
                              >
                                添加状态
                              </button>
                            </div>
                            <div className="space-y-3">
                              {selectedAsset.stateTimeline.map((point, index) => {
                                const key = stateKey(selectedAsset.id, point, index);
                                const boundCount = assets?.productionUnits.filter((unit) =>
                                  unit.refs.some((ref) => ref.assetId === selectedAsset.id && ref.stateEpisode === point.fromEpisode)
                                ).length ?? 0;
                                return (
                                  <div
                                    key={key}
                                    className={`rounded-lg border p-3 transition ${
                                      selectedAssetStateEntry?.key === key ? "border-emerald-500/60 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900/30"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedAssetStateKey(key);
                                        setContextEpisodeNumber(point.fromEpisode);
                                      }}
                                      className="grid w-full grid-cols-[minmax(240px,34%)_1fr] gap-4 text-left"
                                    >
                                      <div className="flex aspect-video items-center justify-center rounded-lg border border-emerald-700/50 bg-emerald-950/25 text-sm font-semibold text-emerald-100">
                                        16:9 状态图
                                      </div>
                                      <div>
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                          <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-emerald-300">E{point.fromEpisode}</span>
                                          {point.change && <span className="rounded bg-amber-950/40 px-2 py-1 text-xs text-amber-200">{point.change}</span>}
                                          {boundCount > 0 && <span className="rounded bg-sky-950/60 px-2 py-1 text-xs text-sky-200">已绑定 {boundCount}</span>}
                                        </div>
                                        <textarea
                                          value={point.state}
                                          onClick={(event) => event.stopPropagation()}
                                          onChange={(event) => {
                                            const next = selectedAsset.stateTimeline.map((item, i) => i === index ? { ...item, state: event.target.value } : item);
                                            handleAssetUpdate(selectedAsset.id, "stateTimeline", next);
                                          }}
                                          className="min-h-16 w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm leading-6 text-zinc-300 outline-none focus:border-emerald-700"
                                        />
                                      </div>
                                    </button>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedAssetStateKey(key);
                                          setContextEpisodeNumber(point.fromEpisode);
                                        }}
                                        className="rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-white"
                                      >
                                        生成此状态
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedAssetStateKey(key);
                                          setContextEpisodeNumber(point.fromEpisode);
                                          setStateBindPickerKey((current) => current === key ? null : key);
                                        }}
                                        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
                                      >
                                        绑定到组合
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAssetUpdate(selectedAsset.id, "stateTimeline", selectedAsset.stateTimeline.filter((_, i) => i !== index))}
                                        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-500 transition hover:border-red-800 hover:bg-red-950/20 hover:text-red-200"
                                      >
                                        删除状态
                                      </button>
                                      {assets?.productionUnits.filter((unit) =>
                                        unit.refs.some((ref) => ref.assetId === selectedAsset.id && ref.stateEpisode === point.fromEpisode)
                                      ).map((unit) => (
                                        <button
                                          key={`${key}-${unit.id}`}
                                          type="button"
                                          onClick={() => {
                                            setSelectedAssetStateKey(key);
                                            setSelectedBoundSceneId(unit.id);
                                          }}
                                          className="rounded-md border border-sky-800 bg-sky-950/30 px-2.5 py-1.5 text-xs text-sky-200 transition hover:border-sky-600"
                                        >
                                          {unit.sceneName}
                                        </button>
                                      ))}
                                    </div>
                                    {stateBindPickerKey === key && (
                                      <div className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/20 p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                          <span className="text-xs font-medium text-sky-100">选择要绑定的场面组合</span>
                                          <span className="text-xs text-zinc-500">{assets?.productionUnits.length ?? 0} 个</span>
                                        </div>
                                        <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                                          {assets?.productionUnits.map((unit) => {
                                            const existingRef = unit.refs.find((ref) => ref.assetId === selectedAsset.id);
                                            const isThisState = existingRef?.stateEpisode === point.fromEpisode;
                                            return (
                                              <button
                                                key={`${key}-bind-${unit.id}`}
                                                type="button"
                                                onClick={() => bindAssetStateToProductionUnit(unit.id, selectedAsset, point, selectedAssetType)}
                                                className={[
                                                  "w-full rounded-md border p-2 text-left transition",
                                                  isThisState
                                                    ? "border-emerald-600/60 bg-emerald-950/25"
                                                    : existingRef
                                                      ? "border-amber-700/60 bg-amber-950/20 hover:border-amber-500"
                                                      : "border-zinc-800 bg-zinc-900/70 hover:border-sky-700",
                                                ].join(" ")}
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="truncate text-xs text-zinc-200">{episodeLabel(unit.episodeRange) || "E?"} · {unit.sceneName}</span>
                                                  <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                                                    {isThisState ? "已绑定" : existingRef ? "更新状态" : "绑定"}
                                                  </span>
                                                </div>
                                                <p className="mt-1 line-clamp-1 text-[10px] text-zinc-500">{unit.note}</p>
                                              </button>
                                            );
                                          })}
                                          {(assets?.productionUnits.length ?? 0) === 0 && (
                                            <div className="rounded-md border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                                              还没有场面组合。先在左侧创建场面组合后再绑定状态。
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {selectedAsset.stateTimeline.length === 0 && (
                                <div className="rounded-lg border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">
                                  当前资产还没有视觉状态。可以添加状态后再生成对应 16:9 资产图。
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <aside className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-zinc-100">当前状态关系</h3>
                              <p className="mt-1 text-xs text-zinc-500">
                                {selectedAssetState ? `${stateLabel(selectedAssetState)} · ${selectedAssetState.change ?? "状态"}` : selectedAsset.name}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900"
                            >
                              新增关系
                            </button>
                          </div>

                          <div className="mb-3 grid grid-cols-4 gap-1 rounded-md bg-zinc-900/50 p-1">
                            {(["all", "characters", "scenes", "props"] as RelationFilter[]).map((filter) => (
                              <button
                                key={filter}
                                type="button"
                                onClick={() => setRelationFilter(filter)}
                                className={`rounded px-2 py-1.5 text-xs transition ${
                                  relationFilter === filter ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                                }`}
                              >
                                {relationFilterLabel(filter)}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-2">
                            {relatedAssets.map(({ ref, asset, type }) => (
                              <button
                                key={`${selectedBoundScene?.id}-${ref.assetId}-${ref.role}`}
                                type="button"
                                onClick={() => {
                                  if (!asset) return;
                                  setSelectedAssetId(asset.id);
                                  const targetTab = assetTabFromType(type);
                                  if (targetTab) setAssetTab(targetTab);
                                  const targetState = asset.stateTimeline.find((point) => point.fromEpisode === ref.stateEpisode) ?? asset.stateTimeline[0];
                                  if (targetState) {
                                    const targetIndex = asset.stateTimeline.findIndex((point) => point === targetState);
                                    setSelectedAssetStateKey(stateKey(asset.id, targetState, Math.max(targetIndex, 0)));
                                  }
                                }}
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-left transition hover:border-zinc-700"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-zinc-500">{ref.role}</span>
                                  <span className="text-xs text-zinc-600">{assetTypeLabel(type)}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <span className="truncate text-sm font-medium text-zinc-200">{asset?.name}</span>
                                  <span className="text-xs text-zinc-500">{ref.stateEpisode ? `E${ref.stateEpisode}` : "未指定"}</span>
                                </div>
                              </button>
                            ))}
                            {relatedAssets.length === 0 && (
                              <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs leading-5 text-zinc-500">
                                当前状态下没有{relationFilterLabel(relationFilter)}关系。切换视觉状态或制作组合后，这里会跟着更新。
                              </div>
                            )}
                          </div>

                          <div className="mt-6">
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-zinc-100">绑定场面</h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-600">
                                  {selectedBoundSceneIndex >= 0 ? `${selectedBoundSceneIndex + 1}/${assetBoundScenes.length}` : "当前相关 0"}
                                </span>
                                <button
                                  type="button"
                                  disabled={assetBoundScenes.length <= 1}
                                  onClick={() => {
                                    if (assetBoundScenes.length <= 1) return;
                                    const nextIndex = (selectedBoundSceneIndex - 1 + assetBoundScenes.length) % assetBoundScenes.length;
                                    setSelectedBoundSceneId(assetBoundScenes[nextIndex].id);
                                  }}
                                  className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  上一个
                                </button>
                                <button
                                  type="button"
                                  disabled={assetBoundScenes.length <= 1}
                                  onClick={() => {
                                    if (assetBoundScenes.length <= 1) return;
                                    const nextIndex = (selectedBoundSceneIndex + 1) % assetBoundScenes.length;
                                    setSelectedBoundSceneId(assetBoundScenes[nextIndex].id);
                                  }}
                                  className="rounded border border-zinc-800 px-2 py-1 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  下一个
                                </button>
                              </div>
                            </div>

                            {selectedBoundScene ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setAssetTab("combos");
                                  selectProductionUnit(selectedBoundScene);
                                }}
                                className="w-full rounded-lg border border-sky-500/50 bg-sky-950/20 p-3 text-left transition hover:border-sky-500"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-zinc-500">{episodeLabel(selectedBoundScene.episodeRange)} · {selectedBoundScene.sceneName}</span>
                                  <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400">{selectedBoundScene.tasks[0]}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {selectedBoundScene.refs.slice(0, 4).map((ref) => (
                                    <span key={`${selectedBoundScene.id}-${ref.assetId}-${ref.role}`} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                                      {assets ? findAssetById(assets, ref.assetId)?.name ?? ref.role : ref.role}
                                      {ref.stateEpisode ? `@E${ref.stateEpisode}` : ""}
                                    </span>
                                  ))}
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{selectedBoundScene.note}</p>
                              </button>
                            ) : (
                              <div className="rounded-lg border border-dashed border-zinc-800 p-4 text-xs leading-5 text-zinc-500">
                                当前视觉状态还没有进入制作组合。可以先生成状态图，再绑定到某集某场。
                              </div>
                            )}
                          </div>

                          {selectedBoundScene && (
                            <div className="mt-5 rounded-lg border border-sky-900/50 bg-sky-950/20 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-zinc-100">绑定场面详情</h4>
                                <span className="rounded bg-sky-900/70 px-2 py-1 text-xs text-sky-100">{episodeLabel(selectedBoundScene.episodeRange)}</span>
                              </div>
                              <p className="text-xs text-zinc-500">{selectedBoundScene.sceneName} · {selectedBoundScene.tasks.join(" / ")}</p>
                              <div className="mt-3 space-y-2">
                                {selectedBoundSceneRefs.map(({ ref, asset, type }) => (
                                  <button
                                    key={`${selectedBoundScene.id}-${ref.assetId}-${ref.role}`}
                                    type="button"
                                    onClick={() => {
                                      if (!asset) return;
                                      setSelectedAssetId(asset.id);
                                      const targetTab = assetTabFromType(type);
                                      if (targetTab) setAssetTab(targetTab);
                                      const targetState = asset.stateTimeline.find((point) => point.fromEpisode === ref.stateEpisode) ?? asset.stateTimeline[0];
                                      if (targetState) {
                                        const targetIndex = asset.stateTimeline.findIndex((point) => point === targetState);
                                        setSelectedAssetStateKey(stateKey(asset.id, targetState, Math.max(targetIndex, 0)));
                                      }
                                    }}
                                    className="w-full rounded-md bg-zinc-950 px-2.5 py-2 text-left transition hover:bg-zinc-900"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm text-zinc-200">{asset?.name}</span>
                                      <span className="text-xs text-zinc-600">{ref.role}</span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                                      {ref.stateEpisode ? `状态 E${ref.stateEpisode}` : "未指定状态"}
                                    </p>
                                  </button>
                                ))}
                              </div>
                              <p className="mt-3 text-xs leading-5 text-zinc-400">{selectedBoundScene.note}</p>
                            </div>
                          )}
                        </aside>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">
                        当前分类还没有可编辑资产。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {episodes.map((ep, idx) => (
                <div
                  key={`episode-anchor-${ep.index}`}
                  ref={(el) => {
                    episodeRefs.current[idx] = el;
                  }}
                  className="h-0 overflow-hidden"
                  aria-hidden="true"
                />
              ))}
              {episodes[activeEpisode] && (
                <div
                  key={episodes[activeEpisode].index}
                  className="rounded-xl border border-emerald-600/40 bg-zinc-900/60 p-4 transition-colors"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-zinc-100">{episodes[activeEpisode].title}</h3>
                    {showHighlightedScript && (
                      <button
                        type="button"
                        onClick={() => setScriptEditMode((v) => !v)}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                          scriptEditMode
                            ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                            : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                        }`}
                      >
                        {scriptEditMode ? "完成编辑" : "编辑正文"}
                      </button>
                    )}
                  </div>
                  {(!showHighlightedScript || scriptEditMode) ? (
                    <textarea
                      value={episodes[activeEpisode].content}
                      onFocus={() => {
                        setContextEpisodeNumber(episodes[activeEpisode].index);
                      }}
                      onChange={(event) => handleEpisodeContentChange(activeEpisode, event.target.value)}
                      className="min-h-[calc(100dvh-190px)] w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3 text-sm leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-600/70 focus:bg-zinc-950"
                    />
                  ) : (
                    <HighlightedScript
                      content={episodes[activeEpisode].content}
                      assets={assets}
                      episodeNumber={episodes[activeEpisode].index}
                      hoveredAssetId={hoveredAssetId}
                      selectedAssetId={selectedAssetId}
                      issues={activeEpisodeIssues}
                      focusedIssueId={focusedIssueId}
                      issueActionBusyId={rewritingIssueId}
                      onIssueAction={handleIssueAction}
                      onKeywordHover={(id) => setHoveredAssetId(id)}
                      onKeywordLeave={() => setHoveredAssetId(null)}
                      onKeywordClick={(assetId, epNumber) => {
                        setSelectedAssetId(assetId);
                        setContextEpisodeNumber(epNumber);

                        if (assets) {
                          if (assets.characters.some((c) => c.id === assetId)) {
                            setAssetTab("characters");
                            setWorkspaceView("assetLibrary");
                          } else if (assets.scenes.some((s) => s.id === assetId)) {
                            setAssetTab("scenes");
                            setWorkspaceView("assetLibrary");
                          } else if (assets.props.some((p) => p.id === assetId)) {
                            setAssetTab("props");
                            setWorkspaceView("assetLibrary");
                          }
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </div>
            )}
          </main>

          {/* 右栏：四模块过滤 -> 最终资产处理 -> 资产快速面板。 */}
          {workspaceView !== "assetLibrary" && (
          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950">
            <div className="px-4 pb-2 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    {assets ? "资产处理" : "四模块过滤"}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {assets ? (assetsNeedRefresh ? "资产需基于当前剧本刷新" : "场面组合 / 资产快速面板") : modulesCompleted ? "已生成模块结果" : "诊断与改写"}
                  </p>
                </div>
                {assets && (
                  <button
                    type="button"
                    onClick={() => {
                      if (assetTab === "combos") setWorkspaceView("assetLibrary");
                      else openAssetLibrary(assetTab);
                    }}
                    className="rounded-md border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                  >
                    进入资产库
                  </button>
                )}
              </div>
              {assets && (
                <div className="flex border-b border-zinc-800">
                  {(["combos", "characters", "scenes", "props"] as const).map((tab) => {
                    const labels = { combos: "场面组合", characters: "角色", scenes: "场景", props: "道具" };
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setAssetTab(tab)}
                        className={`flex-1 border-b-2 py-2 text-center text-xs transition-colors ${
                          assetTab === tab
                            ? "border-emerald-500 bg-emerald-600/20 text-emerald-400"
                            : "border-transparent text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="overflow-y-auto px-4 py-3">
              {!assets ? (
                <>
                  <div className="mx-4 mb-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                    <p className="text-xs font-semibold text-zinc-200">{finalScriptReady ? "当前剧本已采用改写版" : "可随时基于当前剧本提取资产"}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                      每次采用改写或 AI 局部修改后，都可以刷新资产与场面组合。
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleExtractAssets()}
                      disabled={extracting}
                      className="mt-3 w-full rounded-lg bg-sky-600 py-2 text-xs font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {extracting ? "正在处理…" : "提取当前剧本资产"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  {assetsNeedRefresh && (
                    <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-3">
                      <p className="text-xs font-semibold text-amber-100">资产需要刷新</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-200/70">
                        当前剧本已变化，刷新会重新识别资产和场面组合，并尽量保留同名资产的参考图。
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleExtractAssets()}
                        disabled={extracting}
                        className="mt-3 w-full rounded-lg bg-amber-600 py-2 text-xs font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {extracting ? "刷新中..." : "刷新资产"}
                      </button>
                    </div>
                  )}
                  {assetTab === "combos" && (
                    <>
                      <button
                        type="button"
                        onClick={handleProductionUnitAdd}
                        className="w-full rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                      >
                        新增场面组合
                      </button>
                      {assets.productionUnits.map((unit) => {
                        const isSelected = selectedProductionUnitId === unit.id;
                        const isDragging = draggingProductionUnitId === unit.id;
                        const isDragTarget = Boolean(draggingProductionUnitId && dragOverProductionUnitId === unit.id && draggingProductionUnitId !== unit.id);
                        return (
                          <div
                            key={unit.id}
                            role="button"
                            tabIndex={0}
                            draggable
                            onClick={() => {
                              selectProductionUnit(unit);
                              const episode = unit.episodeRange[0];
                              if (episode) {
                                const idx = episodes.findIndex((ep) => ep.index === episode);
                                if (idx >= 0) scrollToEpisode(idx);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                selectProductionUnit(unit);
                              }
                            }}
                            onDragStart={() => {
                              setDraggingProductionUnitId(unit.id);
                              setDragOverProductionUnitId(unit.id);
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                              if (draggingProductionUnitId && draggingProductionUnitId !== unit.id) {
                                setDragOverProductionUnitId(unit.id);
                              }
                            }}
                            onDragEnter={() => {
                              if (draggingProductionUnitId && draggingProductionUnitId !== unit.id) {
                                setDragOverProductionUnitId(unit.id);
                              }
                            }}
                            onDrop={() => {
                              if (draggingProductionUnitId) moveProductionUnit(draggingProductionUnitId, unit.id);
                              clearProductionUnitDragState();
                            }}
                            onDragEnd={clearProductionUnitDragState}
                            className={[
                              "relative cursor-pointer rounded-xl border p-3 transition",
                              isSelected ? "border-sky-500/60 bg-sky-950/20" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",
                              isDragging ? "opacity-45" : "",
                              isDragTarget ? "translate-y-1 border-emerald-500/70 bg-emerald-950/20" : "",
                            ].join(" ")}
                          >
                            {isDragTarget && (
                              <div className="absolute -top-2 left-3 right-3 h-1 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.55)]" />
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="grid grid-cols-[64px_1fr] gap-2">
                                  <input
                                    value={episodeLabel(unit.episodeRange)}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => handleProductionUnitEpisodesChange(unit.id, event.target.value)}
                                    placeholder="E?"
                                    className="rounded bg-zinc-800 px-2 py-1 text-xs text-sky-200 outline-none focus:ring-1 focus:ring-sky-700"
                                  />
                                  <input
                                    value={unit.sceneName}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={(event) => handleProductionUnitUpdate(unit.id, { sceneName: event.target.value })}
                                    placeholder="场面名称"
                                    className="min-w-0 rounded bg-transparent px-1 py-1 text-sm font-semibold text-zinc-100 outline-none focus:bg-zinc-900 focus:ring-1 focus:ring-zinc-700"
                                  />
                                </div>
                                <textarea
                                  value={unit.note}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => handleProductionUnitUpdate(unit.id, { note: event.target.value })}
                                  rows={2}
                                  placeholder="填写场面说明"
                                  className="mt-2 w-full resize-none rounded bg-transparent text-xs leading-5 text-zinc-400 outline-none focus:bg-zinc-900 focus:ring-1 focus:ring-zinc-700"
                                />
                              </div>
                              <div className="flex shrink-0 flex-col gap-1">
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-center text-[10px] text-zinc-400">拖动</span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleProductionUnitDelete(unit.id);
                                  }}
                                  className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-500 transition hover:bg-red-950/40 hover:text-red-200"
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {unit.refs.slice(0, 5).map((ref) => (
                                <span key={`${unit.id}-${ref.assetId}-${ref.role}`} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                                  {ref.role}{ref.stateEpisode ? `@E${ref.stateEpisode}` : ""}
                                </span>
                              ))}
                              {unit.refs.length === 0 && (
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">暂无绑定资产</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {assets.productionUnits.length === 0 && (
                        <p className="text-xs text-zinc-500">未生成场面组合，可点击新增手动创建。</p>
                      )}
                    </>
                  )}
                  {assetTab === "characters" &&
                    assets.characters.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        type="character"
                        isHighlighted={hoveredAssetId === asset.id}
                        isSelected={selectedAssetId === asset.id}
                        currentEpisodeNumber={contextEpisodeNumber}
                        onEpisodeClick={(epNumber) => {
                          let idx = episodes.findIndex((ep) => ep.index === epNumber);
                          if (idx < 0) idx = Math.min(epNumber - 1, episodes.length - 1);
                          if (idx >= 0) scrollToEpisode(idx);
                          setContextEpisodeNumber(epNumber);
                        }}
                        onSelect={() => handleAssetSelect(asset)}
                        onHoverEnter={(id) => setHoveredAssetId(id)}
                        onHoverLeave={() => setHoveredAssetId(null)}
                        onUpdate={handleAssetUpdate}
                        onDelete={handleAssetDelete}
                      />
                    ))}
                  {assetTab === "characters" && assets.characters.length === 0 && (
                    <p className="text-xs text-zinc-500">未识别到角色</p>
                  )}

                  {assetTab === "scenes" &&
                    assets.scenes.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        type="scene"
                        isHighlighted={hoveredAssetId === asset.id}
                        isSelected={selectedAssetId === asset.id}
                        currentEpisodeNumber={contextEpisodeNumber}
                        onEpisodeClick={(epNumber) => {
                          let idx = episodes.findIndex((ep) => ep.index === epNumber);
                          if (idx < 0) idx = Math.min(epNumber - 1, episodes.length - 1);
                          if (idx >= 0) scrollToEpisode(idx);
                          setContextEpisodeNumber(epNumber);
                        }}
                        onSelect={() => handleAssetSelect(asset)}
                        onHoverEnter={(id) => setHoveredAssetId(id)}
                        onHoverLeave={() => setHoveredAssetId(null)}
                        onUpdate={handleAssetUpdate}
                        onDelete={handleAssetDelete}
                      />
                    ))}
                  {assetTab === "scenes" && assets.scenes.length === 0 && (
                    <p className="text-xs text-zinc-500">未识别到场景</p>
                  )}

                  {assetTab === "props" &&
                    assets.props.map((asset) => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        type="prop"
                        isHighlighted={hoveredAssetId === asset.id}
                        isSelected={selectedAssetId === asset.id}
                        currentEpisodeNumber={contextEpisodeNumber}
                        onEpisodeClick={(epNumber) => {
                          let idx = episodes.findIndex((ep) => ep.index === epNumber);
                          if (idx < 0) idx = Math.min(epNumber - 1, episodes.length - 1);
                          if (idx >= 0) scrollToEpisode(idx);
                          setContextEpisodeNumber(epNumber);
                        }}
                        onSelect={() => handleAssetSelect(asset)}
                        onHoverEnter={(id) => setHoveredAssetId(id)}
                        onHoverLeave={() => setHoveredAssetId(null)}
                        onUpdate={handleAssetUpdate}
                        onDelete={handleAssetDelete}
                      />
                    ))}
                  {assetTab === "props" && assets.props.length === 0 && (
                    <p className="text-xs text-zinc-500">未识别到道具</p>
                  )}
                </div>
              )}
            </div>
            <OptimizeModulesPanel
              episodes={episodes}
              assets={assets}
              settings={settings}
              onFinalEpisodesReady={handleFinalEpisodesReady}
              onModulesComplete={handleModulesComplete}
              onIssuesUpdate={(issues) => {
                setDiagnosticIssues(issues);
                setPacingBeatFocusIssue(null);
              }}
              onIssueFocus={handleIssueFocus}
              onPacingBeatFocus={handlePacingBeatFocus}
              onIssueAction={handleIssueAction}
              issueActionBusyId={rewritingIssueId}
              issueStatuses={issueStatuses}
              onIssueRestore={handleIssueRestore}
              onOpenPacingDetail={handleOpenPacingDetail}
              activeEpisode={episodes[activeEpisode]?.index}
              extraPacingIssues={adoptedPacingIssues}
              onRemoveExtraPacingIssue={(id) => setAdoptedPacingIssues((prev) => prev.filter((i) => i.id !== id))}
              pacingEpisodeUpdate={pacingEpisodeUpdate}
              activeEpisodeIsStaleForPacing={activeEpisodeIsStaleForPacing}
              onReanalyzePacingEpisode={handleReanalyzePacingEpisode}
              reanalyzingPacingEpisode={reanalyzingPacingEpisode}
              onApplyLocalizeEpisode={handleApplyLocalizeEpisode}
            />
          </aside>
          )}
        </div>
      )}
      {pacingDetailResult && (
        <div className={showPacingDetail ? "" : "hidden"}>
          <PacingDetailPanel
            result={pacingDetailResult}
            onClose={() => setShowPacingDetail(false)}
            episodes={episodes}
            settings={settings}
            onResultUpdate={(updated) => setPacingDetailResult(updated)}
            onAdoptIssue={handleAdoptPacingIssue}
            contentSnapshot={pacingContentSnapshot}
          />
        </div>
      )}
    </div>
  );
}
