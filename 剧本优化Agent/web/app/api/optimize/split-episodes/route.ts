import { NextResponse } from "next/server";
import { resolveEffectiveSettings } from "@/lib/server-settings";

export const runtime = "nodejs";

const CHINESE_NUMS = "零一二三四五六七八九十百千";

// 匹配独立成行的集标题，行必须以集标记开头且 < 60 字符
// 支持：第1集 / 第一集 / 第1集 序章 / 【第1集】/ EP1 / Episode 1
const LINE_HEADER_RE = new RegExp(
  `^[\\s\\t—\\-=~*【\\[「『（(]*` +
  `(?:第\\s*(?:\\d+|[${CHINESE_NUMS}]+)\\s*[集话部]` +
  `|EP\\.?\\s*\\d+|Episode\\s+\\d+)` +
  `.*$`,
  "i"
);

// 内联正则（行内包含即算，用于标题行较宽松的格式）
const INLINE_HEADER_RE = new RegExp(
  `(?:^|\\n)[^\\S\\n]*(?:[—\\-=~*【\\[「『]*)?第\\s*(?:\\d+|[${CHINESE_NUMS}]+)\\s*[集话部]` +
  `|(?:^|\\n)[^\\S\\n]*EP\\.?\\s*\\d+` +
  `|(?:^|\\n)[^\\S\\n]*Episode\\s+\\d+`,
  "gim"
);

/** 把汉字数字转阿拉伯数字（仅支持 1-99，够用） */
function chineseNumToInt(s: string): number | null {
  const map: Record<string, number> = {
    零:0, 一:1, 二:2, 三:3, 四:4, 五:5,
    六:6, 七:7, 八:8, 九:9, 十:10,
  };
  if (!s) return null;
  // 简单情况：单字
  if (map[s] !== undefined) return map[s];
  // 十X
  if (s.startsWith("十")) return 10 + (map[s[1]] ?? 0);
  // X十Y
  const m = s.match(/^([一二三四五六七八九])十([一二三四五六七八九]?)$/);
  if (m) return (map[m[1]] ?? 0) * 10 + (map[m[2]] ?? 0);
  const m2 = s.match(/^([一二三四五六七八九])十$/);
  if (m2) return (map[m2[1]] ?? 0) * 10;
  return null;
}

function extractIndex(title: string, fallback: number): number {
  const arabic = title.match(/\d+/);
  if (arabic) return parseInt(arabic[0], 10);
  const chinese = title.match(new RegExp(`[${CHINESE_NUMS}]+`));
  if (chinese) return chineseNumToInt(chinese[0]) ?? fallback;
  return fallback;
}

/** 策略一：逐行检测独立标题行（最可靠） */
function splitByLineHeaders(text: string) {
  const lines = text.split("\n");
  const headers: { lineIdx: number; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // 标题行应短（< 60 字符，含可选集标题）且匹配模式
    if (trimmed.length > 0 && trimmed.length < 60 && LINE_HEADER_RE.test(trimmed)) {
      headers.push({ lineIdx: i, title: trimmed });
    }
  }

  if (headers.length < 2) return null;

  const episodes: { index: number; title: string; content: string }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const startLine = headers[i].lineIdx + 1;
    const endLine = i + 1 < headers.length ? headers[i + 1].lineIdx : lines.length;
    const content = lines.slice(startLine, endLine).join("\n").trim();
    episodes.push({
      index: extractIndex(headers[i].title, i + 1),
      title: headers[i].title,
      content,
    });
  }
  return episodes;
}

/** 策略二：行内正则匹配（宽松，适合标题后接内容同行的格式） */
function splitByInlineRegex(text: string) {
  const matches = [...text.matchAll(INLINE_HEADER_RE)];
  if (matches.length < 2) return null;

  const episodes: { index: number; title: string; content: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const rawTitle = match[0].replace(/^\n/, "").trim();
    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const content = text.slice(startIdx, endIdx).trim();
    episodes.push({
      index: extractIndex(rawTitle, i + 1),
      title: rawTitle,
      content,
    });
  }
  return episodes;
}

export async function POST(req: Request) {
  try {
    const { text, settings: incomingSettings } = await req.json() as {
      text: string;
      settings: { apiUrl: string; apiKey: string; model: string };
    };
    const settings = resolveEffectiveSettings(incomingSettings);

    if (!text || !settings?.apiUrl || !settings?.apiKey || !settings?.model) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 策略一：逐行标题检测
    const byLine = splitByLineHeaders(text);
    if (byLine && byLine.length >= 2) {
      return NextResponse.json({ episodes: byLine, method: "line" });
    }

    // 策略二：行内正则
    const byInline = splitByInlineRegex(text);
    if (byInline && byInline.length >= 2) {
      return NextResponse.json({ episodes: byInline, method: "inline" });
    }

    // 策略三：LLM 兜底
    const prompt = `你是剧本拆集专家。把以下剧本按集拆分，返回纯 JSON 数组，每项含 index（数字）/title（集标题）/content（该集完整正文）三个字段，不输出任何其他内容。\n\n剧本内容：\n${text}`;

    const response = await fetch(settings.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 8000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `LLM API error: ${await response.text()}` },
        { status: 400 }
      );
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();

    // LLM 可能返回数组或对象 { episodes: [...] }
    const parsed = JSON.parse(cleaned) as
      | { index: number; title: string; content: string }[]
      | { episodes: { index: number; title: string; content: string }[] };

    const episodes = Array.isArray(parsed) ? parsed : parsed.episodes ?? [];
    return NextResponse.json({ episodes, method: "llm" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal Server Error" },
      { status: 400 }
    );
  }
}
