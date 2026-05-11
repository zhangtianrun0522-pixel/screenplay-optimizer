"use client";
import React, { useState, useMemo, useEffect, useCallback } from "react";

interface PacingMetrics { information: number; conflict: number; emotion: number; momentum: number; suspense: number; }
interface PacingBeat { id: string; episode: number; order: number; function: string; summary: string; textSnippet: string; metrics: PacingMetrics; diagnosis: string; suggestion?: string; }
export interface PacingResult { report: string; beats: PacingBeat[]; issues: unknown[]; }
interface EpisodeInput { index: number; title: string; content: string; }
interface Props { result: PacingResult; onClose: () => void; episodes?: EpisodeInput[]; settings?: { apiUrl: string; apiKey: string; model: string }; onResultUpdate?: (result: PacingResult) => void; onAdoptIssue?: (issue: AdoptedIssue) => void; contentSnapshot?: Record<number, string>; }

const metricKeys: (keyof PacingMetrics)[] = ["information","conflict","emotion","momentum","suspense"];
const metricLabels: Record<keyof PacingMetrics, string> = { information:"信息",conflict:"冲突",emotion:"情感",momentum:"动能",suspense:"悬念" };

function getColorHex(value: number): string { if (value <= 2) return "#f43f5e"; if (value <= 3) return "#fbbf24"; return "#10b981"; }
function metricTextClass(value: number): string { if (value <= 2) return "text-rose-400"; if (value <= 3) return "text-amber-400"; return "text-zinc-400"; }

interface AdoptedIssue {
  id: string; episode: number; type: string; description: string;
  suggestion: string;
  fixOptions?: { label?: string; suggestion?: string; targetEpisode?: number; recommended?: boolean }[];
  textSnippet: string; severity: "高" | "中" | "低"; status: "open";
}

function BeatCard({
  beat, idx, adoptions, customInputs, editingId,
  setAdoptions, setCustomInputs, setEditingId, setModifiedEps,
  onAdoptIssue, settings,
}: {
  beat: PacingBeat;
  idx: number;
  adoptions: Record<string, "ai" | "custom">;
  customInputs: Record<string, string>;
  editingId: string | null;
  setAdoptions: React.Dispatch<React.SetStateAction<Record<string, "ai" | "custom">>>;
  setCustomInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  setModifiedEps: React.Dispatch<React.SetStateAction<Set<number>>>;
  onAdoptIssue?: (issue: AdoptedIssue) => void;
  settings?: { apiUrl: string; apiKey: string; model: string };
}) {
  const [draft, setDraft] = React.useState(customInputs[beat.id] ?? beat.suggestion ?? "");
  const [analyzingCustom, setAnalyzingCustom] = React.useState(false);
  const adoption = adoptions[beat.id];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
          {beat.function}
        </span>
        <span className="text-[10px] text-zinc-600">#{idx + 1}</span>
      </div>
      <p className="text-xs text-zinc-200 leading-relaxed">{beat.summary}</p>
      <div className="font-mono text-[11px] text-zinc-500 bg-zinc-950/50 p-2 rounded leading-relaxed">
        &ldquo;{beat.textSnippet}&rdquo;
      </div>
      <div className="flex gap-4 flex-wrap">
        {metricKeys.map((k) => (
          <div key={k} className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-600">{metricLabels[k]}</span>
            <span className={`text-xs font-semibold ${metricTextClass(beat.metrics[k])}`}>
              {beat.metrics[k]}
            </span>
          </div>
        ))}
      </div>
      <div>
        <span className="text-[10px] text-zinc-600">诊断</span>
        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{beat.diagnosis}</p>
      </div>
      {beat.suggestion && (
        <div className="space-y-2">
          <div>
            <span className="text-[10px] text-emerald-600/60">建议</span>
            <p className="text-xs text-emerald-400/80 mt-0.5 leading-relaxed">{beat.suggestion}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {adoption === "ai" ? (
              <>
                <span className="text-[11px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                  ✓ 已采纳
                </span>
                <button
                  onClick={() => setAdoptions((prev) => { const n = { ...prev }; delete n[beat.id]; return n; })}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  撤销
                </button>
              </>
            ) : adoption === "custom" ? (
              <>
                <span className="text-[11px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                  ✓ 自定义
                </span>
                <span className="text-[11px] text-zinc-500 truncate max-w-[160px]">
                  {customInputs[beat.id]}
                </span>
                <button
                  onClick={() => setAdoptions((prev) => { const n = { ...prev }; delete n[beat.id]; return n; })}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  撤销
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  const vals = Object.values(beat.metrics) as number[];
                  const minM = vals.length ? Math.min(...vals) : 3;
                  const severity: "高" | "中" | "低" = minM <= 2 ? "高" : minM <= 3 ? "中" : "低";
                  const issue: AdoptedIssue = {
                    id: `adopt-beat-${beat.id}-${Date.now()}`,
                    episode: beat.episode, type: beat.function,
                    description: beat.diagnosis, suggestion: beat.suggestion ?? "",
                    textSnippet: beat.textSnippet, severity, status: "open",
                    fixOptions: [{ label: "方案 A", suggestion: beat.suggestion ?? "", targetEpisode: beat.episode, recommended: true }],
                  };
                  onAdoptIssue?.(issue);
                  setAdoptions((prev) => ({ ...prev, [beat.id]: "ai" }));
                  setModifiedEps((prev) => { const n = new Set(prev); n.add(beat.episode); return n; });
                }}
                className="text-[11px] text-emerald-500/80 hover:text-emerald-400 border border-emerald-700/40 px-2 py-0.5 rounded transition-colors"
              >
                采纳建议
              </button>
            )}
            <button
              onClick={() => setEditingId(beat.id)}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 px-2 py-0.5 rounded transition-colors ml-auto"
            >
              自定义
            </button>
          </div>
        </div>
      )}
      {editingId === beat.id && (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 resize-none"
            placeholder="输入自定义修改意见..."
          />
          <div className="flex gap-2 items-center">
            <button
              disabled={analyzingCustom}
              onClick={async () => {
                setCustomInputs((prev) => ({ ...prev, [beat.id]: draft }));
                setAdoptions((prev) => ({ ...prev, [beat.id]: "custom" }));
                setModifiedEps((prev) => { const n = new Set(prev); n.add(beat.episode); return n; });
                if (draft.trim() && settings && onAdoptIssue) {
                  setAnalyzingCustom(true);
                  try {
                    const res = await fetch("/api/optimize/beat-to-issue", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ beat: { episode: beat.episode, function: beat.function, summary: beat.summary, diagnosis: beat.diagnosis, textSnippet: beat.textSnippet, metrics: beat.metrics }, customText: draft, settings }),
                    });
                    const data = await res.json() as { issue?: AdoptedIssue };
                    if (data.issue) onAdoptIssue(data.issue);
                  } catch { /* ignore */ } finally {
                    setAnalyzingCustom(false);
                  }
                }
                setEditingId(null);
              }}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
            >
              {analyzingCustom ? "生成中..." : "确认"}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-[11px] text-zinc-400 hover:text-zinc-300"
            >
              取消
            </button>
            {analyzingCustom && <span className="text-[11px] text-zinc-500 ml-1">正在生成问题卡...</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PacingDetailPanel({ result, onClose, episodes, settings, onResultUpdate, onAdoptIssue, contentSnapshot }: Props) {
  const [localBeats, setLocalBeats] = useState<PacingBeat[]>(result.beats);
  const [adoptions, setAdoptions] = useState<Record<string, 'ai' | 'custom'>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reanalyzingEp, setReanalyzingEp] = useState<number | null>(null);
  const [modifiedEps, setModifiedEps] = useState<Set<number>>(new Set());
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [localSnapshot, setLocalSnapshot] = useState<Record<number, string>>(contentSnapshot ?? {});

  useEffect(() => {
    setLocalBeats(result.beats);
    setModifiedEps(new Set());
  }, [result.beats]);

  const episodesList = useMemo(() => { const eps = new Set<number>(); localBeats.forEach((b) => eps.add(b.episode)); return Array.from(eps).sort((a, b) => a - b); }, [localBeats]);

  const staleEps = useMemo(() => {
    const s = new Set<number>();
    if (!episodes) return s;
    episodesList.forEach((ep) => {
      const current = episodes.find((e) => e.index === ep)?.content;
      if (current !== undefined && localSnapshot[ep] !== undefined && current !== localSnapshot[ep]) s.add(ep);
    });
    return s;
  }, [episodes, episodesList, localSnapshot]);

  const epData = useMemo(() => {
    const map = new Map<number, { metrics: PacingMetrics; avg: number; count: number }>();
    const grouped = new Map<number, PacingBeat[]>();
    localBeats.forEach((b) => { const group = grouped.get(b.episode) ?? []; group.push(b); grouped.set(b.episode, group); });
    grouped.forEach((beats, ep) => {
      const sum: PacingMetrics = { information:0,conflict:0,emotion:0,momentum:0,suspense:0 };
      beats.forEach((b) => { metricKeys.forEach((k) => { sum[k] += b.metrics[k]; }); });
      const n = beats.length;
      const avgMetrics: PacingMetrics = { information:sum.information/n,conflict:sum.conflict/n,emotion:sum.emotion/n,momentum:sum.momentum/n,suspense:sum.suspense/n };
      const avg = metricKeys.reduce((s,k) => s+avgMetrics[k],0)/metricKeys.length;
      map.set(ep,{metrics:avgMetrics,avg,count:n});
    });
    return map;
  }, [localBeats]);

  const currentBeats = useMemo(() => { if (selectedEpisode === null) return []; return localBeats.filter((b) => b.episode === selectedEpisode).sort((a,b) => a.order-b.order); }, [localBeats,selectedEpisode]);

  const handleReanalyze = useCallback(async (ep: number) => {
    if (!episodes) return;
    const epData = episodes.find(e => e.index === ep);
    if (!epData) return;

    setReanalyzingEp(ep);
    try {
      const res = await fetch('/api/optimize/pacing-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodes: [epData], settings }),
      });
      const data = await res.json();
      if (data?.beats) {
        const newBeatsForEp: PacingBeat[] = data.beats.map((b: PacingBeat) => ({ ...b, episode: ep }));
        setLocalBeats(prev => {
          const otherBeats = prev.filter(b => b.episode !== ep);
          const nextBeats = [...otherBeats, ...newBeatsForEp].sort((a, b) => a.episode - b.episode || a.order - b.order);
          if (onResultUpdate) {
            onResultUpdate({ ...result, beats: nextBeats });
          }
          return nextBeats;
        });
        setModifiedEps(prev => { const n = new Set(prev); n.delete(ep); return n; });
        const newContent = episodes?.find((e) => e.index === ep)?.content;
        if (newContent !== undefined) setLocalSnapshot((prev) => ({ ...prev, [ep]: newContent }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReanalyzingEp(null);
    }
  }, [episodes, settings, result, onResultUpdate]);

  const structureAnalysis = useMemo(() => {
    if (episodesList.length === 0) return null;

    // 1. 全剧节奏弧线诊断
    let highestEp = episodesList[0];
    let lowestEp = episodesList[0];
    let highestAvg = 0;
    let lowestAvg = 5;
    const epAvgs: number[] = [];
    episodesList.forEach((ep) => {
      const d = epData.get(ep);
      if (!d) return;
      epAvgs.push(d.avg);
      if (d.avg > highestAvg) { highestAvg = d.avg; highestEp = ep; }
      if (d.avg < lowestAvg) { lowestAvg = d.avg; lowestEp = ep; }
    });

    const total = episodesList.length;
    const third = Math.max(1, Math.floor(total / 3));
    const firstThird = episodesList.slice(0, third);
    const secondThird = episodesList.slice(third, third * 2);
    const lastThird = episodesList.slice(third * 2);

    const avgFirst = firstThird.reduce((s, ep) => s + (epData.get(ep)?.avg ?? 0), 0) / firstThird.length;
    const avgSecond = secondThird.reduce((s, ep) => s + (epData.get(ep)?.avg ?? 0), 0) / secondThird.length;
    const avgLast = lastThird.reduce((s, ep) => s + (epData.get(ep)?.avg ?? 0), 0) / lastThird.length;

    let trendType = "平稳";
    if (avgFirst > avgLast + 0.5) trendType = "前高后低";
    else if (avgLast > avgFirst + 0.5) trendType = "前低后高";
    else if (avgSecond > avgFirst + 0.3 && avgSecond > avgLast + 0.3) trendType = "M 型";
    else if (avgFirst < avgSecond - 0.3 && avgSecond > avgLast + 0.3) trendType = "倒 V 型";
    else if (avgFirst > avgSecond + 0.3 && avgSecond < avgLast - 0.3) trendType = "V 型";

    const highestPos = highestEp <= total * 0.33 ? "前" : highestEp <= total * 0.66 ? "中" : "后";
    const lowestPos = lowestEp <= total * 0.33 ? "前" : lowestEp <= total * 0.66 ? "中" : "后";

    let diagnosisText = "";
    if (trendType === "平稳") {
      diagnosisText = "全剧节奏分布较为均匀，整体平稳";
    } else if (trendType === "前高后低") {
      diagnosisText = "前期节奏较强，后期有所回落，注意保持后段吸引力";
    } else if (trendType === "前低后高") {
      diagnosisText = "后期节奏攀升明显，前期可能需要加强铺垫";
    } else if (trendType === "M 型") {
      diagnosisText = "中间段出现双高峰，整体呈 M 型走势，高潮节奏丰富";
    } else if (trendType === "倒 V 型") {
      diagnosisText = "中间段为全剧最高潮，前后段相对平缓";
    } else if (trendType === "V 型") {
      diagnosisText = "中间段为低谷，首尾较强，注意中间段的连贯性";
    }

    // 2. 五维结构评分
    const totalSum: PacingMetrics = { information:0, conflict:0, emotion:0, momentum:0, suspense:0 };
    let epCount = 0;
    epData.forEach((d) => {
      metricKeys.forEach((k) => { totalSum[k] += d.metrics[k]; });
      epCount++;
    });
    const overallAvg: PacingMetrics = { information:0, conflict:0, emotion:0, momentum:0, suspense:0 };
    metricKeys.forEach((k) => { overallAvg[k] = epCount > 0 ? totalSum[k] / epCount : 0; });

    let strongestKey = metricKeys[0];
    let weakestKey = metricKeys[0];
    let strongestVal = 0;
    let weakestVal = 5;
    metricKeys.forEach((k) => {
      if (overallAvg[k] > strongestVal) { strongestVal = overallAvg[k]; strongestKey = k; }
      if (overallAvg[k] < weakestVal) { weakestVal = overallAvg[k]; weakestKey = k; }
    });

    // 3. 问题集中区
    const overallAvgScore = metricKeys.reduce((s,k) => s + overallAvg[k], 0) / metricKeys.length;
    const weakEps: number[] = [];
    episodesList.forEach((ep) => {
      const d = epData.get(ep);
      if (d && d.avg < overallAvgScore - 0.5) weakEps.push(ep);
    });

    // 4. 结构建议
    const suggestions: string[] = [];
    if (weakEps.length > 0) {
      const weakStr = weakEps.map(e => `第${e}集`).join("、");
      suggestions.push(`弱集 ${weakStr} 的节奏低于全剧平均，建议重点优化这些集的冲突和悬念设置`);
    }
    if (weakestKey === "suspense" && weakestVal < 3) {
      suggestions.push(`悬念维度全剧均值仅 ${weakestVal.toFixed(1)}/5 分，建议在集间结尾处增设钩子或反转线索`);
    }
    if (weakestKey === "conflict" && weakestVal < 3) {
      suggestions.push(`冲突维度偏低（均值 ${weakestVal.toFixed(1)}），建议在各集中强化核心矛盾或增加子冲突`);
    }
    if (weakestKey === "information" && weakestVal < 3) {
      suggestions.push(`信息维度不足（均值 ${weakestVal.toFixed(1)}），可通过细节描写或背景补充增加信息量`);
    }
    if (weakestKey === "emotion" && weakestVal < 3) {
      suggestions.push(`情感维度偏弱（均值 ${weakestVal.toFixed(1)}），建议增加角色内心戏或情感爆发点`);
    }
    if (weakestKey === "momentum" && weakestVal < 3) {
      suggestions.push(`动能维度较低（均值 ${weakestVal.toFixed(1)}），可加快事件推进节奏或增加动作场景`);
    }
    if (trendType === "前高后低") {
      suggestions.push(`全剧呈"前高后低"走势，建议在后 1/3 段增设一个高潮反转以维持观众兴趣`);
    }
    if (trendType === "前低后高") {
      suggestions.push(`前期节奏偏慢，可在前几集中加入一个提前的小高潮或悬念来提升开篇吸引力`);
    }
    if (suggestions.length === 0) {
      suggestions.push("全剧节奏结构整体健康，各集分布均衡");
      suggestions.push("可考虑在关键转折点强化单一维度以达到更具冲击力的效果");
    }

    return {
      highestEp, lowestEp, highestPos, lowestPos, trendType, diagnosisText,
      overallAvg, strongestKey, weakestKey, strongestVal, weakestVal,
      weakEps, overallAvgScore, suggestions: suggestions.slice(0, 3),
    };
  }, [epData, episodesList]);

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col">
      <header className="h-14 flex items-center px-6 border-b border-zinc-800 shrink-0 gap-4">
        <button onClick={onClose} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>返回
        </button>
        <h1 className="text-sm font-medium text-zinc-200">节奏结构分析</h1>
        <div className="flex items-center gap-1.5 ml-2 overflow-x-auto">
          <button onClick={() => setSelectedEpisode(null)} className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${selectedEpisode===null?"bg-zinc-800 text-zinc-100":"text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"}`}>全部</button>
          {episodesList.map((ep) => (
            <button key={ep} onClick={() => setSelectedEpisode(ep)} className={`relative px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 ${selectedEpisode===ep?"bg-zinc-800 text-zinc-100":"text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"}`}>
              第 {ep} 集
              {staleEps.has(ep) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-sky-400 rounded-full" title="剧本已修改，可重新分析" />}
              {!staleEps.has(ep) && modifiedEps.has(ep) && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {selectedEpisode === null ? (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* 柱状图保持不变 */}
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-4">全剧节拍总览</p>
              <div className="flex items-end gap-1.5 mb-4" style={{ height:148 }}>
                {episodesList.map((ep) => { const d=epData.get(ep); const avg=d?.avg??0; const height=Math.max(4,(avg/5)*120); return (<div key={ep} className="flex-1 flex flex-col items-center cursor-pointer group" onClick={() => setSelectedEpisode(ep)} title={`第 ${ep} 集 · 均值 ${avg.toFixed(1)}`}><div className="w-full rounded-t transition-opacity group-hover:opacity-70" style={{height,backgroundColor:getColorHex(avg)}} /><span className="text-[9px] text-zinc-600 mt-1.5 shrink-0">{ep}</span></div>); })}
              </div>
            </div>

            {/* 全剧结构分析模块 */}
            {structureAnalysis && (
              <div className="space-y-4">
                {/* 1. 全剧节奏弧线诊断 */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-medium text-zinc-300">全剧节奏弧线诊断</p>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span>最高分：<span className="text-emerald-400 font-semibold">第 {structureAnalysis.highestEp} 集</span>（{structureAnalysis.highestPos}段）</span>
                    <span className="text-zinc-600">|</span>
                    <span>最低分：<span className="text-rose-400 font-semibold">第 {structureAnalysis.lowestEp} 集</span>（{structureAnalysis.lowestPos}段）</span>
                    <span className="text-zinc-600">|</span>
                    <span>走势类型：<span className="text-amber-400 font-semibold">{structureAnalysis.trendType}</span></span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">{structureAnalysis.diagnosisText}</p>
                </div>

                {/* 2. 五维结构评分 */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-medium text-zinc-300">五维结构评分</p>
                  <div className="space-y-2">
                    {metricKeys.map((k) => {
                      const val = structureAnalysis.overallAvg[k];
                      const isStrongest = k === structureAnalysis.strongestKey;
                      const isWeakest = k === structureAnalysis.weakestKey;
                      const pct = Math.round((val / 5) * 100);
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-500 w-10 shrink-0">{metricLabels[k]}</span>
                          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${isStrongest ? "bg-emerald-500" : isWeakest ? "bg-rose-500" : "bg-zinc-600"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-[11px] w-12 text-right shrink-0 ${isStrongest ? "text-emerald-400 font-semibold" : isWeakest ? "text-rose-400 font-semibold" : "text-zinc-400"}`}>
                            {val.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-zinc-400 mt-1">
                    <span>最强维度：<span className="text-emerald-400 font-semibold">{metricLabels[structureAnalysis.strongestKey]}（{structureAnalysis.strongestVal.toFixed(1)}）</span></span>
                    <span>最弱维度：<span className="text-rose-400 font-semibold">{metricLabels[structureAnalysis.weakestKey]}（{structureAnalysis.weakestVal.toFixed(1)}）</span></span>
                  </div>
                </div>

                {/* 3. 问题集中区 */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-zinc-300">问题集中区</p>
                  {structureAnalysis.weakEps.length > 0 ? (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {structureAnalysis.weakEps.map((ep) => (
                          <span key={ep} className="bg-rose-500/10 text-rose-300 border border-rose-800/30 px-2 py-0.5 rounded text-[11px]">
                            第 {ep} 集
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-rose-400/70 leading-relaxed">这些集的节奏明显低于全剧平均，建议重点复查</p>
                    </>
                  ) : (
                    <p className="text-[11px] text-emerald-400/70 leading-relaxed">各集节奏分布较均衡</p>
                  )}
                </div>

                {/* 4. 结构建议 */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-zinc-300">结构建议</p>
                  <ul className="space-y-1.5">
                    {structureAnalysis.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-300 leading-relaxed">
                        <span className="text-emerald-500 mt-0.5 shrink-0">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-zinc-400">第 {selectedEpisode} 集 · 节拍曲线</p>
              </div>
              <div className="flex items-end gap-2 h-[120px] mb-6">
                {currentBeats.map((beat, idx) => {
                  const pressure = (beat.metrics.conflict + beat.metrics.momentum + beat.metrics.suspense) / 3;
                  const height = Math.max(4, (pressure / 5) * 100);
                  return (
                    <div
                      key={beat.id}
                      className="flex-1 rounded-t transition-all duration-200 hover:opacity-80 relative group"
                      style={{ height, backgroundColor: getColorHex(pressure) }}
                    >
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {beat.function}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              {currentBeats.map((beat, idx) => (
                <BeatCard
                  key={beat.id}
                  beat={beat}
                  idx={idx}
                  adoptions={adoptions}
                  customInputs={customInputs}
                  editingId={editingId}
                  setAdoptions={setAdoptions}
                  setCustomInputs={setCustomInputs}
                  setEditingId={setEditingId}
                  setModifiedEps={setModifiedEps}
                  onAdoptIssue={onAdoptIssue}
                  settings={settings}
                />
              ))}
            </div>
          </div>

        )}
      </div>
    </div>
  );
}
