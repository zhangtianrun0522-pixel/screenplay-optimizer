import { NextRequest, NextResponse } from "next/server";
import { resolveEffectiveSettings } from "@/lib/server-settings";
import { safeParseJson } from "@/lib/safe-parse-json";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { episodes, targetMarket, targetLanguage, characterNames, settings: incomingSettings } = await req.json() as {
      episodes: { index: number; title: string; content: string }[];
      targetMarket: string;
      targetLanguage: string;
      characterNames?: string[];
      settings: { apiUrl: string; apiKey: string; model: string };
    };
    const settings = resolveEffectiveSettings(incomingSettings);

    if (!episodes?.length || !targetMarket || !targetLanguage || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: "缺少必要的请求参数" }, { status: 400 });
    }

    const nameGuide = characterNames?.length
      ? `\n跨集人物名称统一对照表（必须严格保持以下名称不变，不得自创别名）：${characterNames.join("、")}`
      : "";
    const systemPrompt = `你是专业短剧台词本地化专家，精通${targetMarket}${targetLanguage}口语。请将以下剧本台词本地化改写：1)所有代词(他/她/它)替换为角色全名 2)台词改写为${targetMarket}${targetLanguage}地道口语表达，去除中式翻译腔 3)保留场景说明和动作描写不变 4)保持原有剧情和人物性格 5)对白自然流畅，符合短剧快节奏 6)全剧人物名称须跨集保持统一。${nameGuide}\n返回完整改写后的剧本，JSON格式：{"episodes":[{"index":集数,"title":"标题","content":"改写后完整内容","notes":"本集本地化关键决策，50字以内"}]}，不输出其他内容。`;

    const results: { index: number; title: string; content: string; notes?: string }[] = [];

    for (const ep of episodes) {
      const userPrompt = `集数：${ep.index}\n标题：${ep.title}\n内容：\n${ep.content}`;

      const response = await fetch(settings.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          max_tokens: 8000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ error: `第${ep.index}集API请求失败: ${await response.text()}` }, { status: 400 });
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const contentStr = data.choices?.[0]?.message?.content ?? "";

      const parsed = safeParseJson<{ episodes?: { index: number; title: string; content: string; notes?: string }[] }>(contentStr);
      if ("error" in parsed) {
        results.push({ index: ep.index, title: ep.title, content: contentStr });
      } else {
        results.push(parsed.data.episodes?.[0] ?? { index: ep.index, title: ep.title, content: contentStr });
      }
    }

    return NextResponse.json({ episodes: results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器内部错误" }, { status: 400 });
  }
}
