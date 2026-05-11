import { NextRequest, NextResponse } from "next/server";
import { resolveEffectiveSettings } from "@/lib/server-settings";
import { safeParseJson } from "@/lib/safe-parse-json";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { episodes, assets, settings: incomingSettings } = await req.json() as {
      episodes: { index: number; title: string; content: string }[];
      assets: {
        characters: { name: string; aliases: string[]; emotionTags: string[] }[];
        scenes: { name: string; aliases: string[] }[];
        props: { name: string; aliases: string[] }[];
      } | null;
      settings: { apiUrl: string; apiKey: string; model: string };
    };
    const settings = resolveEffectiveSettings(incomingSettings);

    if (!episodes?.length || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: "缺少必要的请求参数" }, { status: 400 });
    }

    const charMap = (assets?.characters ?? []).map((c) =>
      `${c.name} (别名: ${c.aliases.join("/")}, 情绪标签: ${c.emotionTags.join(",")})`
    ).join("；");
    const sceneMap = (assets?.scenes ?? []).map((s) => `${s.name} (别名: ${s.aliases.join("/")})`).join("；");
    const propMap = (assets?.props ?? []).map((p) => `${p.name} (别名: ${p.aliases.join("/")})`).join("；");
    const hasAssetTable = Boolean(charMap || sceneMap || propMap);
    const assetTable = hasAssetTable
      ? `角色映射：${charMap || "待从剧本识别"}\n场景映射：${sceneMap || "待从剧本识别"}\n道具映射：${propMap || "待从剧本识别"}`
      : "尚未进行资产提取。请先从剧本文本中自行识别角色、场景、道具与别名，再统一称谓和可视化描述。";

    const systemPrompt = `你是短剧AI生产优化专家，专门优化剧本使其适合AI视频工具（Seedance等）拆分分镜。请按以下规则改写每集剧本：1)所有代词(他/她/它/他们)全部替换为对应角色全名 2)角色名称统一为标准名（别名一律改为标准名） 3)场景和道具名称统一为标准名称 4)每句台词前加情绪标注，格式：[情绪]角色名：台词，情绪从角色情绪标签中选取或新增 5)动作描写更具体，加入距离/方向/速度等可视化信息 6)每个场景开头加【场景:场景名|时间:日/夜|氛围:描述】标注。\n\n资产标准名/别名映射表：\n${assetTable}\n\n示例：\n改写前：卧室·夜。他进屋，她背对着他。\n改写后：【场景:陈家卧室|时间:夜|氛围:冷漠压抑】\n[愤怒]陈浩大步走进卧室（步速急促，距林晓约2米），林晓背对站在床边。\n\n返回JSON：{"episodes":[{"index":集数,"title":"标题","content":"优化后完整内容","sceneCount":场景标注数}]}，不输出其他内容。`;

    const results: { index: number; title: string; content: string; sceneCount?: number }[] = [];

    for (const ep of episodes) {
      const userPrompt = `集数：${ep.index}\n标题：${ep.title}\n内容：\n${ep.content}`;

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
        return NextResponse.json({ error: `第${ep.index}集API请求失败: ${await response.text()}` }, { status: 400 });
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      const contentStr = data.choices?.[0]?.message?.content ?? "";

      const parsed = safeParseJson<{ episodes?: { index: number; title: string; content: string; sceneCount?: number }[] }>(contentStr);
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
