import { contextBridge, ipcRenderer } from 'electron'
import type { AiSettings, DiskRadarApi, ScanSnapshot } from '../shared/types'

const diskApi: DiskRadarApi = {
  listDrives: () => ipcRenderer.invoke('drives:list'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  startScan: (rootPath: string) => ipcRenderer.invoke('scan:start', rootPath),
  pauseScan: () => ipcRenderer.invoke('scan:pause'),
  resumeScan: () => ipcRenderer.invoke('scan:resume'),
  cancelScan: () => ipcRenderer.invoke('scan:cancel'),
  focusPath: (targetPath: string) => ipcRenderer.invoke('scan:focus', targetPath),
  showInExplorer: (targetPath: string) => ipcRenderer.invoke('item:showInExplorer', targetPath),
  copyPath: (targetPath: string) => ipcRenderer.invoke('item:copyPath', targetPath),
  searchOnWeb: (name: string, targetPath: string, itemType: 'folder' | 'file') =>
    ipcRenderer.invoke('item:searchOnWeb', name, targetPath, itemType),
  moveToTrash: (targetPath: string, permanent?: boolean) =>
    ipcRenderer.invoke('item:moveToTrash', targetPath, permanent),
  getAiSettings: () => ipcRenderer.invoke('ai:getSettings'),
  saveAiSettings: (settings: AiSettings) => ipcRenderer.invoke('ai:saveSettings', settings),
  listLocalModels: (baseUrl: string, apiStyle: 'ollama' | 'openai') =>
    ipcRenderer.invoke('ai:listLocalModels', baseUrl, apiStyle),
  analyzeWithAi: (snapshot: ScanSnapshot) => ipcRenderer.invoke('ai:analyze', snapshot),
  onScanSnapshot: (callback: (snapshot: ScanSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: ScanSnapshot): void => {
      callback(snapshot)
    }
    ipcRenderer.on('scan:snapshot', listener)
    return () => {
      ipcRenderer.removeListener('scan:snapshot', listener)
    }
  }
}

contextBridge.exposeInMainWorld('diskApi', diskApi)
