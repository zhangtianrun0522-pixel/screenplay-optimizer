'use client'

import { useState } from 'react'

interface StateKeyframe {
  fromEpisode: number
  state: string
  change?: string
  trigger?: string
}

interface Character {
  id: string
  name: string
  aliases: string[]
  description: string
  emotionTags: string[]
  appearsIn: number[]
  stateTimeline: StateKeyframe[]
  linkedTo: string[]
  referenceImages: unknown[]
  portraitPrompt?: string
}

interface Scene {
  id: string
  name: string
  aliases: string[]
  description: string
  appearsIn: number[]
  stateTimeline: StateKeyframe[]
  linkedTo: string[]
  referenceImages: unknown[]
}

interface Prop {
  id: string
  name: string
  aliases: string[]
  description: string
  appearsIn: number[]
  stateTimeline: StateKeyframe[]
  linkedTo: string[]
  referenceImages: unknown[]
}

type AssetType = 'character' | 'scene' | 'prop'
type AssetItem = Character | Scene | Prop

interface AssetCardProps {
  asset: AssetItem
  type: AssetType
  isHighlighted: boolean
  isSelected: boolean
  onSelect: (id: string) => void
  onHoverEnter: (id: string) => void
  onHoverLeave: () => void
  onUpdate: (id: string, field: string, value: string | string[] | number[] | StateKeyframe[]) => void
  onDelete?: (id: string) => void
  currentEpisodeNumber: number
  onEpisodeClick: (epNumber: number) => void
}

const inputCls =
  'rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 w-full'

const labelCls = 'text-[10px] text-zinc-500 mb-0.5 block'

function splitTextList(value: string): string[] {
  return value.split(/[，,]/).map((s) => s.trim()).filter(Boolean)
}

function firstReferenceImage(asset: AssetItem): string {
  const first = asset.referenceImages[0] as { imageUrl?: unknown } | undefined
  return typeof first?.imageUrl === 'string' ? first.imageUrl : ''
}

function initials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return Array.from(trimmed).slice(0, 2).join('')
}

function avatarTone(type: AssetType): string {
  if (type === 'character') return 'border-emerald-500/30 bg-emerald-950/30 text-emerald-200'
  if (type === 'scene') return 'border-sky-500/30 bg-sky-950/30 text-sky-200'
  return 'border-amber-500/30 bg-amber-950/30 text-amber-200'
}

function imageLabel(type: AssetType): string {
  if (type === 'character') return '主体裁切'
  if (type === 'scene') return '场景主体'
  return '道具主体'
}

function selectedKeyframe(asset: AssetItem, episode: number): StateKeyframe | undefined {
  return asset.stateTimeline.reduce<StateKeyframe | undefined>((current, point) => {
    if (point.fromEpisode <= episode && (!current || point.fromEpisode >= current.fromEpisode)) return point
    return current
  }, undefined) ?? asset.stateTimeline[0]
}

export default function AssetCard({
  asset,
  type,
  isHighlighted,
  isSelected,
  onSelect,
  onHoverEnter,
  onHoverLeave,
  onUpdate,
  onDelete,
  currentEpisodeNumber,
  onEpisodeClick,
}: AssetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const visibleEpisodes = asset.appearsIn.slice(0, 5)
  const hiddenCount = Math.max(asset.appearsIn.length - visibleEpisodes.length, 0)

  const activeKeyframeIndex = asset.stateTimeline.reduce((lastActiveIndex, kf, index) => {
    if (kf.fromEpisode <= currentEpisodeNumber) return index
    return lastActiveIndex
  }, -1)

  const borderCls = isHighlighted ? 'border-emerald-400/70' : 'border-zinc-800'
  const bgCls = isSelected ? 'bg-emerald-900/20' : 'bg-zinc-900/40'
  const imageUrl = firstReferenceImage(asset)
  const activeKeyframe = selectedKeyframe(asset, currentEpisodeNumber)

  function addStateFrame() {
    const nextEpisode = currentEpisodeNumber || asset.appearsIn[0] || 1
    onUpdate(asset.id, 'stateTimeline', [
      ...asset.stateTimeline,
      { fromEpisode: nextEpisode, state: '填写这个状态的16:9资产图描述', change: '新状态', trigger: '人工新增' },
    ])
  }

  function removeStateFrame(index: number) {
    onUpdate(asset.id, 'stateTimeline', asset.stateTimeline.filter((_, i) => i !== index))
  }

  return (
    <div
      className={`rounded-xl border p-3 transition-colors cursor-pointer ${borderCls} ${bgCls}`}
      onClick={() => onSelect(asset.id)}
      onMouseEnter={() => onHoverEnter(asset.id)}
      onMouseLeave={onHoverLeave}
    >
      {/* 折叠态 */}
      <div className="flex items-start gap-3">
        <div className="w-16 shrink-0">
        <div className={`relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-lg border text-xs font-semibold ${avatarTone(type)}`}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={asset.name} className="h-full w-full object-cover" />
          ) : (
            <span>{initials(asset.name)}</span>
          )}
        </div>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-full rounded bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200"
          >
            调整裁切
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold text-zinc-100">{asset.name}</span>
            {asset.linkedTo.length > 0 && <span className="text-xs text-zinc-500">🔗</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {visibleEpisodes.map((ep, i) => (
              <span key={`${ep}-${i}`} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                第{ep}集
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                +{hiddenCount}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
          onClick={(e) => { e.stopPropagation(); setIsExpanded((prev) => !prev) }}
          aria-label={isExpanded ? '收起' : '展开'}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
        {onDelete && (
          <button
            type="button"
            className="shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500 transition hover:border-red-500/60 hover:bg-red-950/30 hover:text-red-200"
            onClick={(e) => { e.stopPropagation(); onDelete(asset.id) }}
          >
            删除
          </button>
        )}
      </div>

      {activeKeyframe && (
        <p className="mt-2 text-[10px] leading-4 text-zinc-500">
          {imageLabel(type)}：从第{activeKeyframe.fromEpisode}集 16:9 状态图裁出，可人工调整构图。
        </p>
      )}

      {/* 展开态 */}
      {isExpanded && (
        <div className="mt-3 space-y-2.5 border-t border-zinc-800 pt-3">
          <div>
            <label className={labelCls}>名称</label>
            <input className={inputCls} value={asset.name}
              onChange={(e) => onUpdate(asset.id, 'name', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>别名</label>
            <input className={inputCls} value={asset.aliases.join('，')}
              onChange={(e) => onUpdate(asset.id, 'aliases', splitTextList(e.target.value))} />
          </div>

          <div>
            <label className={labelCls}>描述</label>
            <textarea className={`${inputCls} min-h-[56px] resize-y`} value={asset.description}
              onChange={(e) => onUpdate(asset.id, 'description', e.target.value)} />
          </div>

          {type === 'character' && (
            <div>
              <label className={labelCls}>情绪标签</label>
              <input className={inputCls} value={(asset as Character).emotionTags.join('，')}
                onChange={(e) => onUpdate(asset.id, 'emotionTags', splitTextList(e.target.value))} />
            </div>
          )}

          {type === 'character' && (asset as Character).portraitPrompt && (
            <div>
              <label className={labelCls}>大头照提示词</label>
              <textarea
                readOnly
                className={`${inputCls} min-h-[52px] cursor-default resize-y text-xs text-zinc-400`}
                value={(asset as Character).portraitPrompt ?? ''}
              />
            </div>
          )}

          <div>
            <label className={labelCls}>关联资产</label>
            {asset.linkedTo.length === 0 ? (
              <span className="text-xs text-zinc-600">无</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {asset.linkedTo.map((name) => (
                  <span key={name} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    🔗 {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={labelCls}>视觉连续性</label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); addStateFrame() }}
                  className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                >
                  添加状态
                </button>
              </div>
              {asset.stateTimeline.length > 0 ? (
              <div className="space-y-1.5">
                {asset.stateTimeline.map((kf, i) => {
                  const isActiveKeyframe = i === activeKeyframeIndex

                  return (
                    <div
                      key={`${kf.fromEpisode}-${i}`}
                      className={isActiveKeyframe
                        ? 'border-l-2 border-emerald-500 pl-2'
                        : 'border-l border-zinc-700 pl-2'}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEpisodeClick(kf.fromEpisode); }}
                          className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-emerald-400 hover:bg-zinc-600 transition-colors shrink-0"
                        >
                          第{kf.fromEpisode}集
                        </button>
                        {kf.change && (
                          <span className="text-[10px] font-medium text-amber-400">
                            {kf.change}
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-xs leading-relaxed ${isActiveKeyframe ? 'text-emerald-300' : 'text-zinc-300'}`}>
                        {kf.state}
                      </p>
                      {kf.trigger && (
                        <p className="text-[10px] text-zinc-500">触发：{kf.trigger}</p>
                      )}

                      <div className={`mt-1.5 flex aspect-video items-center justify-center rounded border border-dashed text-[10px] ${avatarTone(type)}`}>
                        <span>16:9 状态图</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEpisodeClick(kf.fromEpisode); }}
                          className="rounded bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-950 transition hover:bg-white"
                        >
                          生成状态图
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeStateFrame(i); }}
                          className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-500 transition hover:border-red-500/60 hover:bg-red-950/30 hover:text-red-200"
                        >
                          删除状态
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              ) : (
                <div className="rounded border border-dashed border-zinc-800 p-3 text-xs text-zinc-500">
                  当前资产还没有视觉状态。可以添加状态后再生成 16:9 资产图。
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  )
}
