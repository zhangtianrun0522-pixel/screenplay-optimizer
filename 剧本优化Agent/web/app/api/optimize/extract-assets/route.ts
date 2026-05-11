import { NextResponse } from 'next/server';
import { resolveEffectiveSettings } from '@/lib/server-settings';

export const runtime = 'nodejs';

interface EpisodeInput {
  index: number;
  title: string;
  content: string;
}

interface Settings {
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface StateKeyframe {
  fromEpisode: number;
  state: string;
  change?: string;
  trigger?: string;
}

interface AssetNameSeed {
  name: string;
  aliases: string[];
}

interface CharacterAsset {
  name: string;
  aliases: string[];
  description: string;
  emotionTags: string[];
  appearsIn: number[];
  stateTimeline: StateKeyframe[];
  linkedTo: string[];
  portraitPrompt?: string;
}

interface BaseAsset {
  name: string;
  aliases: string[];
  description: string;
  appearsIn: number[];
  stateTimeline: StateKeyframe[];
  linkedTo: string[];
}

interface AppearanceEvent {
  episode: number;
  character: string;
  appearance: string;
  change: string;
  trigger: string;
  evidence: string;
}

function normalizeKeyframes(arr: unknown): StateKeyframe[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((k) => {
    const kf = k as Record<string, unknown>;
    return {
      fromEpisode: Number(kf.fromEpisode ?? 1),
      state: String(kf.state ?? ''),
      ...(kf.change ? { change: String(kf.change) } : {}),
      ...(kf.trigger ? { trigger: String(kf.trigger) } : {}),
    };
  });
}

async function callLLM(
  settings: Settings,
  messages: { role: 'user' | 'system' | 'assistant'; content: string }[],
  maxTokens: number,
  options?: { allowEmpty?: boolean },
): Promise<string> {
  const response = await fetch(settings.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({ model: settings.model, messages, max_tokens: maxTokens, temperature: 0 }),
  });

  if (!response.ok) {
    const errData = await response.text();
    let message = errData;
    try {
      const parsed = JSON.parse(errData) as { error?: { message?: string; code?: string; type?: string } | string; message?: string };
      if (typeof parsed.error === 'string') {
        message = parsed.error;
      } else {
        message = parsed.error?.message ?? parsed.message ?? errData;
      }
    } catch {
      // Keep upstream text when it is not JSON.
    }
    throw new Error(`LLM API error: ${message}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = data.choices?.[0];

  if (choice?.finish_reason === 'length') throw new Error('输出被截断，请缩短剧本或减少资产数量');

  const content = choice?.message?.content ?? '';
  if (!content && !options?.allowEmpty) throw new Error('模型返回内容为空，请检查 API 配置');

  return content.replace(/```json/g, '').replace(/```/g, '').trim();
}

const STATE_TIMELINE_RULES = `【stateTimeline——只记录视觉/外观/物理状态变化，供 AI 画图用】
✅ 角色：服装变化、发型变化、妆容、伤痕/绷带、饰品增减、年龄跨度、变装易容
✅ 场景：环境破坏/重建、布置大改动、时间段切换（繁华→废墟等）
✅ 道具：损坏、修复、改造、缺失
❌ 不记录：情绪变化、关系进展、心理变化
每帧字段：fromEpisode（从第几集起生效）、state（完整外观描述，供 AI 画图）、change（相比上一帧的具体变化，首帧填"初始外观"）、trigger（触发变化的剧情事件，首帧填"初始状态"）`;

function parseArray(raw: string, fallbackKey: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('JSON 解析失败');
    parsed = JSON.parse(match[0]);
  }
  if (Array.isArray(parsed)) return parsed;
  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj[fallbackKey])) return obj[fallbackKey] as unknown[];
  return [];
}

function toNameSeed(value: unknown): AssetNameSeed | null {
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? { name, aliases: [] } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const name = String(obj.name ?? '').trim();
  if (!name) return null;
  const aliases = Array.isArray(obj.aliases)
    ? obj.aliases.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
  return { name, aliases };
}

function uniqueSeeds(values: unknown[]): AssetNameSeed[] {
  const result: AssetNameSeed[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const seed = toNameSeed(value);
    if (!seed) continue;
    const key = seed.name.toLowerCase();
    if (seen.has(key)) {
      const existing = result.find((item) => item.name.toLowerCase() === key);
      if (existing) existing.aliases = Array.from(new Set([...existing.aliases, ...seed.aliases]));
      continue;
    }
    seen.add(key);
    result.push(seed);
  }
  return result;
}

function seedNames(seeds: AssetNameSeed[]): string[] {
  return seeds.map((s) => s.name);
}

function buildDiscoveryPrompt(script: string): string {
  return `扫完整个剧本，找出所有出现的角色、场景、道具名字。只返回资产名单，不要任何描述。

【场景特别规则】
- 按剧情真实地点合并，不要把同一地点的门口/室内/夜晚/白天/破坏后拆成多个场景。
- 同一地点的不同叫法放 aliases。

【角色特别规则】
- aliases 收录昵称、称谓、英文名、身份名等剧本中实际出现的叫法，方便后续高亮。

【道具特别规则】
- aliases 收录简称、外号、同一物品的不同叫法。

仅输出纯 JSON：{"characters":[{"name":"名字1","aliases":["别名"]}],"scenes":[{"name":"场景1","aliases":["简称"]}],"props":[{"name":"道具1","aliases":["简称"]}]}

剧本内容：
${script}`;
}

function parseDiscovery(raw: string): { characters: AssetNameSeed[]; scenes: AssetNameSeed[]; props: AssetNameSeed[] } {
  const parsed = JSON.parse(raw) as { characters?: unknown[]; scenes?: unknown[]; props?: unknown[] };
  return {
    characters: uniqueSeeds(Array.isArray(parsed.characters) ? parsed.characters : []),
    scenes: uniqueSeeds(Array.isArray(parsed.scenes) ? parsed.scenes : []),
    props: uniqueSeeds(Array.isArray(parsed.props) ? parsed.props : []),
  };
}

function mergeSeedLists(lists: AssetNameSeed[][]): AssetNameSeed[] {
  return uniqueSeeds(lists.flatMap((seed) => seed));
}

async function discoverAssetSeeds(
  settings: Settings,
  episodes: EpisodeInput[],
  formattedEpisodes: string,
  warnings: string[],
): Promise<{ characters: AssetNameSeed[]; scenes: AssetNameSeed[]; props: AssetNameSeed[] }> {
  try {
    const raw = await callLLM(settings, [{ role: 'user', content: buildDiscoveryPrompt(formattedEpisodes) }], 5000);
    return parseDiscovery(raw);
  } catch (e) {
    warnings.push(`整本资产名单扫描失败，已自动改为按集扫描：${e instanceof Error ? e.message : '未知错误'}`);
  }

  const characterLists: AssetNameSeed[][] = [];
  const sceneLists: AssetNameSeed[][] = [];
  const propLists: AssetNameSeed[][] = [];

  for (const ep of episodes) {
    try {
      const raw = await callLLM(
        settings,
        [{ role: 'user', content: buildDiscoveryPrompt(`=== 第${ep.index}集：${ep.title} ===\n${ep.content}`) }],
        3000,
      );
      const discovered = parseDiscovery(raw);
      characterLists.push(discovered.characters);
      sceneLists.push(discovered.scenes);
      propLists.push(discovered.props);
    } catch (e) {
      warnings.push(`第${ep.index}集资产名单扫描失败：${e instanceof Error ? e.message : '未知错误'}`);
    }
  }

  return {
    characters: mergeSeedLists(characterLists),
    scenes: mergeSeedLists(sceneLists),
    props: mergeSeedLists(propLists),
  };
}

function normalizeAssetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[【】「」『』（）()[\]\s]/g, '')
    .replace(/^(内景|外景|场景|地点)[:：-]?/u, '')
    .replace(/(白天|夜晚|清晨|傍晚|深夜|日|夜)$/u, '');
}

function mergeSeedAliases(name: string, aliases: unknown, seeds: AssetNameSeed[]): string[] {
  const fromModel = Array.isArray(aliases) ? aliases.map(String) : [];
  const seed = seeds.find((item) => normalizeAssetName(item.name) === normalizeAssetName(name));
  return Array.from(new Set([...fromModel, ...(seed?.aliases ?? [])].map((s) => s.trim()).filter(Boolean)));
}

function dedupeAssetsByName<T extends { name?: unknown; aliases?: unknown; appearsIn?: unknown; stateTimeline?: unknown; linkedTo?: unknown }>(
  list: T[],
): T[] {
  const result: T[] = [];
  const indexByKey = new Map<string, number>();
  for (const item of list) {
    const name = String(item.name ?? '').trim();
    if (!name) continue;
    const keys = [name, ...(Array.isArray(item.aliases) ? item.aliases.map(String) : [])]
      .map(normalizeAssetName)
      .filter(Boolean);
    const existingIndex = keys.map((key) => indexByKey.get(key)).find((idx) => idx !== undefined);
    if (existingIndex === undefined) {
      const idx = result.length;
      result.push(item);
      for (const key of keys) indexByKey.set(key, idx);
      continue;
    }

    const existing = result[existingIndex] as Record<string, unknown>;
    existing.aliases = Array.from(new Set([
      ...(Array.isArray(existing.aliases) ? existing.aliases.map(String) : []),
      ...(Array.isArray(item.aliases) ? item.aliases.map(String) : []),
      name,
    ].filter(Boolean)));
    existing.appearsIn = Array.from(new Set([
      ...(Array.isArray(existing.appearsIn) ? existing.appearsIn.map(Number) : []),
      ...(Array.isArray(item.appearsIn) ? item.appearsIn.map(Number) : []),
    ].filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
    existing.stateTimeline = [
      ...(Array.isArray(existing.stateTimeline) ? existing.stateTimeline : []),
      ...(Array.isArray(item.stateTimeline) ? item.stateTimeline : []),
    ];
    existing.linkedTo = Array.from(new Set([
      ...(Array.isArray(existing.linkedTo) ? existing.linkedTo.map(String) : []),
      ...(Array.isArray(item.linkedTo) ? item.linkedTo.map(String) : []),
    ].filter(Boolean)));
  }
  return result;
}

function batchSizeForModel(model: string): number {
  return model.toLowerCase().includes('deepseek') ? 1 : 3;
}

async function extractBatch<T>(
  settings: Settings,
  names: string[],
  script: string,
  buildPrompt: (batch: string[]) => string,
  fallbackKey: string,
): Promise<T[]> {
  const results: T[] = [];
  const batchSize = batchSizeForModel(settings.model);
  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize);
    const raw = await callLLM(settings, [{ role: 'user', content: buildPrompt(batch) }], 9000);
    const arr = parseArray(raw, fallbackKey) as T[];
    results.push(...arr);
  }
  return results;
}

const CHARACTER_DETAIL_NOTE = `【角色视觉要求】
- stateTimeline 以“换装/发型/妆容/伤痕/遮挡/饰品/变装/年龄跨度”为准，不能只写初始造型。
- 每一集只要出现明确服装、校服、礼服、睡衣、制服、战损、湿身、伤口、绷带、面具、帽子、发色发型变化，都必须新增或更新关键帧。
- 如果连续多集造型不变，可以沿用上一帧；如果有换装，即使剧情不重要也要记录。
- state 要能直接服务角色大头照/半身照生成：性别年龄感、发型发色、脸部特征、服装上半身、关键配饰。
- portraitPrompt 写一条稳定大头照提示词，聚焦脸、发型、上半身服装和辨识特征，不写情绪关系。`;

const DETAIL_NOTE = `【简洁要求】description ≤ 60字，state ≤ 90字；stateTimeline 不限 1-4 帧，以实际视觉变化完整为准。`;

async function scanAppearanceEvents(settings: Settings, names: string[], episodes: EpisodeInput[]): Promise<AppearanceEvent[]> {
  if (names.length === 0) return [];
  const results: AppearanceEvent[] = [];
  for (const ep of episodes) {
    let raw = '';
    try {
      raw = await callLLM(settings, [{ role: 'user', content: `你是影视服化连续性记录员。只扫描本集内下列角色的视觉造型事件，尤其是换装、发型、妆容、伤口、绷带、面具、饰品、湿身/脏污/战损、睡衣/制服/礼服等。

【角色名单】${names.join('，')}

【规则】
- 只记录剧本文字中能支撑的视觉信息，不猜测。
- 同一角色本集如果有多次换装/外观变化，要分别列出。
- 如果本集没有任何外观信息，返回空数组。
- evidence 填剧本里的短依据原文。

【返回格式】仅输出纯 JSON 数组：
[{"episode":${ep.index},"character":"角色名","appearance":"当前外观","change":"相比上一外观的变化","trigger":"触发剧情","evidence":"原文依据"}]

本集标题：${ep.title}
本集内容：
${ep.content}` }], 5000, { allowEmpty: true });
    } catch {
      continue;
    }
    if (!raw.trim()) continue;

    let arr: Partial<AppearanceEvent>[];
    try {
      arr = parseArray(raw, 'events') as Partial<AppearanceEvent>[];
    } catch {
      continue;
    }
    for (const item of arr) {
      const character = String(item.character ?? '').trim();
      const appearance = String(item.appearance ?? '').trim();
      if (!character || !appearance) continue;
      results.push({
        episode: Number(item.episode ?? ep.index),
        character,
        appearance,
        change: String(item.change ?? '').trim(),
        trigger: String(item.trigger ?? '').trim(),
        evidence: String(item.evidence ?? '').trim(),
      });
    }
  }
  return results;
}

function appearanceLedger(events: AppearanceEvent[], batch: string[]): string {
  const wanted = new Set(batch.map((n) => n.toLowerCase()));
  const lines = events
    .filter((event) => wanted.has(event.character.toLowerCase()))
    .map((event) => `- 第${event.episode}集｜${event.character}｜外观：${event.appearance}｜变化：${event.change || '未写明'}｜触发：${event.trigger || '未写明'}｜依据：${event.evidence || '无'}`);
  return lines.length > 0 ? lines.join('\n') : '（扫描未发现明确外观事件，仍需从剧本中复核初始造型）';
}

async function mergeSceneSeeds(settings: Settings, seeds: AssetNameSeed[], script: string): Promise<AssetNameSeed[]> {
  if (seeds.length <= 1) return seeds;
  const raw = await callLLM(settings, [{ role: 'user', content: `你是影视场景资产统筹。请把“同一真实地点/空间”的场景名合并为一个规范资产，避免把同一地点按房间局部、镜头角度、门口/室内、白天/夜晚重复拆卡。

【合并规则】
- “医院病房 / 病房 / VIP病房”若剧情指向同一个空间，合并为一个 name，其他写 aliases。
- “办公室门口 / 办公室内 / 总裁办公室”若是同一固定空间的局部，合并；若剧情确实是不同地点才分开。
- 日/夜、雨天、凌乱、被破坏不拆新场景，写入后续 stateTimeline。
- name 用最稳定、最具体、但不过度细碎的地点名。

【候选场景】${seeds.map((s) => s.aliases.length ? `${s.name}（别名:${s.aliases.join('/')}）` : s.name).join('，')}

【返回格式】仅输出纯 JSON 数组：
[{"name":"规范场景名","aliases":["剧本里的其他叫法"]}]

剧本内容：
${script}` }], 3500);
  const arr = parseArray(raw, 'scenes');
  const merged = uniqueSeeds(arr);
  return merged.length > 0 ? merged : seeds;
}

async function extractCharacters(settings: Settings, seeds: AssetNameSeed[], script: string, appearanceEvents: AppearanceEvent[]): Promise<CharacterAsset[]> {
  if (seeds.length === 0) return [];
  const names = seedNames(seeds);
  return extractBatch<CharacterAsset>(settings, names, script, (batch) => `你是剧本资产提取专家。从剧本中为下列 ${batch.length} 个【人物角色】提取信息，不得遗漏，也不得混入场景或道具。

【分拆规则】同一人物若以不同身份交替出现（如蝙蝠侠↔韦恩），拆为两条，各自 linkedTo 填对方名称。

${STATE_TIMELINE_RULES}

${CHARACTER_DETAIL_NOTE}

${DETAIL_NOTE}

【角色名单】${batch.join('，')}

【逐集外观扫描结果——必须用于补全 stateTimeline，不得忽略】
${appearanceLedger(appearanceEvents, batch)}

【返回格式】仅输出纯 JSON 数组，禁止任何说明或代码块：
[{"name":"","aliases":["剧本中的称呼/昵称/英文名"],"description":"人物简介","emotionTags":[],"appearsIn":[1,2],"portraitPrompt":"角色稳定大头照提示词","stateTimeline":[{"fromEpisode":1,"state":"外观描述","change":"初始外观","trigger":"初始状态"}],"linkedTo":[]}]

剧本内容：
${script}`, 'characters');
}

async function extractScenes(settings: Settings, seeds: AssetNameSeed[], script: string): Promise<BaseAsset[]> {
  if (seeds.length === 0) return [];
  const names = seedNames(seeds);
  const aliasHint = seeds.map((s) => s.aliases.length ? `${s.name}：${s.aliases.join('、')}` : `${s.name}：无`).join('\n');
  return extractBatch<BaseAsset>(settings, names, script, (batch) => `你是剧本资产提取专家。从剧本中为下列 ${batch.length} 个【场景地点】提取信息，不得遗漏，也不得混入角色或道具。

【场景定义】场景是固定的地点、空间或环境（如学校走廊、医院病房、荒郊野外），不包含可携带的物品和人物。
【去重规则】同一真实地点不要按“门口/室内/角落/白天/夜晚/凌乱/破坏后”拆成多个资产；这些差异写入 aliases 或 stateTimeline。

${STATE_TIMELINE_RULES}

${DETAIL_NOTE}

【场景名单】${batch.join('，')}
【已合并别名参考】
${aliasHint}

【返回格式】仅输出纯 JSON 数组，禁止任何说明或代码块：
[{"name":"","aliases":["剧本中的其他叫法/简称"],"description":"场景简介","appearsIn":[1,2],"stateTimeline":[{"fromEpisode":1,"state":"场景外观描述","change":"初始外观","trigger":"初始状态"}],"linkedTo":[]}]

剧本内容：
${script}`, 'scenes');
}

async function extractProps(settings: Settings, seeds: AssetNameSeed[], script: string): Promise<BaseAsset[]> {
  if (seeds.length === 0) return [];
  const names = seedNames(seeds);
  return extractBatch<BaseAsset>(settings, names, script, (batch) => `你是剧本资产提取专家。从剧本中为下列 ${batch.length} 个【道具物品】提取信息，不得遗漏，也不得混入角色或场景。

【道具定义】道具是剧中出现的可移动具体物品、器具或设备（如手枪、日记本、戒指、汽车），不包含固定场所和人物。

${STATE_TIMELINE_RULES}

${DETAIL_NOTE}

【道具名单】${batch.join('，')}

【返回格式】仅输出纯 JSON 数组，禁止任何说明或代码块：
[{"name":"","aliases":["剧本中的其他叫法/简称"],"description":"道具简介","appearsIn":[1,2],"stateTimeline":[{"fromEpisode":1,"state":"道具外观描述","change":"初始外观","trigger":"初始状态"}],"linkedTo":[]}]

剧本内容：
${script}`, 'props');
}

export async function POST(req: Request) {
  try {
    const { episodes, settings: incomingSettings } = await req.json() as {
      episodes: EpisodeInput[];
      settings: Settings;
    };
    const settings = resolveEffectiveSettings(incomingSettings);

    if (!episodes?.length || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const formattedEpisodes = episodes
      .map((ep) => `=== 第${ep.index}集 ===\n${ep.content}`)
      .join('\n\n');

    const warnings: string[] = [];

    // ── Step 1：发现资产名单。整本失败时自动按集降级扫描 ─────────────
    const discovered = await discoverAssetSeeds(settings, episodes, formattedEpisodes, warnings);
    const confirmedCharacters = discovered.characters;
    const discoveredScenes = discovered.scenes;
    const confirmedProps = discovered.props;

    if (confirmedCharacters.length === 0 && discoveredScenes.length === 0 && confirmedProps.length === 0) {
      return NextResponse.json({ error: `第1步失败：未能识别到任何资产。${warnings.join('；')}` }, { status: 400 });
    }

    const [appearanceEventsResult, sceneSeedsResult] = await Promise.allSettled([
      scanAppearanceEvents(settings, seedNames(confirmedCharacters), episodes),
      mergeSceneSeeds(settings, discoveredScenes, formattedEpisodes),
    ]);

    const appearanceEvents = appearanceEventsResult.status === 'fulfilled'
      ? appearanceEventsResult.value
      : (warnings.push(`角色造型扫描失败：${(appearanceEventsResult.reason as Error)?.message}`), [] as AppearanceEvent[]);
    const confirmedScenes = sceneSeedsResult.status === 'fulfilled'
      ? sceneSeedsResult.value
      : (warnings.push(`场景合并失败：${(sceneSeedsResult.reason as Error)?.message}`), discoveredScenes);

    // ── Step 2：角色 / 场景 / 道具各自独立提取（并发）─────────────
    const [charResult, sceneResult, propResult] = await Promise.allSettled([
      extractCharacters(settings, confirmedCharacters, formattedEpisodes, appearanceEvents),
      extractScenes(settings, confirmedScenes, formattedEpisodes),
      extractProps(settings, confirmedProps, formattedEpisodes),
    ]);

    const charList = charResult.status === 'fulfilled'
      ? charResult.value
      : (warnings.push(`角色提取失败：${(charResult.reason as Error)?.message}`), [] as CharacterAsset[]);
    const sceneList = sceneResult.status === 'fulfilled'
      ? sceneResult.value
      : (warnings.push(`场景提取失败：${(sceneResult.reason as Error)?.message}`), [] as BaseAsset[]);
    const propList = propResult.status === 'fulfilled'
      ? propResult.value
      : (warnings.push(`道具提取失败：${(propResult.reason as Error)?.message}`), [] as BaseAsset[]);

    if (charList.length === 0 && sceneList.length === 0 && propList.length === 0 && warnings.length > 0) {
      return NextResponse.json({ error: `第2步全部失败：${warnings.join('；')}` }, { status: 400 });
    }

    const characters = dedupeAssetsByName(charList).map((char) => ({
      id: crypto.randomUUID(),
      name: String(char.name ?? ''),
      aliases: mergeSeedAliases(String(char.name ?? ''), char.aliases, confirmedCharacters),
      description: String(char.description ?? ''),
      emotionTags: Array.isArray(char.emotionTags) ? char.emotionTags.map(String) : [],
      appearsIn: Array.isArray(char.appearsIn) ? char.appearsIn.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [],
      stateTimeline: normalizeKeyframes(char.stateTimeline),
      linkedTo: Array.isArray(char.linkedTo) ? char.linkedTo.map(String) : [],
      portraitPrompt: String(char.portraitPrompt ?? ''),
      referenceImages: [] as never[],
    }));

    const scenes = dedupeAssetsByName(sceneList).map((scene) => ({
      id: crypto.randomUUID(),
      name: String(scene.name ?? ''),
      aliases: mergeSeedAliases(String(scene.name ?? ''), scene.aliases, confirmedScenes),
      description: String(scene.description ?? ''),
      appearsIn: Array.isArray(scene.appearsIn) ? scene.appearsIn.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [],
      stateTimeline: normalizeKeyframes(scene.stateTimeline),
      linkedTo: Array.isArray(scene.linkedTo) ? scene.linkedTo.map(String) : [],
      referenceImages: [] as never[],
    }));

    const props = dedupeAssetsByName(propList).map((prop) => ({
      id: crypto.randomUUID(),
      name: String(prop.name ?? ''),
      aliases: mergeSeedAliases(String(prop.name ?? ''), prop.aliases, confirmedProps),
      description: String(prop.description ?? ''),
      appearsIn: Array.isArray(prop.appearsIn) ? prop.appearsIn.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [],
      stateTimeline: normalizeKeyframes(prop.stateTimeline),
      linkedTo: Array.isArray(prop.linkedTo) ? prop.linkedTo.map(String) : [],
      referenceImages: [] as never[],
    }));

    return NextResponse.json({
      characters, scenes, props,
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal Server Error' },
      { status: 400 }
    );
  }
}
