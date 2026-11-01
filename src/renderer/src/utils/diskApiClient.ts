import type {
  AiAnalyzeResponse,
  AiSettings,
  DiskRadarApi,
  DriveInfo,
  ScanSnapshot,
  TrashResult
} from '@shared/types'

function buildBrowserSearchUrl(name: string, targetPath: string, itemType: 'folder' | 'file'): string {
  const normalized = targetPath.replace(/\//g, '\\')
  let genericContext = normalized
    .replace(/^[a-zA-Z]:\\Users\\[^\\]+\\/i, '')
    .replace(/^[a-zA-Z]:\\/i, '')
  const segments = genericContext.split('\\').filter(Boolean)
  if (segments.length > 3) {
    genericContext = segments.slice(-3).join('\\')
  }
  const kindWord = itemType === 'folder' ? 'pasta' : 'arquivo'
  const query =
    genericContext && genericContext.toLowerCase() !== name.toLowerCase()
      ? `"${name}" "${genericContext}" ${kindWord} Windows o que é posso apagar`
      : `"${name}" ${kindWord} Windows o que é posso apagar`
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

export const diskApi: DiskRadarApi = {
  async listDrives(): Promise<DriveInfo[]> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.listDrives()
    }
    const res = await fetch('/api/drives')
    if (!res.ok) throw new Error('Falha ao listar discos')
    return await res.json()
  },

  async pickFolder(): Promise<string | null> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.pickFolder()
    }
    const custom = window.prompt(
      'Digite o caminho da pasta que deseja escanear (ex: C:\\Users\\lucas\\Downloads):'
    )
    return custom && custom.trim().length > 0 ? custom.trim() : null
  },

  async startScan(rootPath: string): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.startScan(rootPath)
    }
    await fetch('/api/scan/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath })
    })
  },

  async pauseScan(): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.pauseScan()
    }
    await fetch('/api/scan/pause', { method: 'POST' })
  },

  async resumeScan(): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.resumeScan()
    }
    await fetch('/api/scan/resume', { method: 'POST' })
  },

  async cancelScan(): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.cancelScan()
    }
    await fetch('/api/scan/cancel', { method: 'POST' })
  },

  async focusPath(targetPath: string): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.focusPath(targetPath)
    }
    await fetch('/api/scan/focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath })
    })
  },

  async showInExplorer(targetPath: string): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.showInExplorer(targetPath)
    }
    await fetch('/api/item/explorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath })
    })
  },

  async copyPath(targetPath: string): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.copyPath(targetPath)
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(targetPath)
    }
  },

  async searchOnWeb(name: string, targetPath: string, itemType: 'folder' | 'file'): Promise<void> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.searchOnWeb(name, targetPath, itemType)
    }
    const url = buildBrowserSearchUrl(name, targetPath, itemType)
    window.open(url, '_blank', 'noopener,noreferrer')
  },

  async moveToTrash(targetPath: string, permanent = false): Promise<TrashResult> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.moveToTrash(targetPath, permanent)
    }
    const res = await fetch('/api/item/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetPath, permanent })
    })
    return await res.json()
  },

  async getAiSettings(): Promise<AiSettings> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.getAiSettings()
    }
    const res = await fetch('/api/ai/settings')
    return await res.json()
  },

  async saveAiSettings(settings: AiSettings): Promise<AiSettings> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.saveAiSettings(settings)
    }
    const res = await fetch('/api/ai/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    return await res.json()
  },

  async listLocalModels(baseUrl: string, apiStyle: 'ollama' | 'openai'): Promise<string[]> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.listLocalModels(baseUrl, apiStyle)
    }
    const res = await fetch('/api/ai/local-models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, apiStyle })
    })
    return await res.json()
  },

  async analyzeWithAi(snapshot: ScanSnapshot): Promise<AiAnalyzeResponse> {
    if (typeof window !== 'undefined' && window.diskApi) {
      return await window.diskApi.analyzeWithAi(snapshot)
    }
    const res = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot)
    })
    return await res.json()
  },

  onScanSnapshot(callback: (snapshot: ScanSnapshot) => void): () => void {
    if (typeof window !== 'undefined' && window.diskApi) {
      return window.diskApi.onScanSnapshot(callback)
    }

    const es = new EventSource('/api/scan/events')
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as ScanSnapshot
        callback(data)
      } catch {
        // ignore malformed frame
      }
    }
    return () => {
      es.close()
    }
  }
}
