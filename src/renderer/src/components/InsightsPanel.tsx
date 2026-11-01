import React from 'react'
import { Flame, FileWarning, ExternalLink, Globe, Copy, Trash2, FolderOpen } from 'lucide-react'
import type { ScanSnapshot } from '@shared/types'
import { CATEGORY_META, formatBytes, formatNumber } from '../utils/format'

interface InsightsPanelProps {
  snapshot: ScanSnapshot
  onFocusFolder: (path: string) => void
  onShowInExplorer: (path: string) => void
  onSearchOnWeb: (name: string, path: string, type: 'folder' | 'file') => void
  onCopyPath: (path: string) => void
  onRequestTrash: (item: { name: string; path: string; size: number; type: 'folder' | 'file' }) => void
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  snapshot,
  onFocusFolder,
  onShowInExplorer,
  onSearchOnWeb,
  onCopyPath,
  onRequestTrash
}) => {
  const { topFiles, spaceHogs } = snapshot

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full min-h-0">
      {/* Top 50 Largest Individual Files */}
      <div className="flex flex-col h-full min-h-0 bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-3 bg-[#10182b] border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-semibold text-white">
              Top 50 Maiores Arquivos Individuais
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Em todo o escopo escaneado</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 tabular-nums">
          {topFiles.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhum arquivo grande detectado ainda.
            </div>
          ) : (
            topFiles.map((file, idx) => {
              const meta = CATEGORY_META[file.category] ?? CATEGORY_META.other
              const deferredClass = idx >= 20 ? 'heavy-row-deferred' : ''
              return (
                <div
                  key={file.path}
                  className={`p-2.5 hover:bg-[#131c31] transition flex items-center justify-between gap-3 ${deferredClass}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 w-5">#{idx + 1}</span>
                      <span className="text-xs font-semibold text-slate-100 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border shrink-0 ${meta.badgeClass}`}>
                        {meta.shortLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate pl-7 mt-0.5" title={file.path}>
                      {file.path}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs font-bold text-rose-300">
                      {formatBytes(file.size)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onFocusFolder(file.parentPath)}
                        title="Abrir pasta pai no RadarDisco"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onShowInExplorer(file.path)}
                        title="Mostrar no Explorer"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-sky-300 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSearchOnWeb(file.name, file.path, 'file')}
                        title="Pesquisar na Internet"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-indigo-300 transition cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCopyPath(file.path)}
                        title="Copiar caminho"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-emerald-300 transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRequestTrash({
                            name: file.name,
                            path: file.path,
                            size: file.size,
                            type: 'file'
                          })
                        }
                        title="Mover para a Lixeira"
                        className="p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Space Hogs (node_modules, .venv, Caches, AI Models, Temp) */}
      <div className="flex flex-col h-full min-h-0 bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="p-3 bg-[#10182b] border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-semibold text-white">
              Vilões de Espaço Detectados (Caches, node_modules, IA, Temp)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Acima de 10 MB</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 tabular-nums">
          {spaceHogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhuma pasta de cache, node_modules ou modelo pesado acima de 10 MB encontrada até agora.
            </div>
          ) : (
            spaceHogs.map((hog, idx) => {
              const meta = CATEGORY_META[hog.category] ?? CATEGORY_META.dev_deps
              const deferredClass = idx >= 20 ? 'heavy-row-deferred' : ''
              return (
                <div
                  key={hog.path}
                  className={`p-2.5 hover:bg-[#131c31] transition flex items-center justify-between gap-3 ${deferredClass}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-200 truncate">
                        {hog.name}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border shrink-0 ${meta.badgeClass}`}>
                        {hog.kind}
                      </span>
                      <span className="text-[11px] text-slate-500 shrink-0">
                        {formatNumber(hog.fileCount)} arq
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5" title={hog.path}>
                      {hog.path}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs font-bold text-amber-300">
                      {formatBytes(hog.size)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onFocusFolder(hog.path)}
                        title="Inspecionar pasta"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onShowInExplorer(hog.path)}
                        title="Mostrar no Explorer"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-sky-300 transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSearchOnWeb(hog.name, hog.path, 'folder')}
                        title="Pesquisar na Internet"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-indigo-300 transition cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onCopyPath(hog.path)}
                        title="Copiar caminho"
                        className="p-1.5 rounded-md hover:bg-slate-700/80 text-slate-300 hover:text-emerald-300 transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRequestTrash({
                            name: hog.name,
                            path: hog.path,
                            size: hog.size,
                            type: 'folder'
                          })
                        }
                        title="Mover para a Lixeira"
                        className="p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
