import React, { useState, useMemo } from 'react'
import {
  Folder,
  FileText,
  ChevronRight,
  CornerLeftUp,
  Search,
  ExternalLink,
  Globe,
  Copy,
  Trash2,
  Lock,
  Loader2
} from 'lucide-react'
import type { ScanItemSnapshot, ScanSnapshot } from '@shared/types'
import { CATEGORY_META, formatBytes, formatNumber } from '../utils/format'

interface FolderExplorerListProps {
  snapshot: ScanSnapshot
  hoveredPath: string | null
  onHoverPath: (path: string | null) => void
  onFocusFolder: (path: string) => void
  onShowInExplorer: (path: string) => void
  onSearchOnWeb: (name: string, path: string, type: 'folder' | 'file') => void
  onCopyPath: (path: string) => void
  onRequestTrash: (item: { name: string; path: string; size: number; type: 'folder' | 'file' }) => void
}

export const FolderExplorerList: React.FC<FolderExplorerListProps> = ({
  snapshot,
  hoveredPath,
  onHoverPath,
  onFocusFolder,
  onShowInExplorer,
  onSearchOnWeb,
  onCopyPath,
  onRequestTrash
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const { breadcrumbs, items, focusPath, focusSize } = snapshot

  const canGoUp = breadcrumbs.length > 1
  const parentBreadcrumb = canGoUp ? breadcrumbs[breadcrumbs.length - 2] : null

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.specialBadge && item.specialBadge.toLowerCase().includes(q))
    )
  }, [items, searchQuery])

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden">
      {/* Top navigation bar with breadcrumbs & search */}
      <div className="p-2.5 bg-[#10182b] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto py-0.5">
          <button
            type="button"
            disabled={!canGoUp}
            onClick={() => parentBreadcrumb && onFocusFolder(parentBreadcrumb.path)}
            title="Subir um nível"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/70 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer shrink-0"
          >
            <CornerLeftUp className="w-3.5 h-3.5" />
            Subir
          </button>

          <nav aria-label="Caminho da pasta atual" className="flex items-center gap-1 min-w-0 overflow-x-auto">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <React.Fragment key={crumb.path}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => onFocusFolder(crumb.path)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition cursor-pointer shrink-0 ${
                      isLast
                        ? 'bg-sky-500/20 text-sky-200 font-semibold border border-sky-500/35'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="truncate max-w-[160px]">{crumb.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/80 text-slate-400 tabular-nums">
                      {formatBytes(crumb.size)}
                    </span>
                  </button>
                </React.Fragment>
              )
            })}
          </nav>
        </div>

        <div className="relative w-48 sm:w-56 shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar pasta atual..."
            aria-label="Filtrar itens na pasta atual"
            className="w-full pl-8 pr-2.5 py-1 rounded-lg text-xs bg-slate-900/90 border border-slate-700/80 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Responsive Semantic Table */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="folder-table-caption"
        className="table-wrapper flex-1 min-h-0"
      >
        <table className="disk-data-table text-left text-xs">
          <caption id="folder-table-caption" className="sr-only">
            Conteúdo de {focusPath} ({formatBytes(focusSize)}) ordenado do maior para o menor tamanho
          </caption>
          <thead className="bg-[#0f172a] text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th scope="col" className="py-2.5 pl-3.5 pr-2 font-semibold">
                Nome da Pasta / Arquivo
              </th>
              <th scope="col" className="py-2.5 px-2 font-semibold w-44">
                Ocupação Local
              </th>
              <th scope="col" className="py-2.5 px-2 font-semibold text-right w-28">
                Tamanho
              </th>
              <th scope="col" className="py-2.5 px-2 font-semibold text-right w-28">
                Arquivos
              </th>
              <th scope="col" className="py-2.5 pl-2 pr-3.5 font-semibold text-right w-36">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 tabular-nums">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  {snapshot.status === 'scanning'
                    ? 'Escaneando entradas desta pasta...'
                    : 'Nenhum item encontrado nesta visualização.'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item: ScanItemSnapshot, index: number) => {
                const catMeta = CATEGORY_META[item.category] ?? CATEGORY_META.other
                const isHovered = hoveredPath === item.path
                const pct = Math.max(0, Math.min(100, item.percentOfParent))
                // Apply content-visibility: auto strictly to off-screen rows below the initial fold (index >= 25)
                const deferredClass = index >= 25 ? 'heavy-row-deferred' : ''

                return (
                  <tr
                    key={item.path}
                    onMouseEnter={() => onHoverPath(item.path)}
                    onMouseLeave={() => onHoverPath(null)}
                    onClick={() => {
                      if (item.type === 'folder') {
                        onFocusFolder(item.path)
                      }
                    }}
                    className={`group transition-colors ${deferredClass} ${
                      item.type === 'folder' ? 'cursor-pointer' : ''
                    } ${isHovered ? 'bg-sky-950/50' : 'hover:bg-[#131c31]'}`}
                  >
                    <th scope="row" className="py-2 pl-3.5 pr-2 font-normal text-slate-200 max-w-[320px]">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.type === 'folder' ? (
                          <Folder className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400/20" />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        )}

                        <span className="font-medium truncate" title={item.path}>
                          {item.name}
                        </span>

                        {item.isScanning && (
                          <span title="Ainda calculando subpastas ao vivo...">
                            <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />
                          </span>
                        )}

                        {item.accessDenied && (
                          <span
                            title="Acesso restrito pelo Windows"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            Restrito
                          </span>
                        )}

                        {item.specialBadge && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${catMeta.badgeClass}`}
                          >
                            {item.specialBadge}
                          </span>
                        )}
                      </div>
                    </th>

                    <td className="py-2 px-2 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${catMeta.barClass}`}
                            style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-400 w-11 text-right">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-2 text-right font-semibold text-slate-100 whitespace-nowrap">
                      {formatBytes(item.size)}
                    </td>

                    <td className="py-2 px-2 text-right text-slate-400 whitespace-nowrap">
                      {item.type === 'folder' ? (
                        <span title={`${formatNumber(item.folderCount)} subpastas`}>
                          {formatNumber(item.fileCount)} arq
                        </span>
                      ) : (
                        <span className="text-slate-500">1 arq</span>
                      )}
                    </td>

                    <td
                      className="py-2 pl-2 pr-3.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-1 opacity-85 group-hover:opacity-100">
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
                          onClick={() => onSearchOnWeb(item.name, item.path, item.type)}
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
                        <button
                          type="button"
                          onClick={() =>
                            onRequestTrash({
                              name: item.name,
                              path: item.path,
                              size: item.size,
                              type: item.type
                            })
                          }
                          title="Mover para a Lixeira"
                          className="p-1.5 rounded-md hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
