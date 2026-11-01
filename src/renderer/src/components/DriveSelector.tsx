import React from 'react'
import {
  HardDrive,
  FolderOpen,
  RefreshCw,
  AlertTriangle,
  Play,
  Sparkles,
  Settings2,
  Loader2
} from 'lucide-react'
import type { DriveInfo, ScanSnapshot } from '@shared/types'
import { formatBytes } from '../utils/format'

interface DriveSelectorProps {
  drives: DriveInfo[]
  activeRootPath: string
  scanStatus: ScanSnapshot['status']
  hasScannedData: boolean
  aiAnalyzing: boolean
  loadingDrives: boolean
  onSelectDrive: (mount: string) => void
  onPickCustomFolder: () => void
  onAnalyzeWithAi: () => void
  onOpenAiSettings: () => void
  onRefreshDrives: () => void
}

export const DriveSelector: React.FC<DriveSelectorProps> = ({
  drives,
  activeRootPath,
  scanStatus,
  hasScannedData,
  aiAnalyzing,
  loadingDrives,
  onSelectDrive,
  onPickCustomFolder,
  onAnalyzeWithAi,
  onOpenAiSettings,
  onRefreshDrives
}) => {
  const isScanning = scanStatus === 'scanning'
  const canAnalyze = !isScanning && hasScannedData && !aiAnalyzing

  const aiButtonTitle = isScanning
    ? 'Aguarde o término do escaneamento para analisar com IA'
    : !hasScannedData
      ? 'Escaneie um disco ou pasta primeiro para habilitar a análise com IA'
      : 'Analisar pastas e arquivos mapeados com IA para saber o que é seguro apagar'

  return (
    <section aria-label="Unidades de disco disponíveis" className="px-4 py-3 border-b border-slate-800/80 bg-[#0b101d]/90">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Escolha um Disco ou Pasta para Escanear
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* AI Analyze Button + Gear right next to Escolher Pasta */}
          <div className="inline-flex items-center rounded-lg shadow-sm">
            <button
              type="button"
              disabled={!canAnalyze}
              onClick={onAnalyzeWithAi}
              title={aiButtonTitle}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                canAnalyze
                  ? 'bg-gradient-to-r from-fuchsia-600/30 to-indigo-600/30 hover:from-fuchsia-600/45 hover:to-indigo-600/45 text-fuchsia-200 border-fuchsia-500/45 shadow-[0_0_15px_-3px_rgba(217,70,239,0.35)]'
                  : 'bg-slate-800/70 text-slate-400 border-slate-700/70'
              }`}
            >
              {aiAnalyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-300" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
              )}
              {aiAnalyzing
                ? 'Analisando com IA...'
                : isScanning
                  ? 'Analisar com IA (aguardando scan...)'
                  : 'Analisar com IA'}
            </button>

            <button
              type="button"
              onClick={onOpenAiSettings}
              title="Configurar modelo de IA (Google Gemini ou Ollama / LM Studio)"
              className="inline-flex items-center justify-center px-2 py-1.5 rounded-r-lg text-xs bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-fuchsia-200 border border-l-0 border-slate-700/80 transition cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onPickCustomFolder}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Escolher Pasta...
          </button>

          <button
            type="button"
            onClick={onRefreshDrives}
            disabled={loadingDrives}
            title="Atualizar lista de discos"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDrives ? 'animate-spin text-sky-400' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {drives.map((drive) => {
          const isSelected = activeRootPath.toLowerCase() === drive.mount.toLowerCase()
          const isCritical = drive.usedPercent >= 90
          const isWarning = drive.usedPercent >= 78 && drive.usedPercent < 90

          const barColor = isCritical
            ? 'bg-gradient-to-r from-rose-500 to-red-500'
            : isWarning
              ? 'bg-gradient-to-r from-amber-500 to-orange-500'
              : 'bg-gradient-to-r from-sky-500 to-cyan-400'

          return (
            <button
              key={drive.mount}
              type="button"
              onClick={() => onSelectDrive(drive.mount)}
              className={`group relative flex flex-col justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-sky-950/45 border-sky-400/70 shadow-[0_0_20px_-4px_rgba(56,189,248,0.35)]'
                  : 'bg-slate-900/70 hover:bg-slate-800/80 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-1.5 w-full">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white tracking-tight">
                      {drive.mount.replace('\\', '')}
                    </span>
                    <span className="text-xs font-medium text-slate-300 truncate" title={drive.label}>
                      {drive.label}
                    </span>
                  </div>
                </div>

                {isCritical ? (
                  <span
                    title="Pouco espaço livre!"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0"
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {Math.round(drive.usedPercent)}%
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0">
                    {Math.round(drive.usedPercent)}%
                  </span>
                )}
              </div>

              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden my-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${Math.max(2, Math.min(100, drive.usedPercent))}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                <span className={isCritical ? 'text-rose-300 font-medium' : 'text-slate-300'}>
                  {formatBytes(drive.freeBytes)} livres
                </span>
                <span className="text-slate-500">de {formatBytes(drive.totalBytes, 0)}</span>
              </div>

              {isSelected && isScanning && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                </span>
              )}

              {!isSelected && (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bottom-2 bg-sky-500/20 text-sky-300 p-1 rounded-md">
                  <Play className="w-3 h-3 fill-current" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
