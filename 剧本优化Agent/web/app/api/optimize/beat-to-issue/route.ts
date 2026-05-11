import { NextRequest, NextResponse } from "next/server";
import { resolveEffectiveSettings } from "@/lib/server-settings";
import { safeParseJson } from "@/lib/safe-parse-json";

export const runtime = "nodejs";

type AdoptedIssue = {
  id: string; episode: number; type: string; description: string;
  suggestion: string;
  fixOptions?: { label?: string; suggestion?: string; targetEpisode?: number; recommended?: boolean }[];
  textSnippet: string; severity: "高" | "中" | "低"; status: "open";
};

const systemPrompt = `你是短剧节奏编辑，把用户提供的修改意见转化为结构化问题卡。
根据 beat 上下文和用户的修改意见，输出严格 JSON，不输出其他内容：
{
  "id": "custom-issue-<随机6位字符串>",
  "episode": <集数>,
  "type": "<从 开场钩/主体推进/集尾卡点/信息密度/情绪散焦 中选最贴近的>",
  "description": "<描述问题现状，引用 textSnippet 说明对完播率的影响，30字以内>",
  "suggestion": "<把用户修改意见精炼为一句可执行指令，15字以内>",
  "fixOptions": [{ "label": "方案 A", "suggestion": "<精炼后的修改指令>", "targetEpisode": <集数>, "recommended": true }],
  "textSnippet": "<直接复制 beat.textSnippet>",
  "severity": "<根据 beat 指标和修改意见重要程度判断 高/中/低>",
  "status": "open"
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      beat: { episode: number; function: string; summary: string; diagnosis: string; textSnippet: string; metrics: Record<string, number> };
      customText: string;
      settings: { apiUrl: string; apiKey: string; model: string };
    };
    const { beat, customText, settings: incomingSettings } = body;
    const settings = resolveEffectiveSettings(incomingSettings);

    if (!beat || !customText?.trim() || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const userMessage = `Beat 信息：
集数：${beat.episode}  功能：${beat.function}
摘要：${beat.summary}
诊断：${beat.diagnosis}
原文片段：${beat.textSnippet}
指标：${JSON.stringify(beat.metrics)}

用户修改意见：${customText}`;

    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `AI 请求失败: ${await response.text()}` }, { status: 502 });
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";

    const parsed = safeParseJson<AdoptedIssue>(content);
    if ("error" in parsed) {
      return NextResponse.json({ error: "AI 返回格式解析失败", raw: parsed.raw }, { status: 400 });
    }

    const issue: AdoptedIssue = {
      ...parsed.data,
      id: parsed.data.id || `custom-issue-${Date.now()}`,
      episode: parsed.data.episode ?? beat.episode,
      textSnippet: parsed.data.textSnippet || beat.textSnippet,
      status: "open",
    };

    return NextResponse.json({ issue });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器内部错误" }, { status: 500 });
  }
}
