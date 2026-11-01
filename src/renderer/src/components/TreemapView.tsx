import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Folder, FileText, LayoutGrid } from 'lucide-react'
import type { ScanItemSnapshot, ScanSnapshot } from '@shared/types'
import { computeSquarifiedTreemap } from '../utils/treemap'
import { CATEGORY_META, formatBytes, formatNumber } from '../utils/format'

interface TreemapViewProps {
  snapshot: ScanSnapshot
  hoveredPath: string | null
  onHoverPath: (path: string | null) => void
  onFocusFolder: (path: string) => void
}

export const TreemapView: React.FC<TreemapViewProps> = ({
  snapshot,
  hoveredPath,
  onHoverPath,
  onFocusFolder
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 520, height: 420 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 10 && height > 10) {
          setSize({ width: Math.floor(width), height: Math.floor(height) })
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const treemapNodes = useMemo(() => {
    const topItems = snapshot.items.filter((i) => i.size > 0).slice(0, 48)
    return computeSquarifiedTreemap(
      topItems.map((item) => ({ data: item, value: item.size })),
      size.width,
      size.height
    )
  }, [snapshot.items, size.width, size.height])

  const hoveredItem: ScanItemSnapshot | undefined = useMemo(() => {
    if (!hoveredPath) return undefined
    return snapshot.items.find((i) => i.path === hoveredPath)
  }, [hoveredPath, snapshot.items])

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-2.5 bg-[#10182b] border-b border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LayoutGrid className="w-4 h-4 text-sky-400 shrink-0" />
          <h3 className="text-xs font-semibold text-slate-200 truncate">
            Mapa Visual de Blocos (Treemap)
          </h3>
        </div>

        {hoveredItem ? (
          <div className="flex items-center gap-2 text-xs tabular-nums truncate">
            <span className="font-semibold text-sky-300 truncate max-w-[180px]">
              {hoveredItem.name}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-bold">
              {formatBytes(hoveredItem.size)}
            </span>
            <span className="text-slate-400">({hoveredItem.percentOfParent.toFixed(1)}%)</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">
            Clique em um bloco de pasta para entrar
          </span>
        )}
      </div>

      {/* Canvas Container */}
      <div ref={containerRef} className="relative flex-1 min-h-0 w-full bg-[#090d16] overflow-hidden">
        {treemapNodes.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-slate-500">
            {snapshot.status === 'scanning'
              ? 'Calculando proporções visuais...'
              : 'Sem blocos com tamanho suficiente para exibir.'}
          </div>
        ) : (
          treemapNodes.map((rect) => {
            const item = rect.data
            const meta = CATEGORY_META[item.category] ?? CATEGORY_META.other
            const isHovered = hoveredPath === item.path
            const showLabel = rect.width >= 58 && rect.height >= 34
            const showSubStats = rect.width >= 95 && rect.height >= 54

            return (
              <div
                key={item.path}
                style={{
                  left: `${rect.x}px`,
                  top: `${rect.y}px`,
                  width: `${Math.max(0, rect.width)}px`,
                  height: `${Math.max(0, rect.height)}px`,
                  padding: '2px'
                }}
                className="absolute transition-all duration-300 ease-out"
              >
                <button
                  type="button"
                  onMouseEnter={() => onHoverPath(item.path)}
                  onMouseLeave={() => onHoverPath(null)}
                  onClick={() => {
                    if (item.type === 'folder') {
                      onFocusFolder(item.path)
                    }
                  }}
                  title={`${item.name}\nTamanho: ${formatBytes(item.size)} (${item.percentOfParent.toFixed(1)}%)\nArquivos: ${formatNumber(item.fileCount)}\nCategoria: ${meta.label}`}
                  style={{
                    background: meta.treemapBg,
                    borderColor: isHovered ? '#38bdf8' : meta.treemapBorder
                  }}
                  className={`w-full h-full rounded-lg border text-left p-2 flex flex-col justify-between overflow-hidden transition-transform relative ${
                    item.type === 'folder' ? 'cursor-pointer' : 'cursor-default'
                  } ${isHovered ? 'ring-2 ring-sky-400 z-10 scale-[0.995]' : 'hover:brightness-110'}`}
                >
                  {showLabel && (
                    <div className="min-w-0 z-10">
                      <div className="flex items-center gap-1 text-xs font-semibold text-white drop-shadow-sm truncate">
                        {item.type === 'folder' ? (
                          <Folder className="w-3 h-3 text-amber-300 shrink-0" />
                        ) : (
                          <FileText className="w-3 h-3 text-slate-200 shrink-0" />
                        )}
                        <span className="truncate">{item.name}</span>
                      </div>
                      <div className="text-[11px] font-bold text-white/90 tabular-nums mt-0.5">
                        {formatBytes(item.size)}
                      </div>
                    </div>
                  )}

                  {showSubStats && (
                    <div className="flex items-center justify-between gap-1 text-[10px] text-white/75 tabular-nums z-10">
                      <span className="truncate">{meta.shortLabel}</span>
                      <span>{item.percentOfParent.toFixed(1)}%</span>
                    </div>
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
