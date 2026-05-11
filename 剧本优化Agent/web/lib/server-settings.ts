import fs from "fs";
import path from "path";
import { resolveAgentRoot } from "./agent-paths";
import type { PublicSettings, Settings } from "./types";
import { normalizeModel } from "./model-presets";

const SETTINGS_DIR = path.join(resolveAgentRoot(), "data", "settings");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "api-settings.json");
const SERVER_CONFIGURED_KEY_PLACEHOLDER = "__server_configured__";
const DEFAULT_SETTINGS: Settings = {
  apiUrl: "https://api.bltcy.ai/v1/chat/completions",
  apiKey: process.env.SCRIPT_AGENT_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || "",
  model: "gpt-5.4-mini",
};
const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  apiUrl: DEFAULT_SETTINGS.apiUrl,
  apiKey: DEFAULT_SETTINGS.apiKey ? SERVER_CONFIGURED_KEY_PLACEHOLDER : "",
  model: DEFAULT_SETTINGS.model,
  hasApiKey: Boolean(DEFAULT_SETTINGS.apiKey),
  maskedApiKey: maskApiKey(DEFAULT_SETTINGS.apiKey),
};

function ensureDir() {
  try {
    if (!fs.existsSync(SETTINGS_DIR)) {
      fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    }
  } catch {
    // Silently fail in environments without write access
  }
}

function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••";
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

function normalizeApiUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SETTINGS.apiUrl;

  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/+$/, "");
    if (path === "" || path === "/v1") {
      url.pathname = `${path}/chat/completions`;
      return url.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function normalizeSettings(value: Partial<Settings> | null | undefined): Settings {
  return {
    apiUrl: normalizeApiUrl(String(value?.apiUrl ?? DEFAULT_SETTINGS.apiUrl)),
    apiKey: String(value?.apiKey ?? DEFAULT_SETTINGS.apiKey).trim(),
    model: normalizeModel(String(value?.model ?? DEFAULT_SETTINGS.model)),
  };
}

export function readServerSettings(): Settings {
  try {
    ensureDir();
    if (!fs.existsSync(SETTINGS_FILE)) {
      return normalizeSettings(DEFAULT_SETTINGS);
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8")) as Partial<Settings>;
      return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
    } catch {
      return normalizeSettings(DEFAULT_SETTINGS);
    }
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

export function writeServerSettings(next: Settings): Settings {
  try {
    ensureDir();
    const normalized = normalizeSettings(next);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(normalized, null, 2), "utf-8");
    return normalized;
  } catch {
    return normalizeSettings(next);
  }
}

export function toPublicSettings(settings: Settings): PublicSettings {
  return {
    apiUrl: settings.apiUrl,
    apiKey: settings.apiKey.trim() ? SERVER_CONFIGURED_KEY_PLACEHOLDER : "",
    model: settings.model,
    hasApiKey: Boolean(settings.apiKey.trim()),
    maskedApiKey: maskApiKey(settings.apiKey),
  };
}

export function getDefaultPublicSettings(): PublicSettings {
  return DEFAULT_PUBLIC_SETTINGS;
}

export function resolveEffectiveSettings(incoming?: Partial<Settings> | null): Settings {
  const stored = readServerSettings();
  const incomingApiKey = incoming?.apiKey?.trim();
  const shouldUseIncomingKey = Boolean(incomingApiKey && incomingApiKey !== SERVER_CONFIGURED_KEY_PLACEHOLDER);
  return normalizeSettings({
    ...stored,
    apiUrl: incoming?.apiUrl ?? stored.apiUrl,
    model: incoming?.model ?? stored.model,
    apiKey: shouldUseIncomingKey ? incomingApiKey : stored.apiKey,
  });
}
