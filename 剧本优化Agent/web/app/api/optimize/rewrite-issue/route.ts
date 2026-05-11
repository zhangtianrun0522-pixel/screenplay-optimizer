import { NextRequest, NextResponse } from "next/server";
import { resolveEffectiveSettings } from "@/lib/server-settings";
import { safeParseJson } from "@/lib/safe-parse-json";

export const runtime = "nodejs";

type ApiResponse = {
  content: string;
  appliedSnippet?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { episode, issue, settings: incomingSettings } = await req.json() as {
      episode: { index: number; title: string; content: string };
      issue: {
        type: string;
        description: string;
        suggestion: string;
        selectedSuggestion?: string;
        userCorrection?: string;
        textSnippet: string;
        severity?: string;
      };
      settings: { apiUrl: string; apiKey: string; model: string };
    };
    const settings = resolveEffectiveSettings(incomingSettings);

    const selectedSuggestion = issue?.selectedSuggestion?.trim() || issue?.suggestion?.trim();

    if (!episode?.content || !selectedSuggestion || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: "缺少必要的请求参数" }, { status: 400 });
    }

    const systemPrompt = `你是短剧剧本局部修改助手。请只执行用户明确选中的修改方案，改写当前集正文中相关片段，保持剧情、人物关系、场景顺序和其他无关文本不变。若原始建议包含多个方案，不要混合执行，也不要自行选择其他方案。返回完整的本集正文，不要省略未修改部分。

返回严格JSON，不输出其他内容：
{
  "content": "修改后的完整本集正文",
  "appliedSnippet": "你实际修改后的相关片段"
}`;

    const userPrompt = `集数：第${episode.index}集
标题：${episode.title}

问题类型：${issue.type}
问题描述：${issue.description}
原始建议：${issue.suggestion}
用户选中的修改方案：${selectedSuggestion}
用户对AI理解的纠正：${issue.userCorrection?.trim() || "未提供"}
定位片段：${issue.textSnippet || "未提供"}

本集正文：
${episode.content}`;

    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 8000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: `API请求失败: ${await response.text()}` }, { status: 400 });
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson<ApiResponse>(raw);

    if ("error" in parsed || !parsed.data.content?.trim()) {
      return NextResponse.json({ error: "解析模型返回JSON失败", raw }, { status: 400 });
    }

    return NextResponse.json(parsed.data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器内部错误" }, { status: 400 });
  }
}
