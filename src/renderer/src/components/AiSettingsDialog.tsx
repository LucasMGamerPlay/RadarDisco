import React, { useEffect, useRef, useState } from 'react'
import { Sparkles, Server, Cloud, RefreshCw, X, Check } from 'lucide-react'
import type { AiSettings } from '@shared/types'

interface AiSettingsDialogProps {
  open: boolean
  initialSettings: AiSettings
  canAnalyzeNow: boolean
  onSave: (settings: AiSettings, runAfterSave: boolean) => Promise<void>
  onDiscoverLocalModels: (baseUrl: string, apiStyle: 'ollama' | 'openai') => Promise<string[]>
  onClose: () => void
}

export const AiSettingsDialog: React.FC<AiSettingsDialogProps> = ({
  open,
  initialSettings,
  canAnalyzeNow,
  onSave,
  onDiscoverLocalModels,
  onClose
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [form, setForm] = useState<AiSettings>(initialSettings)
  const [localModels, setLocalModels] = useState<string[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [discoverMsg, setDiscoverMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm(initialSettings)
    setDiscoverMsg(null)
  }, [initialSettings, open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClose = (): void => onClose()
    dialog.addEventListener('close', handleClose)

    let handleBackdropClick: ((event: MouseEvent) => void) | null = null
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return
        const rect = dialog.getBoundingClientRect()
        const inside =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        if (!inside) dialog.close()
      }
      dialog.addEventListener('click', handleBackdropClick)
    }

    return () => {
      dialog.removeEventListener('close', handleClose)
      if (handleBackdropClick) dialog.removeEventListener('click', handleBackdropClick)
    }
  }, [onClose])

  const handleDetectModels = async (
    baseUrl = form.localBaseUrl,
    apiStyle = form.localApiStyle
  ): Promise<void> => {
    setDiscovering(true)
    setDiscoverMsg(null)
    try {
      const found = await onDiscoverLocalModels(baseUrl, apiStyle)
      setLocalModels(found)
      if (found.length > 0) {
        if (!form.localModel || !found.includes(form.localModel)) {
          setForm((prev) => ({ ...prev, localModel: found[0] }))
        }
        setDiscoverMsg(`${found.length} modelo(s) local(is) detectado(s)!`)
      } else {
        setDiscoverMsg('Nenhum modelo encontrado nessa URL. Verifique se o Ollama / LM Studio está aberto.')
      }
    } finally {
      setDiscovering(false)
    }
  }

  const handleSubmit = async (runAfterSave: boolean): Promise<void> => {
    setSaving(true)
    try {
      await onSave(form, runAfterSave)
    } finally {
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby="ai-settings-title"
      className="m-auto rounded-2xl bg-[#0f172a] text-slate-100 border border-slate-700/80 shadow-2xl p-0 w-full max-w-lg overflow-hidden"
    >
      {open && (
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 id="ai-settings-title" className="text-sm font-bold text-white">
                  Configurar Consultor de IA
                </h2>
                <p className="text-xs text-slate-400">
                  Escolha entre Google Gemini na nuvem ou IA 100% local (Ollama / LM Studio)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Fechar configurações de IA"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Provider Switcher */}
          <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, provider: 'gemini' }))}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                form.provider === 'gemini'
                  ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-4 h-4" />
              Google Gemini API
            </button>

            <button
              type="button"
              onClick={() => {
                setForm((p) => ({ ...p, provider: 'local' }))
                if (localModels.length === 0) {
                  handleDetectModels(form.localBaseUrl, form.localApiStyle)
                }
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                form.provider === 'local'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-4 h-4" />
              IA Local (Ollama / LM Studio)
            </button>
          </div>

          {/* Gemini Settings */}
          {form.provider === 'gemini' ? (
            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Chave da API (Google AI Studio)
                </label>
                <input
                  type="password"
                  value={form.geminiApiKey}
                  onChange={(e) => setForm((p) => ({ ...p, geminiApiKey: e.target.value }))}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-400 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Sua chave fica salva apenas localmente no seu computador. Caminhos pessoais são anonimizados antes do envio.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Modelo Gemini</label>
                <select
                  value={form.geminiModel}
                  onChange={(e) => setForm((p) => ({ ...p, geminiModel: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-fuchsia-400"
                >
                  <option value="gemini-3.8-flash">
                    gemini-3.8-flash (Recomendado — Rápido e inteligente)
                  </option>
                  <option value="gemini-4-argon">
                    gemini-4-argon (Máximo raciocínio profundo)
                  </option>
                  <option value="gemini-3.5-flash-lite">
                    gemini-3.5-flash-lite (Ultra-rápido e econômico)
                  </option>
                </select>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Servidor rápido:</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextUrl = 'http://localhost:11434'
                    setForm((p) => ({ ...p, localApiStyle: 'ollama', localBaseUrl: nextUrl }))
                    handleDetectModels(nextUrl, 'ollama')
                  }}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    form.localApiStyle === 'ollama'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  Ollama (11434)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextUrl = 'http://localhost:1234'
                    setForm((p) => ({ ...p, localApiStyle: 'openai', localBaseUrl: nextUrl }))
                    handleDetectModels(nextUrl, 'openai')
                  }}
                  className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                    form.localApiStyle === 'openai'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  LM Studio / OpenAI Local (1234)
                </button>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">URL do Servidor Local</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.localBaseUrl}
                    onChange={(e) => setForm((p) => ({ ...p, localBaseUrl: e.target.value }))}
                    placeholder="http://localhost:11434"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    disabled={discovering}
                    onClick={() => handleDetectModels()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${discovering ? 'animate-spin text-emerald-400' : ''}`} />
                    Detectar Modelos
                  </button>
                </div>
                {discoverMsg && (
                  <p className="text-[11px] text-emerald-300 mt-1">{discoverMsg}</p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nome do Modelo Local</label>
                {localModels.length > 0 ? (
                  <select
                    value={form.localModel}
                    onChange={(e) => setForm((p) => ({ ...p, localModel: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-400"
                  >
                    {localModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.localModel}
                    onChange={(e) => setForm((p) => ({ ...p, localModel: e.target.value }))}
                    placeholder="ex: llama3.1:8b, qwen2.5:14b, gemma3..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-none focus:border-emerald-400"
                  />
                )}
              </div>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={form.unloadAfterAnalysis !== false}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, unloadAfterAnalysis: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-semibold text-slate-200 block">
                    Finalizar / descarregar modelo da memória ao terminar a análise
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Libera automaticamente a VRAM/RAM no LM Studio (lms unload) e no Ollama (keep_alive: 0) assim que o relatório fica pronto.
                  </span>
                </div>
              </label>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Salvar
            </button>

            {canAnalyzeNow && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white shadow-lg shadow-fuchsia-600/25 transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Salvar e Analisar Agora
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
