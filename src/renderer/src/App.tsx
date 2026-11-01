import React, { useCallback, useEffect, useState } from 'react'
import {
  Radar,
  Columns2,
  List,
  LayoutGrid,
  Flame,
  HardDrive,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import type { AiAnalysisReport, AiSettings, DriveInfo, ScanSnapshot } from '@shared/types'
import { DriveSelector } from './components/DriveSelector'
import { LiveStatusBar } from './components/LiveStatusBar'
import { FolderExplorerList } from './components/FolderExplorerList'
import { TreemapView } from './components/TreemapView'
import { InsightsPanel } from './components/InsightsPanel'
import { AiAdvisorPanel } from './components/AiAdvisorPanel'
import { AiSettingsDialog } from './components/AiSettingsDialog'
import { TrashConfirmDialog, type TrashTarget } from './components/TrashConfirmDialog'
import { createEmptyCategoryRecord, formatBytes } from './utils/format'
import { diskApi } from './utils/diskApiClient'

type ViewTab = 'split' | 'list' | 'treemap' | 'insights' | 'ai'

const INITIAL_SNAPSHOT: ScanSnapshot = {
  status: 'idle',
  rootPath: '',
  focusPath: '',
  focusSize: 0,
  breadcrumbs: [],
  items: [],
  topFolders: [],
  topFiles: [],
  spaceHogs: [],
  categoryTotals: createEmptyCategoryRecord(),
  stats: {
    scannedFiles: 0,
    scannedFolders: 0,
    skippedCount: 0,
    totalBytes: 0,
    elapsedMs: 0,
    filesPerSec: 0,
    currentPath: ''
  }
}

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  geminiApiKey: '',
  geminiModel: 'gemini-3.8-flash',
  localApiStyle: 'ollama',
  localBaseUrl: 'http://localhost:11434',
  localModel: ''
}

export const App: React.FC = () => {
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [loadingDrives, setLoadingDrives] = useState(false)
  const [snapshot, setSnapshot] = useState<ScanSnapshot>(INITIAL_SNAPSHOT)
  const [activeTab, setActiveTab] = useState<ViewTab>('split')
  const [hoveredPath, setHoveredPath] = useState<string | null>(null)
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null)
  const [trashBusy, setTrashBusy] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // AI State
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [aiReport, setAiReport] = useState<AiAnalysisReport | null>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const showToast = useCallback((type: 'ok' | 'err', text: string) => {
    setToast({ type, text })
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const loadDrives = useCallback(async () => {
    setLoadingDrives(true)
    try {
      const list = await diskApi.listDrives()
      setDrives(list)
    } catch {
      showToast('err', 'Não foi possível carregar a lista de discos.')
    } finally {
      setLoadingDrives(false)
    }
  }, [showToast])

  useEffect(() => {
    loadDrives()
    diskApi
      .getAiSettings()
      .then((s) => setAiSettings(s))
      .catch(() => {})

    const unsubscribe = diskApi.onScanSnapshot((nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })
    return () => unsubscribe()
  }, [loadDrives])

  const handleStartScan = useCallback(async (targetRoot: string) => {
    setHoveredPath(null)
    setAiReport(null)
    setAiError(null)
    setActiveTab((prev) => (prev === 'ai' ? 'split' : prev))
    await diskApi.startScan(targetRoot)
  }, [])

  const handlePickFolder = useCallback(async () => {
    const picked = await diskApi.pickFolder()
    if (picked) {
      await handleStartScan(picked)
    }
  }, [handleStartScan])

  const handleFocusFolder = useCallback(async (targetPath: string) => {
    setHoveredPath(null)
    await diskApi.focusPath(targetPath)
    setActiveTab((prev) => (prev === 'insights' || prev === 'ai' ? 'split' : prev))
  }, [])

  const handleCopyPath = useCallback(
    async (targetPath: string) => {
      await diskApi.copyPath(targetPath)
      showToast('ok', 'Caminho copiado para a área de transferência!')
    },
    [showToast]
  )

  const handleSearchOnWeb = useCallback(
    async (name: string, targetPath: string, itemType: 'folder' | 'file') => {
      await diskApi.searchOnWeb(name, targetPath, itemType)
    },
    []
  )

  const runAiAnalysis = useCallback(
    async (currentSnap: ScanSnapshot) => {
      setActiveTab('ai')
      setAiAnalyzing(true)
      setAiError(null)
      try {
        const res = await diskApi.analyzeWithAi(currentSnap)
        if (res.ok && res.report) {
          setAiReport(res.report)
          showToast('ok', 'Análise da IA concluída!')
        } else {
          setAiError(res.error ?? 'Não foi possível analisar com IA.')
          if (res.needsSetup) {
            setAiSettingsOpen(true)
          }
        }
      } catch {
        setAiError('Falha ao comunicar com o motor de IA.')
      } finally {
        setAiAnalyzing(false)
      }
    },
    [showToast]
  )

  const handleSaveAiSettings = useCallback(
    async (next: AiSettings, runAfterSave: boolean) => {
      const saved = await diskApi.saveAiSettings(next)
      setAiSettings(saved)
      setAiSettingsOpen(false)
      showToast('ok', 'Configurações de IA salvas!')
      if (runAfterSave && snapshot.stats.scannedFiles > 0 && snapshot.status !== 'scanning') {
        await runAiAnalysis(snapshot)
      }
    },
    [snapshot, runAiAnalysis, showToast]
  )

  const handleConfirmTrash = useCallback(
    async (permanent: boolean) => {
      if (!trashTarget) return
      setTrashBusy(true)
      try {
        const res = await diskApi.moveToTrash(trashTarget.path, permanent)
        if (res.ok) {
          showToast(
            'ok',
            res.message
              ? res.message
              : `"${trashTarget.name}" ${permanent ? 'excluído permanentemente' : 'movido para a Lixeira'} (${formatBytes(trashTarget.size)} liberados)!`
          )
          setAiReport((prev) =>
            prev
              ? {
                  ...prev,
                  recommendations: prev.recommendations.filter(
                    (r) => r.path.toLowerCase() !== trashTarget.path.toLowerCase()
                  )
                }
              : null
          )
          setTrashTarget(null)
          loadDrives()
        } else {
          showToast('err', res.error ?? 'Falha ao remover o item no disco.')
        }
      } finally {
        setTrashBusy(false)
      }
    },
    [trashTarget, showToast, loadDrives]
  )

  const hasActiveScan = snapshot.status !== 'idle' && Boolean(snapshot.rootPath)
  const hasScannedData = snapshot.stats.scannedFiles > 0 || snapshot.items.length > 0
  const canAnalyzeNow = hasScannedData && snapshot.status !== 'scanning' && !aiAnalyzing

  return (
    <div className="h-screen w-screen flex flex-col bg-[#090d16] text-slate-100 select-none overflow-hidden">
      {/* Custom Windows Titlebar */}
      <header className="h-10 px-4 flex items-center justify-between border-b border-slate-800/90 bg-[#070a12] app-drag-region shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20">
            <Radar className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold tracking-wide text-white">RadarDisco</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Analisador Visual de Espaço em Tempo Real
          </span>
        </div>

        {/* View Mode Tabs in Titlebar */}
        {hasActiveScan && (
          <div className="flex items-center gap-1 bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 mr-36 app-no-drag">
            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'split'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              Lista + Mapa
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Só Lista
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('treemap')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'treemap'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Só Mapa
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('insights')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'insights'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Top Arquivos & Vilões
              {(snapshot.topFiles.length > 0 || snapshot.spaceHogs.length > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                  {snapshot.spaceHogs.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/35'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              Consultor IA
              {aiReport && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-fuchsia-500/20 text-fuchsia-300">
                  {aiReport.recommendations.length}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {/* Drive Selector Cards + AI Button next to Escolher Pasta */}
      <DriveSelector
        drives={drives}
        activeRootPath={snapshot.rootPath}
        scanStatus={snapshot.status}
        hasScannedData={hasScannedData}
        aiAnalyzing={aiAnalyzing}
        loadingDrives={loadingDrives}
        onSelectDrive={handleStartScan}
        onPickCustomFolder={handlePickFolder}
        onAnalyzeWithAi={() => runAiAnalysis(snapshot)}
        onOpenAiSettings={() => setAiSettingsOpen(true)}
        onRefreshDrives={loadDrives}
      />

      {/* Live Scan Status Bar */}
      <LiveStatusBar
        snapshot={snapshot}
        onPause={() => diskApi.pauseScan()}
        onResume={() => diskApi.resumeScan()}
        onCancel={() => diskApi.cancelScan()}
        onRescan={() => snapshot.rootPath && handleStartScan(snapshot.rootPath)}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 min-h-0 p-3 overflow-hidden relative">
        {!hasActiveScan ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-center max-w-lg mx-auto px-4">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/25 flex items-center justify-center mb-4 text-sky-400 shadow-inner">
              <HardDrive className="w-8 h-8" />
            </div>
            <h1 className="text-lg font-bold text-white">
              Pronto para mapear seu espaço em disco ao vivo
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Clique em qualquer uma das suas unidades acima (como{' '}
              <span className="text-sky-300 font-semibold">C:</span> ou{' '}
              <span className="text-sky-300 font-semibold">J:</span>) ou escolha uma pasta
              específica. Quando o escaneamento terminar, clique em{' '}
              <span className="text-fuchsia-300 font-semibold">Analisar com IA</span> para saber o
              que pode apagar com segurança!
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
                <Sparkles className="w-3 h-3 text-fuchsia-400" />
                Consultor IA (Google Gemini + Ollama Local)
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Pesquisa inteligente na Web em 1 clique
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Explorer + Treemap View */}
            <div
              className={`min-h-0 ${
                activeTab === 'insights' || activeTab === 'ai'
                  ? 'cached-view-inactive'
                  : 'cached-view-active'
              }`}
            >
              {activeTab === 'split' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full min-h-0">
                  <div className="lg:col-span-7 h-full min-h-0">
                    <FolderExplorerList
                      snapshot={snapshot}
                      hoveredPath={hoveredPath}
                      onHoverPath={setHoveredPath}
                      onFocusFolder={handleFocusFolder}
                      onShowInExplorer={(p) => diskApi.showInExplorer(p)}
                      onSearchOnWeb={handleSearchOnWeb}
                      onCopyPath={handleCopyPath}
                      onRequestTrash={setTrashTarget}
                    />
                  </div>
                  <div className="lg:col-span-5 h-full min-h-0">
                    <TreemapView
                      snapshot={snapshot}
                      hoveredPath={hoveredPath}
                      onHoverPath={setHoveredPath}
                      onFocusFolder={handleFocusFolder}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'list' && (
                <div className="h-full min-h-0">
                  <FolderExplorerList
                    snapshot={snapshot}
                    hoveredPath={hoveredPath}
                    onHoverPath={setHoveredPath}
                    onFocusFolder={handleFocusFolder}
                    onShowInExplorer={(p) => diskApi.showInExplorer(p)}
                    onSearchOnWeb={handleSearchOnWeb}
                    onCopyPath={handleCopyPath}
                    onRequestTrash={setTrashTarget}
                  />
                </div>
              )}

              {activeTab === 'treemap' && (
                <div className="h-full min-h-0">
                  <TreemapView
                    snapshot={snapshot}
                    hoveredPath={hoveredPath}
                    onHoverPath={setHoveredPath}
                    onFocusFolder={handleFocusFolder}
                  />
                </div>
              )}
            </div>

            {/* Insights View */}
            <div
              className={`min-h-0 ${
                activeTab === 'insights' ? 'cached-view-active' : 'cached-view-inactive'
              }`}
            >
              <InsightsPanel
                snapshot={snapshot}
                onFocusFolder={handleFocusFolder}
                onShowInExplorer={(p) => diskApi.showInExplorer(p)}
                onSearchOnWeb={handleSearchOnWeb}
                onCopyPath={handleCopyPath}
                onRequestTrash={setTrashTarget}
              />
            </div>

            {/* AI Advisor View */}
            <div
              className={`min-h-0 ${
                activeTab === 'ai' ? 'cached-view-active' : 'cached-view-inactive'
              }`}
            >
              <AiAdvisorPanel
                report={aiReport}
                analyzing={aiAnalyzing}
                error={aiError}
                canAnalyze={canAnalyzeNow}
                onRunAnalysis={() => runAiAnalysis(snapshot)}
                onOpenSettings={() => setAiSettingsOpen(true)}
                onFocusFolder={handleFocusFolder}
                onShowInExplorer={(p) => diskApi.showInExplorer(p)}
                onSearchOnWeb={handleSearchOnWeb}
                onCopyPath={handleCopyPath}
                onRequestTrash={setTrashTarget}
              />
            </div>
          </>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-xl border transition-all ${
              toast.type === 'ok'
                ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/40'
                : 'bg-rose-950/95 text-rose-200 border-rose-500/40'
            }`}
          >
            {toast.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        )}
      </main>

      {/* Native <dialog> Confirmation Modal for Recycle Bin */}
      <TrashConfirmDialog
        target={trashTarget}
        busy={trashBusy}
        onConfirm={handleConfirmTrash}
        onClose={() => setTrashTarget(null)}
      />

      {/* Native <dialog> Modal for Hybrid AI Settings */}
      <AiSettingsDialog
        open={aiSettingsOpen}
        initialSettings={aiSettings}
        canAnalyzeNow={canAnalyzeNow}
        onSave={handleSaveAiSettings}
        onDiscoverLocalModels={(baseUrl, apiStyle) => diskApi.listLocalModels(baseUrl, apiStyle)}
        onClose={() => setAiSettingsOpen(false)}
      />
    </div>
  )
}
