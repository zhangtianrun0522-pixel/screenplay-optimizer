"use client";

import { useState, useEffect } from "react";

interface Episode {
  index: number;
  title: string;
  content: string;
}

interface LocalizeEpisodeResult extends Episode {
  notes?: string;
}

interface Assets {
  characters: { name: string; aliases: string[]; emotionTags: string[]; appearsIn: number[]; description: string; referenceImages: unknown[] }[];
  scenes: { name: string; aliases: string[]; description: string; appearsIn: number[]; referenceImages: unknown[] }[];
  props: { name: string; aliases: string[]; description: string; appearsIn: number[]; referenceImages: unknown[] }[];
}

interface Issue {
  id: string;
  episode: number;
  type: string;
  description: string;
  suggestion: string;
  fixOptions?: {
    label?: string;
    suggestion?: string;
    text?: string;
    targetEpisode?: number;
    rationale?: string;
    recommended?: boolean;
  }[];
  textSnippet: string;
  severity: "高" | "中" | "低";
  status?: "open" | "ignored" | "resolved";
}

interface AuditResult {
  report: string;
  issues: Issue[];
  adopted: boolean;
}

interface PacingMetrics {
  information: number;
  conflict: number;
  emotion: number;
  momentum: number;
  suspense: number;
}

interface PacingBeat {
  id: string;
  episode: number;
  order: number;
  function: string;
  summary: string;
  textSnippet: string;
  metrics: PacingMetrics;
  diagnosis: string;
  suggestion?: string;
}

interface PacingBeatFocus {
  id: string;
  episode: number;
  type: string;
  description: string;
  suggestion: string;
  fixOptions?: {
    label?: string;
    suggestion?: string;
    text?: string;
    targetEpisode?: number;
    rationale?: string;
    recommended?: boolean;
  }[];
  textSnippet: string;
  severity: "高" | "中" | "低";
}

interface PacingResult extends AuditResult {
  beats: PacingBeat[];
}

interface ModuleResults {
  continuity?: AuditResult;
  pacing?: PacingResult;
  localize?: LocalizeEpisodeResult[];
  aiReady?: Episode[];
}

interface Props {
  episodes: Episode[];
  assets: Assets | null;
  settings: { apiUrl: string; apiKey: string; model: string };
  onFinalEpisodesReady?: (episodes: Episode[]) => void;
  onModulesComplete?: (completedKeys: string[], rewriteReady: boolean) => void;
  onIssuesUpdate?: (issues: Issue[]) => void;
  onIssueFocus?: (issue: Issue) => void;
  onPacingBeatFocus?: (beat: PacingBeatFocus) => void;
  onIssueAction?: (issueId: string, action: "ai" | "ignore", options?: {
    selectedSuggestion?: string;
    targetEpisode?: number;
    userCorrection?: string;
  }) => void;
  issueActionBusyId?: string | null;
  issueStatuses?: Record<string, "open" | "ignored" | "resolved">;
  onIssueRestore?: (issueId: string) => void;
  onOpenPacingDetail?: (result: PacingResult) => void;
  activeEpisode?: number;
  extraPacingIssues?: Issue[];
  onRemoveExtraPacingIssue?: (id: string) => void;
  pacingEpisodeUpdate?: { episode: number; beats: unknown[]; issues: unknown[] } | null;
  activeEpisodeIsStaleForPacing?: boolean;
  onReanalyzePacingEpisode?: () => void;
  reanalyzingPacingEpisode?: boolean;
  onApplyLocalizeEpisode?: (episodeNumber: number, content: string) => void;
}

const MODULE_CONFIG = [
  { key: "continuity" as const, label: "连续性审查", type: "audit" as const },
  { key: "pacing" as const, label: "节奏优化", type: "audit" as const },
  { key: "localize" as const, label: "台词本地化", type: "rewrite" as const },
  { key: "aiReady" as const, label: "剧本AI化", type: "rewrite" as const },
];


function normalizeIssues(prefix: string, issues: Partial<Issue>[]) {
  return issues.map((issue, index) => {
    let severity = issue.severity;
    if (!severity) {
      if (issue.type === "开场钩" || issue.type === "集尾卡点") severity = "高";
      else if (issue.type === "主体推进" || issue.type === "信息密度") severity = "中";
      else severity = "中";
    }
    return {
      id: `${prefix}-${index}`,
      episode: issue.episode ?? 1,
      type: issue.type ?? "问题",
      description: issue.description ?? "",
      suggestion: issue.suggestion ?? "",
      fixOptions: Array.isArray(issue.fixOptions) ? issue.fixOptions : undefined,
      textSnippet: issue.textSnippet ?? "",
      severity,
      status: issue.status ?? "open",
    };
  });
}


function extractEpisodeReport(report: string, episode: number): string {
  if (!report) return "";
  const lines = report.split("\n");
  let capturing = false;
  const result: string[] = [];
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s*第(\d+)集/);
    if (match) {
      capturing = Number(match[1]) === episode;
    } else if (capturing) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

function issueFixOptions(issue: Issue) {
  return (issue.fixOptions ?? [])
    .map((option, index) => ({
      id: `${issue.id}-${index}`,
      label: option.label?.trim() || `方案 ${String.fromCharCode(65 + index)}`,
      text: (option.suggestion ?? option.text ?? "").trim(),
      targetEpisode: option.targetEpisode,
      rationale: option.rationale,
      recommended: option.recommended,
    }))
    .filter((option) => option.text);
}


function normalizeMetric(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 3;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function normalizeBeats(beats: Partial<PacingBeat>[]) {
  return beats.map((beat, index) => {
    const episode = typeof beat.episode === "number" ? beat.episode : 1;
    const order = typeof beat.order === "number" ? beat.order : index;
    const metrics = (beat.metrics ?? {}) as Partial<Record<keyof PacingMetrics, unknown>>;

    return {
      id: beat.id?.trim() || `pace-beat-${episode}-${order}`,
      episode,
      order,
      function: beat.function?.trim() || "推进",
      summary: beat.summary?.trim() || "",
      textSnippet: beat.textSnippet?.trim() || "",
      metrics: {
        information: normalizeMetric(metrics.information),
        conflict: normalizeMetric(metrics.conflict),
        emotion: normalizeMetric(metrics.emotion),
        momentum: normalizeMetric(metrics.momentum),
        suspense: normalizeMetric(metrics.suspense),
      },
      diagnosis: beat.diagnosis?.trim() || "",
      suggestion: beat.suggestion?.trim() || undefined,
    };
  });
}

export default function OptimizeModulesPanel({ episodes, assets, settings, onFinalEpisodesReady, onModulesComplete, onIssuesUpdate, onIssueFocus, onPacingBeatFocus, onIssueAction, issueActionBusyId = null, issueStatuses = {}, onIssueRestore, onOpenPacingDetail, activeEpisode = 0, extraPacingIssues = [], onRemoveExtraPacingIssue, pacingEpisodeUpdate, activeEpisodeIsStaleForPacing = false, onReanalyzePacingEpisode, reanalyzingPacingEpisode = false, onApplyLocalizeEpisode }: Props) {
  const [modules, setModules] = useState({ continuity: true, pacing: true, localize: true, aiReady: true });
  const [localizeMarket, setLocalizeMarket] = useState("美国");
  const [localizeLanguage, setLocalizeLanguage] = useState("英语");
  const [running, setRunning] = useState(false);
  const [currentRunning, setCurrentRunning] = useState<string | null>(null);
  const [moduleResults, setModuleResults] = useState<ModuleResults | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [finalEpisodes, setFinalEpisodes] = useState<Episode[] | null>(null);
  const [cachedKey, setCachedKey] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [localizeStatuses, setLocalizeStatuses] = useState<Record<number, "pending" | "applied" | "edited">>({});
  const [localizeEditing, setLocalizeEditing] = useState<Record<number, boolean>>({});
  const [localizeEditContent, setLocalizeEditContent] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!pacingEpisodeUpdate) return;
    const { episode, beats: rawBeats, issues: rawIssues } = pacingEpisodeUpdate;
    const newBeats = normalizeBeats(rawBeats as Partial<PacingBeat>[]);
    const newIssues = normalizeIssues(`pace-ep${episode}`, rawIssues as Partial<Issue>[]);
    setModuleResults((prev) => {
      if (!prev?.pacing) return prev;
      const otherBeats = prev.pacing.beats.filter((b) => b.episode !== episode);
      const otherIssues = prev.pacing.issues.filter((i) => i.episode !== episode);
      return {
        ...prev,
        pacing: {
          ...prev.pacing,
          beats: [...otherBeats, ...newBeats].sort((a, b) => a.episode - b.episode || a.order - b.order),
          issues: [...otherIssues, ...newIssues],
        },
      };
    });
  }, [pacingEpisodeUpdate]);

  const toggleModule = (key: keyof typeof modules) =>
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleAdopt = (key: "continuity" | "pacing") => {
    setModuleResults((prev) => prev ? { ...prev, [key]: { ...prev[key]!, adopted: true } } : prev);
  };

  const handleDownload = (eps: Episode[], filename: string) => {
    const text = eps.map((ep) => `=== 第${ep.index}集 ${ep.title} ===\n\n${ep.content}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleRunModules = async () => {
    if (!Object.values(modules).some(Boolean)) return;

    const episodesKey = `pace-cache:${settings.model}:${episodes.map((e) => `${e.index}:${e.content.length}:${e.content.slice(0, 20)}`).join("|")}`;
    const storedKey = localStorage.getItem("optimize-modules-key");
    const storedCache = localStorage.getItem("optimize-modules-cache");
    if (storedKey === episodesKey && storedCache) {
      try {
        const cached = JSON.parse(storedCache) as ModuleResults;
        setRunning(true);
        setCurrentRunning("从缓存加载");
        await new Promise((r) => setTimeout(r, 300));
        setModuleResults(cached);
        setExpanded(new Set(Object.keys(cached)));
        onIssuesUpdate?.([
          ...(cached.continuity?.issues ?? []),
          ...(cached.pacing?.issues ?? []),
        ]);
        setCachedKey(episodesKey);
        setRunning(false);
        setCurrentRunning(null);
        return;
      } catch { /* ignore, fall through to API */ }
    }

    setRunning(true);
    setModuleResults(null);
    setWarnings([]);
    setFinalEpisodes(null);
    setLocalizeStatuses({});
    setLocalizeEditing({});
    setLocalizeEditContent({});

    const results: ModuleResults = {};
    const warns: string[] = [];
    const completedKeys: string[] = [];
    let workingEpisodes = episodes;
    let rewriteReady = false;

    try {
      if (modules.continuity) {
        setCurrentRunning("连续性审查");
        const res = await fetch("/api/optimize/continuity-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodes: workingEpisodes, assets, settings }),
        });
        const data = await res.json() as { report?: string; issues?: Issue[]; error?: string };
        if (data.error) warns.push(`连续性审查失败：${data.error}`);
        else {
          results.continuity = { report: data.report ?? "", issues: normalizeIssues("cont", data.issues ?? []), adopted: false };
          completedKeys.push("continuity");
        }
      }

      if (modules.pacing) {
        setCurrentRunning("节奏优化");
        const res = await fetch("/api/optimize/pacing-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodes: workingEpisodes, settings }),
        });
        const data = await res.json() as { report?: string; beats?: PacingBeat[]; issues?: Issue[]; error?: string };
        if (data.error) warns.push(`节奏优化失败：${data.error}`);
        else {
          results.pacing = {
            report: data.report ?? "",
            beats: normalizeBeats(Array.isArray(data.beats) ? data.beats : []),
            issues: normalizeIssues("pace", data.issues ?? []),
            adopted: false,
          };
          completedKeys.push("pacing");
        }
      }

      if (modules.localize) {
        setCurrentRunning("台词本地化");
        const res = await fetch("/api/optimize/localize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodes: workingEpisodes,
            targetMarket: localizeMarket,
            targetLanguage: localizeLanguage,
            characterNames: assets?.characters.map((asset) => asset.name) ?? [],
            settings,
          }),
        });
        const data = await res.json() as { episodes?: LocalizeEpisodeResult[]; error?: string };
        if (data.error) warns.push(`台词本地化失败：${data.error}`);
        else {
          results.localize = data.episodes ?? [];
          if (results.localize.length > 0) {
            workingEpisodes = results.localize;
            rewriteReady = true;
          }
          completedKeys.push("localize");
        }
      }

      if (modules.aiReady) {
        setCurrentRunning("剧本AI化");
        const res = await fetch("/api/optimize/ai-ready", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodes: workingEpisodes, assets, settings }),
        });
        const data = await res.json() as { episodes?: Episode[]; error?: string };
        if (data.error) warns.push(`剧本AI化失败：${data.error}`);
        else {
          results.aiReady = data.episodes ?? [];
          if (results.aiReady.length > 0) {
            workingEpisodes = results.aiReady;
            rewriteReady = true;
          }
          completedKeys.push("aiReady");
        }
      }

      setModuleResults(results);
      try {
        localStorage.setItem("optimize-modules-key", episodesKey);
        localStorage.setItem("optimize-modules-cache", JSON.stringify(results));
        setCachedKey(episodesKey);
      } catch { /* quota exceeded, ignore */ }
      onIssuesUpdate?.([
        ...(results.continuity?.issues ?? []),
        ...(results.pacing?.issues ?? []),
      ]);
      setWarnings(warns);
      setExpanded(new Set(Object.keys(results)));
      setFinalEpisodes(rewriteReady ? workingEpisodes : null);
      onModulesComplete?.(completedKeys, rewriteReady);
    } catch (e) {
      setWarnings([...warns, `运行出错：${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setRunning(false);
      setCurrentRunning(null);
    }
  };

  return (
    <div className="border-t border-zinc-800">
      <div className="px-4 pb-2 pt-4">
        <h3 className="text-sm font-semibold text-zinc-300">优化模块</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          每次采用改写或局部修改后，资产会标记为需要更新；场面组合始终跟随当前剧本版本。
        </p>
      </div>

      {/* 模块选择 */}
      <div className="space-y-0.5 px-4 pb-3">
        {MODULE_CONFIG.map((mod) => (
          <div key={mod.key}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/50">
              <input
                type="checkbox"
                checked={modules[mod.key]}
                onChange={() => toggleModule(mod.key)}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              <span className="text-zinc-300">{mod.label}</span>
              <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium ${
                mod.type === "audit" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"
              }`}>
                {mod.type === "audit" ? "审查" : "改写"}
              </span>
            </label>

            {mod.key === "localize" && modules.localize && (
              <div className="ml-6 mt-1 flex gap-2 pb-1">
                <div className="flex-1">
                  <p className="mb-0.5 text-[10px] text-zinc-500">目标市场</p>
                  <input value={localizeMarket} onChange={(e) => setLocalizeMarket(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-emerald-500/50" />
                </div>
                <div className="flex-1">
                  <p className="mb-0.5 text-[10px] text-zinc-500">目标语言</p>
                  <input value={localizeLanguage} onChange={(e) => setLocalizeLanguage(e.target.value)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300 outline-none focus:border-emerald-500/50" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 缓存提示 */}
      {cachedKey && cachedKey === `pace-cache:${settings.model}:${episodes.map((e) => `${e.index}:${e.content.length}:${e.content.slice(0, 20)}`).join("|")}` && (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5">
          <span className="text-[11px] text-zinc-500">上次结果已缓存</span>
          <button
            type="button"
            className="text-[11px] text-zinc-500 transition hover:text-amber-400"
            onClick={() => {
              localStorage.removeItem("optimize-modules-key");
              localStorage.removeItem("optimize-modules-cache");
              setModuleResults(null);
              setCachedKey(null);
            }}
          >
            清除缓存
          </button>
        </div>
      )}

      {/* 运行按钮 */}
      <div className="px-4 pb-4">
        {!episodes.length && (
          <p className="mb-2 rounded-lg border border-amber-600/30 bg-amber-950/20 px-3 py-1.5 text-[11px] text-amber-400">
            请先在上方上传并拆分剧本
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleRunModules()}
          disabled={running || !Object.values(modules).some(Boolean) || !episodes.length}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (currentRunning ? `正在运行：${currentRunning}…` : "运行中…") : "运行选中模块"}
        </button>

        {running && (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">
                {currentRunning ?? "准备中"}
                {currentRunning === "节奏优化" && episodes.length > 4 && (
                  <span className="ml-1.5 text-zinc-600">
                    （共 {Math.ceil(episodes.length / 4)} 批）
                  </span>
                )}
              </span>
              <span className="tabular-nums text-zinc-500">
                {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: "40%",
                  animation: "slide-progress 1.4s ease-in-out infinite",
                }}
              />
            </div>
            <style>{`
              @keyframes slide-progress {
                0%   { transform: translateX(-200%); }
                100% { transform: translateX(350%); }
              }
            `}</style>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (finalEpisodes && finalEpisodes.length > 0) {
              onFinalEpisodesReady?.(finalEpisodes);
            }
          }}
          disabled={!finalEpisodes || finalEpisodes.length === 0}
          className="mt-3 w-full rounded-lg border border-emerald-600/50 bg-emerald-950/30 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-500 hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/40 disabled:text-zinc-600"
        >
          采用改写为当前剧本
        </button>
        {!finalEpisodes && (
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            可先运行诊断模块定位问题；运行台词本地化或剧本AI化后，可将改写版采用为当前剧本。
          </p>
        )}
      </div>

      {/* 警告 */}
      {warnings.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-600/30 bg-amber-950/20 p-2">
          {warnings.map((w, i) => <p key={i} className="text-[11px] text-amber-400">{w}</p>)}
        </div>
      )}

      {/* 结果展示 */}
      {moduleResults && (
        <div className="space-y-2 px-4 pb-4">
          {/* 连续性审查结果 */}
          {moduleResults.continuity && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
              <button type="button" onClick={() => toggleExpand("continuity")}
                className="flex w-full items-center justify-between px-3 py-2 text-left">
                <span className="text-xs font-semibold text-zinc-300">连续性审查结果</span>
                <span className="text-zinc-500">{expanded.has("continuity") ? "▲" : "▼"}</span>
              </button>
              {expanded.has("continuity") && (
                <div className="border-t border-zinc-800 p-3">
                  <pre className="mb-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] text-zinc-400 leading-relaxed">
                    {moduleResults.continuity.report || "无报告内容"}
                  </pre>
                  {moduleResults.continuity.issues.filter((i) => issueStatuses[i.id] !== "resolved").length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-[10px] text-zinc-500">
                        共 {moduleResults.continuity.issues.filter((i) => issueStatuses[i.id] !== "resolved").length} 条问题，点击卡片定位到正文片段。
                      </p>
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {moduleResults.continuity.issues.filter((i) => issueStatuses[i.id] !== "resolved").map((issue) => {
                        const status = issueStatuses[issue.id] ?? issue.status ?? "open";
                        const isIgnored = status === "ignored";
                        return (
                          <div key={issue.id} className={`relative rounded border p-2 text-[11px] transition ${
                            isIgnored
                              ? "border-zinc-800 bg-zinc-950/35 opacity-60"
                              : "border-zinc-700 bg-zinc-950/60 hover:border-emerald-700/70 hover:bg-zinc-900/80"
                          }`}>
                            {isIgnored && (
                              <button
                                type="button"
                                onClick={() => onIssueRestore?.(issue.id)}
                                className="absolute right-2 top-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-emerald-600 hover:text-emerald-300"
                              >
                                重新激活
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isIgnored}
                              onClick={() => onIssueFocus?.(issue)}
                              className="block w-full text-left disabled:cursor-default"
                            >
                              <div className="mb-1 flex items-center gap-2 pr-14">
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">第{issue.episode}集</span>
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">{issue.type}</span>
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-500">{isIgnored ? "已忽略" : issue.severity}</span>
                              </div>
                              <p className={`mb-1 ${isIgnored ? "text-zinc-500 line-through decoration-zinc-700" : "text-zinc-300"}`}>{issue.description}</p>
                              <p className={isIgnored ? "text-zinc-600" : "text-emerald-400/80"}>建议：{issue.suggestion}</p>
                            </button>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 节奏优化结果 */}
          {moduleResults.pacing && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
              <button type="button" onClick={() => toggleExpand("pacing")}
                className="flex w-full items-center justify-between px-3 py-2 text-left">
                <span className="text-xs font-semibold text-zinc-300">节奏优化结果</span>
                <span className="text-zinc-500">{expanded.has("pacing") ? "▲" : "▼"}</span>
              </button>
              {expanded.has("pacing") && (
                <div className="border-t border-zinc-800 p-3">
                  {moduleResults.pacing.beats.length > 0 && onOpenPacingDetail && (
                    <button
                      type="button"
                      onClick={() => onOpenPacingDetail(moduleResults.pacing!)}
                      className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-950/30 py-2 text-xs font-medium text-emerald-300 transition hover:border-emerald-500 hover:bg-emerald-900/40"
                    >
                      展开节奏详情
                      <span className="text-emerald-500">→</span>
                    </button>
                  )}
                  {activeEpisode > 0 && onReanalyzePacingEpisode && (
                    <button
                      type="button"
                      disabled={!activeEpisodeIsStaleForPacing || reanalyzingPacingEpisode}
                      onClick={onReanalyzePacingEpisode}
                      className={`mb-3 flex w-full items-center justify-center rounded-lg border py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${
                        activeEpisodeIsStaleForPacing
                          ? "border-sky-600/50 bg-sky-950/30 text-sky-300 hover:border-sky-500 hover:bg-sky-900/40"
                          : "border-zinc-700 bg-zinc-900/30 text-zinc-600 hover:bg-zinc-900/30"
                      }`}
                    >
                      {reanalyzingPacingEpisode ? "分析中..." : activeEpisodeIsStaleForPacing ? "剧本已修改 · 重新分析本集" : "重新分析本集"}
                    </button>
                  )}
                  {(() => {
                    const epReport = activeEpisode
                      ? extractEpisodeReport(moduleResults.pacing.report, activeEpisode)
                      : "";
                    return epReport ? (
                      <pre className="mb-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">
                        {epReport}
                      </pre>
                    ) : null;
                  })()}
                  {(() => {
                    const highIssues = moduleResults.pacing.issues.filter(
                      (i) => i.severity === "高" && (!activeEpisode || i.episode === activeEpisode) && issueStatuses[i.id] !== "resolved"
                    );
                    return highIssues.length > 0 ? (
                    <div className="mb-3">
                      <p className="mb-2 text-[10px] text-zinc-500">
                        {activeEpisode ? `第 ${activeEpisode} 集` : "全部"} · 高优先级问题 {highIssues.length} 条
                      </p>
                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {highIssues.map((issue) => {
                        const status = issueStatuses[issue.id] ?? issue.status ?? "open";
                        const isIgnored = status === "ignored";
                        const fixOptions = issueFixOptions(issue);
                        return (
                          <div key={issue.id} className={`relative rounded border p-2 text-[11px] transition ${
                            isIgnored
                              ? "border-zinc-800 bg-zinc-950/35 opacity-60"
                              : "border-zinc-700 bg-zinc-950/60 hover:border-emerald-700/70 hover:bg-zinc-900/80"
                          }`}>
                            {isIgnored && (
                              <button
                                type="button"
                                onClick={() => onIssueRestore?.(issue.id)}
                                className="absolute right-2 top-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 transition hover:border-emerald-600 hover:text-emerald-300"
                              >
                                重新激活
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isIgnored}
                              onClick={() => onIssueFocus?.(issue)}
                              className="block w-full text-left disabled:cursor-default"
                            >
                              <div className="mb-1 flex items-center gap-2 pr-14">
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">第{issue.episode}集</span>
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">{issue.type}</span>
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-500">{isIgnored ? "已忽略" : issue.severity}</span>
                              </div>
                              <p className={`mb-1 ${isIgnored ? "text-zinc-500 line-through decoration-zinc-700" : "text-zinc-300"}`}>{issue.description}</p>
                              <p className={isIgnored ? "text-zinc-600" : "text-emerald-400/80"}>建议：{issue.suggestion}</p>
                            </button>
                            {!isIgnored && fixOptions.length > 0 && (
                              <div className="mt-2 space-y-1.5 border-t border-zinc-800 pt-2">
                                {fixOptions.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    disabled={issueActionBusyId === issue.id}
                                    onClick={() => onIssueAction?.(issue.id, "ai", {
                                      selectedSuggestion: option.text,
                                      targetEpisode: option.targetEpisode,
                                    })}
                                    className="block w-full rounded border border-emerald-700/45 bg-emerald-950/30 px-2 py-1.5 text-left text-[10px] text-emerald-100 transition hover:border-emerald-500 hover:bg-emerald-900/40 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/60 disabled:text-zinc-500"
                                  >
                                    <span className="mb-0.5 flex flex-wrap items-center gap-1.5">
                                      <span className="font-medium">{issueActionBusyId === issue.id ? "修改中..." : option.label}</span>
                                      {option.recommended && (
                                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-200">推荐</span>
                                      )}
                                    </span>
                                    <span className="block leading-4">{option.text}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  ) : null;
                  })()}
                  {extraPacingIssues.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-[10px] text-zinc-500">
                        已采纳（来自节奏详情）{extraPacingIssues.length} 条
                      </p>
                      <div className="space-y-2">
                        {extraPacingIssues.map((issue) => (
                          <div key={issue.id} className="relative rounded border border-zinc-700 bg-zinc-950/60 p-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => onRemoveExtraPacingIssue?.(issue.id)}
                              className="absolute right-2 top-2 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 transition hover:border-rose-600 hover:text-rose-400"
                            >
                              移除
                            </button>
                            <div className="mb-1 flex items-center gap-2 pr-14">
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">第{issue.episode}集</span>
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">{issue.type}</span>
                              <span className={`rounded px-1.5 py-0.5 ${issue.severity === "高" ? "bg-rose-500/10 text-rose-400" : issue.severity === "中" ? "bg-amber-500/10 text-amber-400" : "bg-zinc-800 text-zinc-500"}`}>{issue.severity}</span>
                            </div>
                            <p className="mb-1 text-zinc-300">{issue.description}</p>
                            <p className="text-emerald-400/80">建议：{issue.suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 台词本地化结果 */}
          {moduleResults.localize && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
              <button type="button" onClick={() => toggleExpand("localize")}
                className="flex w-full items-center justify-between px-3 py-2 text-left">
                <span className="text-xs font-semibold text-zinc-300">
                  台词本地化结果 · {moduleResults.localize.length} 集
                </span>
                <span className="text-zinc-500">{expanded.has("localize") ? "▲" : "▼"}</span>
              </button>
              {expanded.has("localize") && (
                <div className="border-t border-zinc-800 p-3 space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const newStatuses: Record<number, "applied"> = {};
                        moduleResults.localize!.forEach((ep) => {
                          newStatuses[ep.index] = "applied";
                          onApplyLocalizeEpisode?.(ep.index, ep.content);
                        });
                        setLocalizeStatuses((prev) => ({ ...prev, ...newStatuses }));
                        onFinalEpisodesReady?.(moduleResults.localize!);
                      }}
                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                    >
                      一键全部按AI建议修改
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(moduleResults.localize!, "localized_script.txt")}
                      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-300"
                    >
                      下载
                    </button>
                  </div>
                  <div className="space-y-2">
                    {moduleResults.localize.map((ep) => (
                      <div key={ep.index} className="rounded border border-zinc-700 bg-zinc-950/60 p-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => toggleExpand(`localize-${ep.index}`)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span className="font-medium text-zinc-300">第 {ep.index} 集 · {ep.title}</span>
                          <div className="flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] ${
                              localizeStatuses[ep.index] === "applied"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : localizeStatuses[ep.index] === "edited"
                                ? "bg-sky-500/15 text-sky-400"
                                : "bg-zinc-800 text-zinc-500"
                            }`}>
                              {localizeStatuses[ep.index] === "applied" ? "已应用" : localizeStatuses[ep.index] === "edited" ? "已编辑" : "待处理"}
                            </span>
                            <span className="text-zinc-600">{expanded.has(`localize-${ep.index}`) ? "▲" : "▼"}</span>
                          </div>
                        </button>
                        {expanded.has(`localize-${ep.index}`) && (
                          <div className="mt-2 space-y-2">
                            {ep.notes && (
                              <p className="rounded bg-zinc-800/50 px-2 py-1 text-[10px] leading-relaxed text-zinc-400">
                                {ep.notes}
                              </p>
                            )}
                            <p className="text-[10px] leading-relaxed text-zinc-500">
                              {ep.content.slice(0, 150)}{ep.content.length > 150 ? "…" : ""}
                            </p>
                            {localizeEditing[ep.index] ? (
                              <div className="space-y-1.5">
                                <textarea
                                  className="w-full rounded border border-zinc-700 bg-zinc-900 p-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500/50"
                                  rows={6}
                                  value={localizeEditContent[ep.index] ?? ep.content}
                                  onChange={(e) =>
                                    setLocalizeEditContent((prev) => ({ ...prev, [ep.index]: e.target.value }))
                                  }
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const content = localizeEditContent[ep.index] ?? ep.content;
                                      onApplyLocalizeEpisode?.(ep.index, content);
                                      setLocalizeStatuses((prev) => ({ ...prev, [ep.index]: "edited" }));
                                      setLocalizeEditing((prev) => ({ ...prev, [ep.index]: false }));
                                    }}
                                    className="rounded border border-emerald-700/45 bg-emerald-950/30 px-2 py-1 text-[10px] text-emerald-100 transition hover:border-emerald-500 hover:bg-emerald-900/40"
                                  >
                                    确认应用
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setLocalizeEditing((prev) => ({ ...prev, [ep.index]: false }))}
                                    className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-300"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onApplyLocalizeEpisode?.(ep.index, ep.content);
                                    setLocalizeStatuses((prev) => ({ ...prev, [ep.index]: "applied" }));
                                  }}
                                  className="rounded border border-emerald-700/45 bg-emerald-950/30 px-2 py-1 text-[10px] text-emerald-100 transition hover:border-emerald-500 hover:bg-emerald-900/40"
                                >
                                  直接应用AI建议
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLocalizeEditContent((prev) => ({ ...prev, [ep.index]: ep.content }));
                                    setLocalizeEditing((prev) => ({ ...prev, [ep.index]: true }));
                                  }}
                                  className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-300 transition hover:border-zinc-500"
                                >
                                  人工修改后应用
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 剧本AI化结果 */}
          {moduleResults.aiReady && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-zinc-300">剧本AI化完成</p>
                  <p className="text-[11px] text-zinc-500">共 {moduleResults.aiReady.length} 集</p>
                </div>
                <button type="button"
                  onClick={() => handleDownload(moduleResults.aiReady!, "ai_ready_script.txt")}
                  className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs text-white transition hover:bg-emerald-500">
                  下载改写版
                </button>
              </div>
            </div>
          )}
          {finalEpisodes && finalEpisodes.length > 0 ? (
            <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-3">
              <p className="text-xs font-semibold text-emerald-100">改写版已准备采用</p>
              <p className="mt-1 text-[11px] leading-relaxed text-emerald-200/70">
                采用后会替换中栏当前剧本；若已有资产，会提示刷新资产以同步场面组合。
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs font-semibold text-zinc-200">诊断已生成，尚无改写稿</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                连续性/节奏审查只生成问题清单，不会自动改正文。要生成整稿改写，请运行台词本地化或剧本AI化；也可以点击问题卡定位后做局部 AI 修改。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
