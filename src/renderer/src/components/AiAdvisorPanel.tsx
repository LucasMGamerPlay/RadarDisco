import React, { useMemo, useState } from 'react'
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  FolderOpen,
  ExternalLink,
  Globe,
  Copy,
  Trash2,
  Settings2,
  Loader2,
  RefreshCw
} from 'lucide-react'
import type { AiAnalysisReport, AiRiskLevel } from '@shared/types'
import { formatBytes } from '../utils/format'

interface AiAdvisorPanelProps {
  report: AiAnalysisReport | null
  analyzing: boolean
  error: string | null
  canAnalyze: boolean
  onRunAnalysis: () => void
  onOpenSettings: () => void
  onFocusFolder: (path: string) => void
  onShowInExplorer: (path: string) => void
  onSearchOnWeb: (name: string, path: string, type: 'folder' | 'file') => void
  onCopyPath: (path: string) => void
  onRequestTrash: (item: { name: string; path: string; size: number; type: 'folder' | 'file' }) => void
}

const RISK_STYLE: Record<
  AiRiskLevel,
  {
    label: string
    badgeClass: string
    borderClass: string
    icon: React.FC<{ className?: string }>
  }
> = {
  safe: {
    label: 'Seguro Apagar',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
    borderClass: 'border-l-4 border-l-emerald-500 border-slate-800',
    icon: CheckCircle2
  },
  caution: {
    label: 'Avaliar com Cuidado',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
    borderClass: 'border-l-4 border-l-amber-500 border-slate-800',
    icon: AlertTriangle
  },
  danger: {
    label: 'Não Apagar (Risco de Problema)',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35',
    borderClass: 'border-l-4 border-l-rose-500 border-slate-800',
    icon: ShieldAlert
  }
}

export const AiAdvisorPanel: React.FC<AiAdvisorPanelProps> = ({
  report,
  analyzing,
  error,
  canAnalyze,
  onRunAnalysis,
  onOpenSettings,
  onFocusFolder,
  onShowInExplorer,
  onSearchOnWeb,
  onCopyPath,
  onRequestTrash
}) => {
  const [filter, setFilter] = useState<'all' | AiRiskLevel>('all')

  const counts = useMemo(() => {
    const c = { safe: 0, caution: 0, danger: 0 }
    for (const item of report?.recommendations ?? []) {
      c[item.riskLevel]++
    }
    return c
  }, [report])

  const filteredRecs = useMemo(() => {
    if (!report) return []
    if (filter === 'all') return report.recommendations
    return report.recommendations.filter((r) => r.riskLevel === filter)
  }, [report, filter])

  if (analyzing) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0d1322] border border-slate-800/80 rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center mb-4 text-fuchsia-400">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-base font-bold text-white">
          Analisando suas pastas e arquivos com IA...
        </h3>
        <p className="text-xs text-slate-400 mt-1.5 max-w-md">
          O modelo está inspecionando as maiores pastas, caches, dependências e arquivos do sistema para separar o que é seguro limpar do que pode causar problemas.
        </p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0d1322] border border-slate-800/80 rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center mb-4 text-fuchsia-300">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-white">
          Consultor Inteligente de Limpeza de Disco
        </h3>
        <p className="text-xs text-slate-400 mt-1.5 max-w-md leading-relaxed">
          Após terminar o escaneamento, clique em <strong>Analisar com IA</strong> para receber recomendações claras sobre o que pode apagar sem medo e quais pastas não devem ser mexidas.
        </p>

        {error && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200 max-w-lg">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            disabled={!canAnalyze}
            onClick={onRunAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white shadow-lg shadow-fuchsia-600/20 disabled:opacity-40 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Analisar Resultados Agora
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configurar Modelo / API
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden">
      {/* Top Summary Banner */}
      <div className="p-3.5 bg-gradient-to-r from-[#131836] via-[#11182c] to-[#131836] border-b border-slate-800/90 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-white">Diagnóstico da IA</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                  {report.providerUsed} • {report.modelUsed}
                </span>
                <span className="text-[11px] text-slate-400">às {report.generatedAt}</span>
              </div>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">{report.summary}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {report.estimatedReclaimableBytes > 0 && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-right tabular-nums">
                <span className="text-[10px] uppercase tracking-wider text-emerald-300/80 block">
                  Potencial Recuperável
                </span>
                <span className="text-sm font-bold text-emerald-300">
                  ~{formatBytes(report.estimatedReclaimableBytes)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onRunAnalysis}
                title="Rodar nova análise com IA"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-500/30 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reanalisar
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                title="Trocar modelo ou chave da IA"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-900/70 text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({report.recommendations.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('safe')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
              filter === 'safe'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                : 'bg-slate-900/70 text-slate-400 border-transparent hover:text-emerald-300'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Seguro Apagar ({counts.safe})
          </button>

          <button
            type="button"
            onClick={() => setFilter('caution')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
              filter === 'caution'
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                : 'bg-slate-900/70 text-slate-400 border-transparent hover:text-amber-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Avaliar com Cuidado ({counts.caution})
          </button>

          <button
            type="button"
            onClick={() => setFilter('danger')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
              filter === 'danger'
                ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                : 'bg-slate-900/70 text-slate-400 border-transparent hover:text-rose-300'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Não Apagar / Sistema ({counts.danger})
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        {filteredRecs.map((item, idx) => {
          const style = RISK_STYLE[item.riskLevel]
          const RiskIcon = style.icon
          const parentDir =
            item.itemType === 'folder'
              ? item.path
              : item.path.replace(/\\[^\\]+$/, '')

          return (
            <div
              key={`${item.path}-${idx}`}
              className={`p-3.5 rounded-xl bg-[#10182b] border ${style.borderClass} flex flex-col gap-2 transition hover:bg-[#131d33]`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${style.badgeClass}`}
                    >
                      <RiskIcon className="w-3.5 h-3.5" />
                      {style.label}
                    </span>

                    <span className="text-sm font-bold text-white truncate" title={item.name}>
                      {item.name}
                    </span>

                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400">
                      {item.itemType === 'folder' ? 'Pasta' : 'Arquivo'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono truncate mt-1" title={item.path}>
                    {item.path}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.sizeBytes > 0 && (
                    <span className="text-sm font-bold text-sky-300 tabular-nums">
                      {formatBytes(item.sizeBytes)}
                    </span>
                  )}

                  <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => onFocusFolder(parentDir)}
                      title="Abrir pasta no RadarDisco"
                      className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onShowInExplorer(item.path)}
                      title="Mostrar no Windows Explorer"
                      className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-sky-300 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSearchOnWeb(item.name, item.path, item.itemType)}
                      title="Pesquisar esta pasta/arquivo na Internet"
                      className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-indigo-300 transition cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onCopyPath(item.path)}
                      title="Copiar caminho completo"
                      className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-emerald-300 transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {item.riskLevel !== 'danger' && (
                      <button
                        type="button"
                        onClick={() =>
                          onRequestTrash({
                            name: item.name,
                            path: item.path,
                            size: item.sizeBytes,
                            type: item.itemType
                          })
                        }
                        title="Mover para a Lixeira"
                        className="p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/70">
                <div>
                  <span className="font-semibold text-slate-300">O que é: </span>
                  <span className="text-slate-400">{item.whatIsIt}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-300">Recomendação / Impacto: </span>
                  <span className="text-slate-300">{item.whyAndImpact}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
