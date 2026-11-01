import React, { useEffect, useRef, useState } from 'react'
import { Trash2, AlertTriangle, X } from 'lucide-react'
import { formatBytes } from '../utils/format'

export interface TrashTarget {
  name: string
  path: string
  size: number
  type: 'folder' | 'file'
}

interface TrashConfirmDialogProps {
  target: TrashTarget | null
  busy: boolean
  onConfirm: (permanent: boolean) => void
  onClose: () => void
}

export const TrashConfirmDialog: React.FC<TrashConfirmDialogProps> = ({
  target,
  busy,
  onConfirm,
  onClose
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [permanent, setPermanent] = useState(false)

  useEffect(() => {
    setPermanent(false)
    const dialog = dialogRef.current
    if (!dialog) return

    if (target) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [target])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = (): void => {
      onClose()
    }

    dialog.addEventListener('close', handleClose)

    let handleBackdropClick: ((event: MouseEvent) => void) | null = null
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return
        const rect = dialog.getBoundingClientRect()
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        if (isDialogContent) return
        dialog.close()
      }
      dialog.addEventListener('click', handleBackdropClick)
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      if (handleBackdropClick) {
        dialog.removeEventListener('click', handleBackdropClick)
      }
    }
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby="trash-dialog-title"
      className="m-auto rounded-2xl bg-[#0f172a] text-slate-100 border border-slate-700/80 shadow-2xl p-0 w-full max-w-md overflow-hidden"
    >
      {target && (
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 id="trash-dialog-title" className="text-sm font-bold text-white">
                  {permanent ? 'Excluir Permanentemente?' : 'Mover para a Lixeira do Windows?'}
                </h2>
                <p className="text-xs text-slate-400">
                  {permanent
                    ? 'O item será apagado diretamente do disco sem passar pela Lixeira.'
                    : 'Você poderá restaurar este item pela Lixeira se precisar.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Fechar janela de confirmação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Tipo:</span>
              <span className="font-medium text-slate-200">
                {target.type === 'folder' ? 'Pasta completa' : 'Arquivo'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Nome:</span>
              <span className="font-semibold text-white truncate max-w-[260px]">
                {target.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">Espaço ocupado:</span>
              <span className="font-bold text-emerald-300 tabular-nums">
                {formatBytes(target.size)}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 block mb-0.5">Caminho:</span>
              <code className="text-[11px] text-slate-300 break-all block bg-slate-950/70 p-1.5 rounded">
                {target.path}
              </code>
            </div>
          </div>

          <label className="mt-3 flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
            <input
              type="checkbox"
              checked={permanent}
              onChange={(e) => setPermanent(e.target.checked)}
              className="mt-0.5 rounded border-slate-600 text-rose-500 focus:ring-rose-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-200 block">
                Excluir permanentemente (ignorar Lixeira / forçar limpeza)
              </span>
              <span className="text-[11px] text-slate-400">
                Recomendado para pastas de cache muito grandes (pip, uv, Temp, node_modules) que podem falhar na Lixeira do Windows.
              </span>
            </div>
          </label>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Se algum arquivo dentro da pasta estiver em uso pelo Windows, o RadarDisco apagará todo o restante livre automaticamente.
            </span>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => dialogRef.current?.close()}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirm(permanent)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {busy
                ? 'Limpando no disco...'
                : permanent
                  ? 'Excluir Permanentemente'
                  : 'Mover para a Lixeira'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
