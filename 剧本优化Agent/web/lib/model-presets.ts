/** 设置弹窗内快捷可选的模型（datalist 建议项，允许用户自由输入任意模型名） */
export const MODEL_QUICK_OPTIONS = [
  // OpenAI（中转）
  { value: "gpt-5.5", label: "gpt-5.5（OpenAI 中转）" },
  { value: "gpt-5.4", label: "gpt-5.4（OpenAI）" },
  { value: "gpt-5.4-mini", label: "gpt-5.4-mini（默认）" },
  // Gemini
  { value: "gemini-3.1-flash-lite-preview", label: "gemini-3.1-flash-lite-preview（Gemini）" },
  { value: "gemini-3.1-pro-preview", label: "gemini-3.1-pro-preview（Gemini）" },
  // 百炼 Qwen（长输出推荐）
  { value: "qwen3-coder-next", label: "qwen3-coder-next（百炼，长输出）" },
  { value: "qwen3-max-2026-01-23", label: "qwen3-max-2026-01-23（百炼）" },
  { value: "qwen3-coder-plus", label: "qwen3-coder-plus（百炼）" },
  // DeepSeek
  { value: "deepseek-chat", label: "deepseek-chat（DeepSeek）" },
  // 智谱 GLM
  { value: "glm-5.1", label: "glm-5.1（智谱）" },
];

/** 非空则原样保留，空时回落为默认 */
export function normalizeModel(v: string): string {
  return v?.trim() || "gpt-5.4-mini";
}
