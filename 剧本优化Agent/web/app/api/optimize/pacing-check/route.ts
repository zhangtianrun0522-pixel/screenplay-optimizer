import { NextRequest, NextResponse } from "next/server";
import { resolveEffectiveSettings } from "@/lib/server-settings";
import { safeParseJson } from "@/lib/safe-parse-json";

export const runtime = "nodejs";

type Issue = {
  episode: number;
  type: "开场钩" | "主体推进" | "集尾卡点" | "信息密度" | "情绪散焦" | string;
  description: string;
  suggestion: string;
  fixOptions?: {
    label: string;
    suggestion: string;
    targetEpisode?: number;
    rationale?: string;
    recommended?: boolean;
  }[];
  textSnippet: string;
  severity: "高" | "中" | "低";
};

type PacingMetricKey = "information" | "conflict" | "emotion" | "momentum" | "suspense";

type PacingBeat = {
  id: string;
  episode: number;
  order: number;
  function: "开场钩" | "铺垫" | "推进" | "冲突" | "升级" | "反转" | "情绪释放" | "收束" | "集尾钩" | string;
  summary: string;
  textSnippet: string;
  metrics: Record<PacingMetricKey, number>;
  diagnosis: string;
  suggestion?: string;
};

type ApiResponse = {
  report: string;
  beats: PacingBeat[];
  issues: Issue[];
};

const metricKeys: PacingMetricKey[] = ["information", "conflict", "emotion", "momentum", "suspense"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function unwrapPayload(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return value.data ?? value.result ?? value.output ?? value.response ?? value;
}

function clampMetric(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 3;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function normalizeBeats(beats: Partial<PacingBeat>[] | undefined) {
  if (!Array.isArray(beats)) return [];

  return beats.map((beat, index) => {
    const episode = typeof beat.episode === "number" && Number.isFinite(beat.episode) ? beat.episode : 1;
    const order = typeof beat.order === "number" && Number.isFinite(beat.order) ? beat.order : index;
    const rawMetrics = (beat.metrics ?? {}) as Partial<Record<PacingMetricKey, unknown>>;
    const metrics = Object.fromEntries(
      metricKeys.map((key) => [key, clampMetric(rawMetrics[key])]),
    ) as Record<PacingMetricKey, number>;

    return {
      id: beat.id?.trim() || `pace-beat-${episode}-${order}`,
      episode,
      order,
      function: beat.function?.trim() || "推进",
      summary: beat.summary?.trim() || "",
      textSnippet: beat.textSnippet?.trim() || "",
      metrics,
      diagnosis: beat.diagnosis?.trim() || "",
      suggestion: beat.suggestion?.trim() || undefined,
    };
  });
}

function normalizeIssues(issues: Partial<Issue>[] | undefined): Issue[] {
  if (!Array.isArray(issues)) return [];

  return issues.map((issue, index) => {
    const fixOptions = Array.isArray(issue.fixOptions)
      ? issue.fixOptions
          .map((option, optionIndex) => ({
            label: option.label?.trim() || `方案 ${String.fromCharCode(65 + optionIndex)}`,
            suggestion: option.suggestion?.trim() || "",
            targetEpisode: option.targetEpisode,
            rationale: option.rationale?.trim(),
            recommended: Boolean(option.recommended),
          }))
          .filter((option) => option.suggestion)
      : [];
    const recommendedIndex = fixOptions.findIndex((option) => option.recommended);
    const normalizedFixOptions = fixOptions.length > 0
      ? fixOptions.map((option, optionIndex) => ({
          ...option,
          recommended: recommendedIndex >= 0 ? optionIndex === recommendedIndex : optionIndex === 0,
        }))
      : [{
          label: "方案 A",
          suggestion: issue.suggestion?.trim() || "压缩当前片段中不推动目标的描述，补一个能改变人物选择的动作或对白。",
          targetEpisode: issue.episode,
          rationale: "保底方案，用于确保前端可以执行局部修改。",
          recommended: true,
        }];

    return {
      episode: typeof issue.episode === "number" && Number.isFinite(issue.episode) ? issue.episode : 1,
      type: issue.type?.trim() || "主体推进",
      description: issue.description?.trim() || "节奏问题描述缺失",
      suggestion: issue.suggestion?.trim() || normalizedFixOptions.find((option) => option.recommended)?.suggestion || normalizedFixOptions[0].suggestion,
      fixOptions: normalizedFixOptions,
      textSnippet: issue.textSnippet?.trim() || "",
      severity: issue.severity === "高" || issue.severity === "中" || issue.severity === "低" ? issue.severity : (index === 0 ? "高" : "中"),
    };
  });
}

function normalizePacingResponse(value: unknown): ApiResponse {
  const payload = unwrapPayload(value);
  if (Array.isArray(payload)) {
    const hasBeatShape = payload.some((item) => isRecord(item) && ("metrics" in item || "function" in item));
    return {
      report: "",
      beats: hasBeatShape ? normalizeBeats(payload as Partial<PacingBeat>[]) : [],
      issues: hasBeatShape ? [] : normalizeIssues(payload as Partial<Issue>[]),
    };
  }
  if (!isRecord(payload)) return { report: "", beats: [], issues: [] };

  const rawBeats = payload.beats ?? payload.pacingBeats ?? payload.beatMap ?? payload.rhythmBeats;
  const rawIssues = payload.issues ?? payload.problems ?? payload.diagnostics ?? payload.warnings;

  return {
    report: asText(payload.report ?? payload.summary ?? payload.diagnosis ?? payload.markdown ?? ""),
    beats: normalizeBeats(asArray<Partial<PacingBeat>>(rawBeats)),
    issues: normalizeIssues(asArray<Partial<Issue>>(rawIssues)),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { episodes, settings: incomingSettings } = await req.json() as {
      episodes: { index: number; title: string; content: string }[];
      settings: { apiUrl: string; apiKey: string; model: string };
    };
    const settings = resolveEffectiveSettings(incomingSettings);

    if (!episodes?.length || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: "缺少必要的请求参数" }, { status: 400 });
    }

    const systemPrompt = `你是短剧节奏医生，不是泛泛点评员。请先把剧本拆成轻量剧情节拍，再基于节拍诊断节奏问题。这个拆解只服务于节奏优化，不是资产处理里的场面组合，也不要输出任何资产规划。

每集必须检查：1)开场钩子（前3-8秒）是否有冲突/悬念/张力 2)主体推进是否聚焦单一目标 3)集尾卡点是否收在动作或对白刃口 4)单集新信息点是否超过2个 5)情绪是否散焦。

质量标准：
- 判断必须落到“哪个片段导致什么观看反应”，不要写“节奏略慢、加强冲突、提升悬念”这类空话。
- 优先抓会影响短剧完播的硬问题：开场没有立即制造问题、段落目标反复切换、同一信息重复解释、冲突没有升级、集尾没有未完成动作。
- 每条问题都要说明因果链：原文片段 -> 观众感受 -> 会损失什么 -> 应该怎样局部改。
- 修改方案必须是可直接提交给局部改写接口的一条动作，例如“删掉第2段解释身世的两句，把信息改为女主发现合同签名异常”，不要写成原则。
- 如果一个问题可以通过“删减解释 / 前置冲突 / 改集尾钩 / 调整信息释放顺序”等不同方式解决，必须给多个fixOptions。

节拍拆解规则：
- 每集拆成2到5个轻量节拍，按正文顺序排列。
- 节拍function只能优先使用：开场钩、铺垫、推进、冲突、升级、反转、情绪释放、收束、集尾钩。
- 节拍metrics必须使用1到5分：information=信息密度，conflict=冲突强度，emotion=情绪强度，momentum=推进效率，suspense=悬念强度。
- 节拍textSnippet必须是原文中可找到的连续短片段，10到30字。
- 节拍diagnosis必须写出该节拍在“目标、阻力、信息释放、情绪转向、钩子”中的具体得失。
- 节拍suggestion必须指向这个节拍内的局部动作；如果无需调整，写空字符串。

返回严格JSON，不输出其他内容：
{
  "report": "Markdown诊断报告，按集分节，每集包含开场钩评价、集尾卡点评价和其他问题",
  "beats": [
    {
      "id": "pace-beat-1-0",
      "episode": 集数,
      "order": 本集内顺序，从0开始,
      "function": "开场钩|铺垫|推进|冲突|升级|反转|情绪释放|收束|集尾钩",
      "summary": "这个节拍发生了什么，35字以内",
      "textSnippet": "原文中可定位的连续短片段，10到30字",
      "metrics": {
        "information": 1到5,
        "conflict": 1到5,
        "emotion": 1到5,
        "momentum": 1到5,
        "suspense": 1到5
      },
      "diagnosis": "节奏判断，必须包含具体片段造成的观看反应和失衡原因",
      "suggestion": "单一、可执行、局部的优化动作；如果无需调整可为空字符串"
    }
  ],
  "issues": [
    {
      "episode": 集数,
      "type": "开场钩|主体推进|集尾卡点|信息密度|情绪散焦",
      "description": "问题描述，必须包含：原文片段如何影响观看反应，以及为什么会拖累完播",
      "suggestion": "首选修改建议，必须对应fixOptions里recommended=true的方案",
      "fixOptions": [
        {
          "label": "方案A",
          "suggestion": "具体可执行修改方案。必须说明删、移、补、换哪一类动作，以及改到什么效果。",
          "targetEpisode": 需要修改的集数,
          "rationale": "为什么这个方案合理",
          "recommended": true
        }
      ],
      "textSnippet": "原文中出问题的连续短片段，10到30字，必须能在对应集正文中找到",
      "severity": "高|中|低"
    }
  ]
}

规则：
- 顶层必须是一个JSON对象，必须包含report、beats、issues三个字段；不要返回数组，不要包在data/result/output字段里。
- beats必须按每集至少2个节拍输出；即使没有明显节奏问题，beats也不能为空。
- issues可以为空数组，但字段必须存在。
- 如果任意集开场钩、集尾钩、主体推进评分低于3，必须产生对应issue。
- 每个issue至少给1个fixOptions。
- 如果同一个节奏问题存在多个合理处理方向，必须给出多个fixOptions，并只把其中一个标为recommended=true。
- fixOptions.suggestion必须是用户点击后可以直接执行的单一修改动作，不要使用“或”。
- report只做总览，不要承载主要建议；主要可执行建议必须进入beats和issues。
- 节奏优化只提出局部修改建议，不要建议整集自动重排、批量合并拆分、或提前生成资产。`;

    const BATCH_SIZE = 4;
    let mergedReport = "";
    const mergedBeats: PacingBeat[] = [];
    const mergedIssues: Issue[] = [];

    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const batchEpisodes = episodes.slice(i, i + BATCH_SIZE);
      const episodesText = batchEpisodes.map((ep) => `=== 第${ep.index}集 ${ep.title} ===\n${ep.content}`).join("\n\n");

      const response = await fetch(settings.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: episodesText }],
          max_tokens: 12000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ error: `API请求失败: ${await response.text()}` }, { status: 400 });
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";

      const parsed = safeParseJson<ApiResponse>(content);
      if ("error" in parsed) {
        return NextResponse.json({ error: `第${i + 1}-${Math.min(i + BATCH_SIZE, episodes.length)}集解析失败`, raw: parsed.raw }, { status: 400 });
      }

      const normalized = normalizePacingResponse(parsed.data);
      if (normalized.report.trim()) {
        mergedReport = mergedReport ? `${mergedReport}\n\n${normalized.report.trim()}` : normalized.report.trim();
      }
      mergedBeats.push(...normalized.beats);
      mergedIssues.push(...normalized.issues);
    }

    if (!mergedReport.trim() && mergedBeats.length === 0 && mergedIssues.length === 0) {
      return NextResponse.json({ error: "模型返回JSON缺少节奏报告字段" }, { status: 400 });
    }
    return NextResponse.json({
      report: mergedReport,
      beats: mergedBeats,
      issues: mergedIssues,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器内部错误" }, { status: 400 });
  }
}
