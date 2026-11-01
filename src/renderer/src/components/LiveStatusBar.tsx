import React from 'react'
import { Pause, Play, Square, CheckCircle2, Activity, RotateCcw } from 'lucide-react'
import type { FileCategory, ScanSnapshot } from '@shared/types'
import { CATEGORY_META, formatBytes, formatDuration, formatNumber } from '../utils/format'

interface LiveStatusBarProps {
  snapshot: ScanSnapshot
  onPause: () => void
  onResume: () => void
  onCancel: () => void
  onRescan: () => void
}

export const LiveStatusBar: React.FC<LiveStatusBarProps> = ({
  snapshot,
  onPause,
  onResume,
  onCancel,
  onRescan
}) => {
  const { status, stats, categoryTotals, rootPath } = snapshot
  if (status === 'idle' || !rootPath) return null

  const totalCatBytes = Math.max(
    1,
    Object.values(categoryTotals).reduce((acc, v) => acc + v, 0)
  )

  const orderedCategories = (Object.keys(CATEGORY_META) as FileCategory[]).filter(
    (cat) => (categoryTotals[cat] ?? 0) > 0
  )

  return (
    <section
      aria-label="Status do escaneamento em tempo real"
      className="px-4 py-2.5 bg-[#0d1424] border-b border-slate-800/80 flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left status indicator + current path */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {status === 'scanning' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              AO VIVO
            </span>
          )}

          {status === 'paused' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
              PAUSADO
            </span>
          )}

          {status === 'completed' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              CONCLUÍDO
            </span>
          )}

          {status === 'cancelled' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-300 border border-slate-600 shrink-0">
              PARADO
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-300 truncate">
              <span className="font-semibold text-white shrink-0">{rootPath}</span>
              {status === 'scanning' && stats.currentPath && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400 truncate font-mono text-[11px]" title={stats.currentPath}>
                    Lendo: {stats.currentPath}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center live counters */}
        <div className="flex items-center gap-4 text-xs tabular-nums shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Espaço Mapeado</span>
            <span className="font-bold text-sm text-sky-300">{formatBytes(stats.totalBytes)}</span>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Arquivos</span>
            <span className="font-semibold text-slate-200">{formatNumber(stats.scannedFiles)}</span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Pastas</span>
            <span className="font-semibold text-slate-200">{formatNumber(stats.scannedFolders)}</span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Velocidade</span>
            <span className="font-semibold text-emerald-300 flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {formatNumber(stats.filesPerSec)} arq/s
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-400">Tempo</span>
            <span className="font-semibold text-slate-300">{formatDuration(stats.elapsedMs)}</span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {status === 'scanning' && (
            <button
              type="button"
              onClick={onPause}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              Pausar
            </button>
          )}

          {status === 'paused' && (
            <button
              type="button"
              onClick={onResume}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Continuar
            </button>
          )}

          {(status === 'scanning' || status === 'paused') && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              Parar
            </button>
          )}

          {(status === 'completed' || status === 'cancelled' || status === 'error') && (
            <button
              type="button"
              onClick={onRescan}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reescanear
            </button>
          )}
        </div>
      </div>

      {/* Category stacked breakdown bar */}
      {orderedCategories.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-800/80">
            {orderedCategories.map((cat) => {
              const meta = CATEGORY_META[cat]
              const bytes = categoryTotals[cat] ?? 0
              const pct = (bytes / totalCatBytes) * 100
              if (pct < 0.4) return null
              return (
                <div
                  key={cat}
                  title={`${meta.label}: ${formatBytes(bytes)} (${pct.toFixed(1)}%)`}
                  className={`h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 ${meta.barClass}`}
                  style={{ width: `${pct}%` }}
                />
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 tabular-nums">
            {orderedCategories.map((cat) => {
              const meta = CATEGORY_META[cat]
              const bytes = categoryTotals[cat] ?? 0
              const pct = (bytes / totalCatBytes) * 100
              return (
                <div key={cat} className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${meta.barClass}`} />
                  <span className="text-slate-300 font-medium">{meta.shortLabel}:</span>
                  <span>{formatBytes(bytes)}</span>
                  <span className="text-slate-500">({pct.toFixed(0)}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
