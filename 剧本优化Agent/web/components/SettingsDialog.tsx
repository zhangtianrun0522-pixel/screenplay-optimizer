"use client";

import { useEffect, useState } from "react";
import type { PublicSettings, Settings } from "@/lib/types";
import { MODEL_QUICK_OPTIONS, normalizeModel } from "@/lib/model-presets";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: PublicSettings;
  onSave: (s: Settings) => Promise<void>;
}

export default function SettingsDialog({ open, onClose, settings, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Settings>({
    apiUrl: settings.apiUrl,
    apiKey: "",
    model: settings.model,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setError("");
      return;
    }
    setDraft({ apiUrl: settings.apiUrl, apiKey: "", model: settings.model });
    setEditing(false);
  }, [open, settings]);

  if (!open) return null;

  function handleEdit() {
    setDraft({ apiUrl: settings.apiUrl, apiKey: "", model: settings.model });
    setError("");
    setEditing(true);
  }

  function handleCancelEdit() {
    setDraft({ apiUrl: settings.apiUrl, apiKey: "", model: settings.model });
    setError("");
    setEditing(false);
  }

  async function handleSave() {
    const next = { ...draft, model: normalizeModel(draft.model) };
    setSaving(true);
    setError("");
    try {
      await onSave(next);
      setDraft({ ...next, apiKey: "" });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  const inputReadOnly = !editing;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">API 设置</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {editing ? "编辑中：留空 API Key 将保留服务端现有 Key。" : "设置保存在后端；前端只显示掩码，不保存真实 Key。"}
            </p>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={handleEdit}
              className="shrink-0 rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              编辑
            </button>
          ) : null}
        </div>

        <label className="mb-1 block text-sm text-zinc-400">API URL</label>
        <input
          readOnly={inputReadOnly}
          className={[
            "mb-4 w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm outline-none",
            inputReadOnly
              ? "cursor-default bg-zinc-800/80 text-zinc-300"
              : "bg-zinc-800 text-zinc-100 focus:border-indigo-500",
          ].join(" ")}
          value={draft.apiUrl}
          onChange={(e) => setDraft({ ...draft, apiUrl: e.target.value })}
        />

        <label className="mb-1 block text-sm text-zinc-400">API Key</label>
        <input
          type={editing ? "password" : "text"}
          readOnly={inputReadOnly}
          className={[
            "mb-4 w-full rounded-lg border border-zinc-700 px-3 py-2 font-mono text-sm outline-none",
            inputReadOnly
              ? "cursor-default bg-zinc-800/80 text-zinc-300"
              : "bg-zinc-800 text-zinc-100 focus:border-indigo-500",
          ].join(" ")}
          value={editing ? draft.apiKey : settings.maskedApiKey}
          onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          placeholder={editing && settings.hasApiKey ? "留空则保留现有 Key" : "输入服务端 API Key"}
        />

        <label className="mb-1 block text-sm text-zinc-400">模型</label>
        {editing ? (
          <>
            <select
              className="mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
              value={MODEL_QUICK_OPTIONS.some((o) => o.value === draft.model) ? draft.model : "__custom__"}
              onChange={(e) => {
                if (e.target.value !== "__custom__") setDraft({ ...draft, model: e.target.value });
                else setDraft({ ...draft, model: "" });
              }}
            >
              {MODEL_QUICK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
              <option value="__custom__">自定义模型名…</option>
            </select>
            {!MODEL_QUICK_OPTIONS.some((o) => o.value === draft.model) && (
              <input
                autoFocus
                className="mb-6 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500"
                value={draft.model}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder="输入模型名，如 qwen3-coder-next"
              />
            )}
            {MODEL_QUICK_OPTIONS.some((o) => o.value === draft.model) && <div className="mb-6" />}
          </>
        ) : (
          <input
            readOnly
            className="mb-6 w-full cursor-default rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-300 outline-none"
            value={draft.model}
          />
        )}

        {error ? (
          <p className="mb-3 rounded-lg border border-red-700/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
