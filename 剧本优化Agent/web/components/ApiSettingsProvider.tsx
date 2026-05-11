"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import SettingsDialog from "@/components/SettingsDialog";
import type { PublicSettings, Settings } from "@/lib/types";

const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  apiUrl: "https://api.bltcy.ai/v1/chat/completions",
  apiKey: "",
  model: "gpt-5.4-mini",
  hasApiKey: false,
  maskedApiKey: "",
};

type ApiSettingsContextValue = {
  settings: PublicSettings;
  openSettings: () => void;
};

const ApiSettingsContext = createContext<ApiSettingsContextValue | null>(null);

export function useApiSettings(): ApiSettingsContextValue {
  const ctx = useContext(ApiSettingsContext);
  if (!ctx) {
    throw new Error("useApiSettings 必须在 ApiSettingsProvider 内使用");
  }
  return ctx;
}

export function ApiSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) throw new Error("读取 API 设置失败");
    setSettings(await res.json() as PublicSettings);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().finally(() => setHydrated(true));
  }, [refresh]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hydrated && !settings.hasApiKey) setDialogOpen(true);
  }, [hydrated, settings.hasApiKey]);

  const openSettings = useCallback(() => setDialogOpen(true), []);

  const value = useMemo(() => ({ settings, openSettings }), [settings, openSettings]);

  async function handleSave(next: Settings) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({})) as PublicSettings | { error?: string };
    if (!res.ok) {
      throw new Error("error" in data ? data.error : "保存 API 设置失败");
    }
    setSettings(data as PublicSettings);
  }

  return (
    <ApiSettingsContext.Provider value={value}>
      {children}
      <SettingsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        settings={settings}
        onSave={handleSave}
      />
    </ApiSettingsContext.Provider>
  );
}
