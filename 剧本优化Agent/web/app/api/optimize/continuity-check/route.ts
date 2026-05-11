import { NextRequest, NextResponse } from "next/server";
import { resolveEffectiveSettings } from "@/lib/server-settings";
import { safeParseJson } from "@/lib/safe-parse-json";

export const runtime = "nodejs";

type Issue = {
  episode: number;
  type: string;
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

type ApiResponse = {
  report: string;
  issues: Issue[];
};

export async function POST(req: NextRequest) {
  try {
    const { episodes, assets, settings: incomingSettings } = await req.json() as {
      episodes: { index: number; title: string; content: string }[];
      assets: {
        characters: { name: string; aliases: string[]; appearsIn: number[] }[];
        scenes: { name: string; aliases: string[]; appearsIn: number[] }[];
        props: { name: string; aliases: string[]; appearsIn: number[] }[];
      } | null;
      settings: { apiUrl: string; apiKey: string; model: string };
    };
    const settings = resolveEffectiveSettings(incomingSettings);

    if (!episodes?.length || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: "缺少必要的请求参数" }, { status: 400 });
    }

    const systemPrompt = `你是专业剧本连续性审查专家。请按五个维度检查剧本：1)角色名称/称谓是否统一（注意别名混用）2)场景道具名称是否一致 3)时间线/日夜/伤口/服装等视觉连续性 4)早期伏笔是否被遗忘 5)人物关系是否前后矛盾。

返回严格JSON，不输出其他内容：
{
  "report": "Markdown诊断报告，按维度分节；无问题的维度写无异常",
  "issues": [
    {
      "episode": 集数,
      "type": "问题类型",
      "description": "问题描述",
      "suggestion": "首选修改建议，必须对应fixOptions里recommended=true的方案",
      "fixOptions": [
        {
          "label": "方案A",
          "suggestion": "具体可执行修改方案。如果问题存在两种合理方向，比如统一第8集为肩膀，或反向修改第7集为脖子，必须分别列出。",
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
- 每个issue至少给1个fixOptions。
- 如果连续性问题可以通过“向前改旧设定”或“向后改新描述”两种方式解决，必须给出至少2个fixOptions，并只把其中一个标为recommended=true。
- fixOptions.suggestion必须是用户点击后可以直接执行的单一修改动作，不要使用“或”。`;

    let assetsText = "\n\n【资产信息】\n";
    if (assets?.characters?.length) {
      assetsText += "角色：\n" + assets.characters.map((c) =>
        `- ${c.name} (别名: ${c.aliases.join(", ")}; 出现集数: ${c.appearsIn.join(", ")})`
      ).join("\n") + "\n";
    }
    if (assets?.scenes?.length) {
      assetsText += "场景：\n" + assets.scenes.map((s) =>
        `- ${s.name} (别名: ${s.aliases.join(", ")}; 出现集数: ${s.appearsIn.join(", ")})`
      ).join("\n") + "\n";
    }
    if (assets?.props?.length) {
      assetsText += "道具：\n" + assets.props.map((p) =>
        `- ${p.name} (别名: ${p.aliases.join(", ")}; 出现集数: ${p.appearsIn.join(", ")})`
      ).join("\n") + "\n";
    }
    if (!assets?.characters?.length && !assets?.scenes?.length && !assets?.props?.length) {
      assetsText += "尚未进行资产提取。请直接从剧本文本中识别角色、场景、道具、时间线和视觉连续性线索。\n";
    }

    const episodesText = episodes.map((ep) => `=== 第${ep.index}集 ${ep.title} ===\n${ep.content}`).join("\n\n");
    const userPrompt = episodesText + assetsText;

    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
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
      return NextResponse.json({ error: "解析模型返回JSON失败", raw: parsed.raw }, { status: 400 });
    }
    return NextResponse.json(parsed.data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器内部错误" }, { status: 400 });
  }
}
