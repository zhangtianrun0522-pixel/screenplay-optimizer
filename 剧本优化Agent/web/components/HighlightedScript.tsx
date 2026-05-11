'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface StateKeyframe {
  fromEpisode: number;
  state: string;
  trigger?: string;
}

interface BaseAsset {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  appearsIn: number[];
  stateTimeline: StateKeyframe[];
  linkedTo: string[];
  referenceImages: unknown[];
}

interface Character extends BaseAsset {
  emotionTags: string[];
}

type AssetItem = Character | BaseAsset;

interface Assets {
  characters: AssetItem[];
  scenes: AssetItem[];
  props: AssetItem[];
}

interface HighlightedScriptProps {
  content: string;
  assets: Assets | null;
  episodeNumber: number;
  hoveredAssetId: string | null;
  selectedAssetId: string | null;
  onKeywordHover: (assetId: string) => void;
  onKeywordLeave: () => void;
  onKeywordClick: (assetId: string, episodeNumber: number) => void;
  issues?: DiagnosticIssue[];
  focusedIssueId?: string | null;
  issueActionLabel?: string;
  issueActionDisabled?: boolean;
  issueActionBusyId?: string | null;
  onIssueAction?: (issueId: string, action: 'ai' | 'ignore', options?: IssueActionOptions) => void;
}

interface DiagnosticIssue {
  id: string;
  textSnippet: string;
  severity: '高' | '中' | '低';
  type: string;
  description: string;
  suggestion: string;
  fixOptions?: IssueFixOptionInput[];
}

interface Segment {
  text: string;
  assetId?: string;
  assetType?: keyof Assets;
  issueId?: string;
}

interface IssueActionOptions {
  selectedSuggestion?: string;
  targetEpisode?: number;
  userCorrection?: string;
}

interface IssueFixOption {
  id: string;
  label: string;
  text: string;
  targetEpisode?: number;
  rationale?: string;
  recommended?: boolean;
}

interface IssueFixOptionInput {
  label?: string;
  suggestion?: string;
  text?: string;
  targetEpisode?: number;
  rationale?: string;
  recommended?: boolean;
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\p{Script=Han}]/gu, '');
}

function normalizeForMatch(value: string) {
  return Array.from(value).map(normalizeToken).join('');
}

function buildNormalizedIndex(content: string) {
  const indexMap: number[] = [];
  let normalizedContent = '';

  Array.from(content).forEach((char, index) => {
    const normalized = normalizeToken(char);
    if (!normalized) return;
    normalizedContent += normalized;
    for (let i = 0; i < normalized.length; i += 1) indexMap.push(index);
  });

  return { normalizedContent, indexMap };
}

function rangeFromNormalizedIndex(indexMap: number[], start: number, length: number) {
  const originalStart = indexMap[start];
  const originalEnd = (indexMap[start + length - 1] ?? originalStart) + 1;
  if (originalStart === undefined || originalEnd <= originalStart) return null;
  return { start: originalStart, end: originalEnd };
}

function snippetChunks(snippet: string) {
  const chunks = snippet
    .split(/[\s"'“”‘’<>《》【】[\]()（）{}，。！？、,.!?:：；;|｜/\\\-—_]+/u)
    .map(normalizeForMatch)
    .filter((chunk) => chunk.length >= 4);

  return Array.from(new Set(chunks)).sort((a, b) => b.length - a.length);
}

function findSnippetRange(content: string, snippet: string) {
  const exactIndex = content.indexOf(snippet);
  if (exactIndex >= 0) return { start: exactIndex, end: exactIndex + snippet.length };

  const normalizedSnippet = normalizeForMatch(snippet);
  if (!normalizedSnippet) return null;

  const { normalizedContent, indexMap } = buildNormalizedIndex(content);

  const fuzzyIndex = normalizedContent.indexOf(normalizedSnippet);
  if (fuzzyIndex >= 0) {
    return rangeFromNormalizedIndex(indexMap, fuzzyIndex, normalizedSnippet.length);
  }

  for (const chunk of snippetChunks(snippet)) {
    const chunkIndex = normalizedContent.indexOf(chunk);
    if (chunkIndex >= 0) {
      return rangeFromNormalizedIndex(indexMap, chunkIndex, chunk.length);
    }
  }

  for (const fallbackLength of [18, 12, 8, 6]) {
    if (normalizedSnippet.length < fallbackLength) continue;
    const fallback = Array.from(normalizedSnippet).slice(0, fallbackLength).join('');
    const fallbackIndex = normalizedContent.indexOf(fallback);
    if (fallbackIndex >= 0) {
      return rangeFromNormalizedIndex(indexMap, fallbackIndex, fallback.length);
    }
  }

  return null;
}

function trimSuggestion(value: string) {
  return value.replace(/^[\s：:，,；;、]+|[\s。；;，,]+$/g, '').trim();
}

function targetEpisodeFromSuggestion(value: string) {
  const match = value.match(/第\s*(\d+)\s*集/u);
  return match ? Number(match[1]) : undefined;
}

function suggestionOptions(issue: DiagnosticIssue, singleOptionLabel: string): IssueFixOption[] {
  const structuredOptions = issue.fixOptions
    ?.reduce<IssueFixOption[]>((options, option, index) => {
      const text = trimSuggestion(option.suggestion ?? option.text ?? '');
      if (!text) return options;
      options.push({
        id: `${index}`,
        label: option.label?.trim() || `方案 ${String.fromCharCode(65 + index)}`,
        text,
        targetEpisode: option.targetEpisode ?? targetEpisodeFromSuggestion(text),
        rationale: option.rationale,
        recommended: option.recommended,
      });
      return options;
    }, []);

  if (structuredOptions?.length) return structuredOptions;

  const suggestion = issue.suggestion;
  const cleaned = trimSuggestion(suggestion);
  if (!cleaned) return [];

  const colonIndex = cleaned.search(/[：:]/u);
  const body = colonIndex >= 0 ? cleaned.slice(colonIndex + 1) : cleaned;
  const parts = body
    .split(/(?:[，,；;]\s*)?或(?:者)?/u)
    .map(trimSuggestion)
    .filter(Boolean);
  const optionTexts = parts.length > 1 ? parts : [cleaned];

  return optionTexts.map((text, index) => ({
    id: `${index}`,
    label: optionTexts.length > 1 ? `方案 ${String.fromCharCode(65 + index)}` : singleOptionLabel,
    text,
    targetEpisode: targetEpisodeFromSuggestion(text),
  }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordVariants(keyword: string): string[] {
  const base = keyword.trim();
  if (!base) return [];

  const variants = new Set<string>([base]);
  const withoutBrackets = base
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/【[^】]*】/g, '')
    .trim();
  if (withoutBrackets) variants.add(withoutBrackets);

  const withoutScenePrefix = withoutBrackets
    .replace(/^(?:内景|外景|场景|地点)[：:：\s-]*/u, '')
    .replace(/[｜|/].*$/u, '')
    .trim();
  if (withoutScenePrefix) variants.add(withoutScenePrefix);

  const withoutTime = withoutScenePrefix
    .replace(/(?:白天|夜晚|清晨|傍晚|深夜|日|夜)$/u, '')
    .replace(/[，,、\s-]+$/u, '')
    .trim();
  if (withoutTime) variants.add(withoutTime);

  return Array.from(variants).filter((item) => item.length >= 2);
}

function assetClasses(type?: keyof Assets, active?: boolean): string {
  if (type === 'characters') {
    return active
      ? 'bg-emerald-500/20 text-emerald-300 underline decoration-emerald-300'
      : 'underline decoration-dotted decoration-emerald-500/70 text-zinc-100 hover:bg-emerald-500/10';
  }
  if (type === 'scenes') {
    return active
      ? 'bg-sky-500/20 text-sky-300 underline decoration-sky-300'
      : 'underline decoration-dotted decoration-sky-500/70 text-sky-100 hover:bg-sky-500/10';
  }
  return active
    ? 'bg-amber-500/20 text-amber-300 underline decoration-amber-300'
    : 'underline decoration-dotted decoration-amber-500/70 text-amber-100 hover:bg-amber-500/10';
}

export default function HighlightedScript({
  content,
  assets,
  episodeNumber,
  hoveredAssetId,
  selectedAssetId,
  onKeywordHover,
  onKeywordLeave,
  onKeywordClick,
  issues = [],
  focusedIssueId = null,
  issueActionLabel = 'AI修改',
  issueActionDisabled = false,
  issueActionBusyId = null,
  onIssueAction,
}: HighlightedScriptProps) {
  const issueRefs = useRef(new Map<string, HTMLButtonElement>());
  const [issueCorrections, setIssueCorrections] = useState<Record<string, string>>({});
  const [calloutPlacements, setCalloutPlacements] = useState<Record<string, 'above' | 'below'>>({});
  const { keywordToAsset, keywords } = useMemo(() => {
    const keywordToAsset = new Map<string, { id: string; type: keyof Assets }>();
    const keywords: string[] = [];

    if (!assets) return { keywordToAsset, keywords };

    const allAssets: { type: keyof Assets; asset: AssetItem }[] = [
      ...assets.characters.map((asset) => ({ type: 'characters' as const, asset })),
      ...assets.scenes.map((asset) => ({ type: 'scenes' as const, asset })),
      ...assets.props.map((asset) => ({ type: 'props' as const, asset })),
    ];

    for (const { type, asset } of allAssets) {
      for (const rawKeyword of [asset.name, ...asset.aliases]) {
        for (const keyword of keywordVariants(rawKeyword)) {
        const normalized = keyword.toLowerCase();
        if (!keywordToAsset.has(normalized)) {
          keywordToAsset.set(normalized, { id: asset.id, type });
          keywords.push(keyword);
        }
      }
      }
    }

    keywords.sort((a, b) => b.length - a.length);
    return { keywordToAsset, keywords };
  }, [assets]);

  const [calloutIssueId, setCalloutIssueId] = useState<string | null>(null);

  const updateCalloutPlacement = (issueId: string) => {
    const element = issueRefs.current.get(issueId);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const availableAbove = rect.top;
    const availableBelow = window.innerHeight - rect.bottom;
    const preferredHeight = 520;
    const placement = availableBelow < preferredHeight && availableAbove > availableBelow ? 'above' : 'below';
    setCalloutPlacements((prev) => ({ ...prev, [issueId]: placement }));
  };

  useEffect(() => {
    if (!calloutIssueId) return;
    const close = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.diagnostic-callout')) return;
      setCalloutIssueId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [calloutIssueId]);

  useEffect(() => {
    if (!focusedIssueId) return;
    const element = issueRefs.current.get(focusedIssueId);
    if (!element) return;

    const frame = window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      element.focus({ preventScroll: true });
      updateCalloutPlacement(focusedIssueId);
      setCalloutIssueId(focusedIssueId);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedIssueId, content]);

  const segments = useMemo<Segment[]>(() => {
    type Mark =
      | { start: number; end: number; kind: 'issue'; issueId: string }
      | { start: number; end: number; kind: 'asset'; assetId: string; assetType: keyof Assets };

    const marks: Mark[] = [];

    for (const issue of issues) {
      const snippet = issue.textSnippet.trim();
      if (!snippet) continue;
      const range = findSnippetRange(content, snippet);
      if (range) {
        marks.push({ start: range.start, end: range.end, kind: 'issue', issueId: issue.id });
      }
    }

    if (keywords.length > 0) {
      const pattern = keywords.map(escapeRegExp).join('|');
      const regex = new RegExp(`(${pattern})`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        const matchedText = match[0];
        const asset = keywordToAsset.get(matchedText.toLowerCase());
        if (asset) {
          marks.push({
            start: match.index,
            end: match.index + matchedText.length,
            kind: 'asset',
            assetId: asset.id,
            assetType: asset.type,
          });
        }
        if (matchedText.length === 0) regex.lastIndex += 1;
      }
    }

    marks.sort((a, b) => a.start - b.start || (a.kind === 'issue' ? -1 : 1));

    const result: Segment[] = [];
    let coveredEnd = 0;
    for (const mark of marks) {
      if (mark.start < coveredEnd) continue;
      if (mark.start > coveredEnd) result.push({ text: content.slice(coveredEnd, mark.start) });
      if (mark.kind === 'issue') {
        result.push({ text: content.slice(mark.start, mark.end), issueId: mark.issueId });
      } else {
        result.push({ text: content.slice(mark.start, mark.end), assetId: mark.assetId, assetType: mark.assetType });
      }
      coveredEnd = mark.end;
    }
    if (coveredEnd < content.length) result.push({ text: content.slice(coveredEnd) });

    return result.length > 0 ? result : [{ text: content }];
  }, [content, keywordToAsset, keywords, issues]);

  return (
    <span className="relative whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
      {segments.map((segment, index) => {
        if (segment.issueId) {
          const issue = issues.find((item) => item.id === segment.issueId);
          if (!issue) return <span key={`plain-${index}`}>{segment.text}</span>;
          const issueId = segment.issueId;
          const fixOptions = suggestionOptions(issue, issueActionLabel);
          const correction = issueCorrections[issue.id] ?? '';
          const severityClass = issue.severity === '高'
            ? 'decoration-red-400'
            : issue.severity === '中'
              ? 'decoration-orange-400'
              : 'decoration-yellow-400';
          const isFocused = focusedIssueId === issueId;
          const calloutPlacement = calloutPlacements[issueId] ?? 'below';
          return (
            <span key={`issue-${issueId}-${index}`} className="relative">
              <button
                type="button"
                ref={(element) => {
                  if (element) issueRefs.current.set(issueId, element);
                  else issueRefs.current.delete(issueId);
                }}
                data-diagnostic-issue-id={issueId}
                onClick={(event) => {
                  event.stopPropagation();
                  if (calloutIssueId === issueId) {
                    setCalloutIssueId(null);
                    return;
                  }
                  updateCalloutPlacement(issueId);
                  setCalloutIssueId(issueId);
                }}
                className={`inline cursor-pointer rounded-sm p-0 text-left underline decoration-wavy underline-offset-4 ${severityClass} ${
                  isFocused ? 'bg-amber-400/30 text-amber-50 ring-2 ring-amber-400/70 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]' : 'bg-transparent'
                }`}
              >
                {segment.text}
              </button>
              {calloutIssueId === issueId && (
                <span className={`diagnostic-callout absolute left-0 z-50 block w-[30rem] max-w-[min(30rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 text-xs shadow-2xl shadow-black/50 ${
                  calloutPlacement === 'above' ? 'bottom-full mb-3' : 'top-full mt-3'
                }`}>
                  <span className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/70 px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">{issue.severity}</span>
                      <span className="min-w-0 truncate font-medium text-amber-300">{issue.type}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-zinc-500">定位到正文片段</span>
                  </span>
                  <span className="block max-h-[28rem] overflow-y-auto p-3">
                    <span className="mb-3 block rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5">
                      <span className="mb-1 block text-[10px] font-medium text-zinc-500">问题判断</span>
                      <span className="block whitespace-normal break-words leading-5 text-zinc-200">{issue.description}</span>
                      <span className="mt-2 block whitespace-normal break-words leading-5 text-zinc-400">
                        {fixOptions.length > 1 ? '请选择一个明确的修改方向。' : `建议：${issue.suggestion}`}
                      </span>
                    </span>
                    <label className="mb-2 block">
                      <span className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-medium text-zinc-500">
                        <span>我的判断 / 纠正 AI 理解</span>
                        <span className="text-zinc-600">会作为独立修改要求提交</span>
                      </span>
                      <textarea
                        value={correction}
                        onChange={(event) => setIssueCorrections((prev) => ({ ...prev, [issue.id]: event.target.value }))}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        placeholder="例如：这里不是伤口位置矛盾，而是她故意用脖子伤疤误导Jake；请按这个理解修改。"
                        className="min-h-16 w-full resize-y rounded-md border border-zinc-800 bg-zinc-900/70 px-2.5 py-2 text-[11px] leading-5 text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-emerald-600/60"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!correction.trim() || issueActionDisabled || issueActionBusyId === issue.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        const userCorrection = correction.trim();
                        if (!userCorrection) return;
                        onIssueAction?.(issue.id, 'ai', {
                          selectedSuggestion: userCorrection,
                          userCorrection,
                        });
                      }}
                      className="mb-3 w-full rounded-md border border-emerald-600/60 bg-emerald-600 px-3 py-2 text-left text-[11px] font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/60 disabled:text-zinc-600"
                    >
                      {issueActionBusyId === issue.id ? '正在按你的判断修改...' : '提交我的修改要求'}
                    </button>
                    <span className="mb-2 block text-[10px] font-medium text-zinc-500">AI 推荐方案</span>
                    <span className="mb-3 grid gap-2">
                      {fixOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          disabled={issueActionDisabled || issueActionBusyId === issue.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            onIssueAction?.(issue.id, 'ai', {
                              selectedSuggestion: option.text,
                              targetEpisode: option.targetEpisode,
                              userCorrection: correction.trim() || undefined,
                            });
                          }}
                          className="group rounded-md border border-emerald-700/45 bg-emerald-950/35 px-3 py-2 text-left transition hover:border-emerald-500 hover:bg-emerald-900/45 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/60 disabled:text-zinc-500"
                        >
                          <span className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-emerald-200">
                              {issueActionBusyId === issue.id ? '修改中...' : option.label}
                            </span>
                            {option.recommended && (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-200">推荐</span>
                            )}
                            {option.targetEpisode && (
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">第{option.targetEpisode}集</span>
                            )}
                          </span>
                          <span className="block whitespace-normal break-words text-[11px] leading-5 text-emerald-50/90">
                            {option.text}
                          </span>
                          {option.rationale && (
                            <span className="mt-1.5 block whitespace-normal break-words text-[10px] leading-4 text-emerald-50/60">
                              {option.rationale}
                            </span>
                          )}
                          <span className="mt-2 inline-flex rounded border border-emerald-400/35 px-2 py-0.5 text-[10px] font-medium text-emerald-100 transition group-hover:border-emerald-300/70">
                            采用这个推荐方案
                          </span>
                        </button>
                      ))}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onIssueAction?.(issue.id, 'ignore');
                        setCalloutIssueId(null);
                      }}
                      className="w-full rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900"
                    >
                      忽略
                    </button>
                  </span>
                </span>
              )}
            </span>
          );
        }

        if (!segment.assetId) {
          return <span key={index}>{segment.text}</span>;
        }

        const isActive =
          segment.assetId === hoveredAssetId ||
          segment.assetId === selectedAssetId;

        return (
          <span
            key={`${segment.assetId}-${index}`}
            className={[
              'rounded px-0.5 cursor-pointer transition-colors',
              assetClasses(segment.assetType, isActive),
            ].join(' ')}
            onMouseEnter={() => onKeywordHover(segment.assetId!)}
            onMouseLeave={onKeywordLeave}
            onClick={(e) => { e.stopPropagation(); onKeywordClick(segment.assetId!, episodeNumber); }}
          >
            {segment.text}
          </span>
        );
      })}
    </span>
  );
}
