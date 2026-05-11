type ParseResult<T> = { data: T } | { error: string; raw: string };

function tryParse<T>(value: string): { data: T } | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "string") return tryParse<T>(parsed);
    return { data: parsed as T };
  } catch {
    return null;
  }
}

function extractFencedBlocks(raw: string) {
  return Array.from(raw.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/g), (match) => match[1].trim());
}

function extractBalancedJson(raw: string) {
  const candidates: string[] = [];
  const openers = new Set(["{", "["]);
  const closers: Record<string, string> = { "{": "}", "[": "]" };

  for (let start = 0; start < raw.length; start += 1) {
    const opener = raw[start];
    if (!openers.has(opener)) continue;

    const stack = [closers[opener]];
    let inString = false;
    let escaped = false;

    for (let index = start + 1; index < raw.length; index += 1) {
      const char = raw[index];

      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === "\"") inString = false;
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (openers.has(char)) {
        stack.push(closers[char]);
        continue;
      }

      if (char === stack[stack.length - 1]) {
        stack.pop();
        if (stack.length === 0) {
          candidates.push(raw.slice(start, index + 1));
          break;
        }
      }
    }
  }

  return candidates.sort((a, b) => b.length - a.length);
}

export function safeParseJson<T>(raw: string): ParseResult<T> {
  const trimmed = raw.trim();
  const candidates = [
    trimmed,
    ...extractFencedBlocks(trimmed),
    ...extractBalancedJson(trimmed),
  ];

  for (const candidate of candidates) {
    const parsed = tryParse<T>(candidate.trim());
    if (parsed) return parsed;
  }

  return { error: "JSON解析失败", raw };
}
