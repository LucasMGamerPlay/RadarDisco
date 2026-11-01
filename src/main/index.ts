import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Worker } from 'node:worker_threads'
import { listWindowsDrives } from './driveService'
import { normalizeFsPath } from './scannerCore'
import { executeDiskTrashOrDelete } from './trashService'
import {
  analyzeDiskSnapshotWithAi,
  buildSmartWebSearchUrl,
  discoverLocalModels,
  loadAiSettings,
  saveAiSettings
} from './aiService'
import type { AiSettings, ScanSnapshot, TrashResult, WorkerCommand } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let scanWorker: Worker | null = null

function ensureWorker(): Worker {
  if (scanWorker) return scanWorker

  let workerPath = path.join(__dirname, 'scannerWorker.js')
  if (workerPath.includes('app.asar') && !workerPath.includes('app.asar.unpacked')) {
    workerPath = workerPath.replace('app.asar', 'app.asar.unpacked')
  }
  scanWorker = new Worker(workerPath)

  scanWorker.on('message', (snapshot: ScanSnapshot) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:snapshot', snapshot)
    }
  })

  scanWorker.on('error', (err) => {
    console.error('Scanner Worker error:', err)
  })

  scanWorker.on('exit', () => {
    scanWorker = null
  })

  return scanWorker
}

function sendToWorker(cmd: WorkerCommand): void {
  const worker = ensureWorker()
  worker.postMessage(cmd)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#090d16',
    title: 'RadarDisco — Analisador de Espaço em Tempo Real',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#090d16',
      symbolColor: '#94a3b8',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.error(`[Renderer Console L${level}] ${message} (${sourceId}:${line})`)
    }
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Renderer Gone]', details)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('drives:list', async () => {
    return await listWindowsDrives()
  })

  ipcMain.handle('dialog:pickFolder', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Escolher pasta para escanear',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('scan:start', async (_event, rootPath: string) => {
    sendToWorker({ type: 'start', rootPath })
  })

  ipcMain.handle('scan:pause', async () => {
    sendToWorker({ type: 'pause' })
  })

  ipcMain.handle('scan:resume', async () => {
    sendToWorker({ type: 'resume' })
  })

  ipcMain.handle('scan:cancel', async () => {
    sendToWorker({ type: 'cancel' })
  })

  ipcMain.handle('scan:focus', async (_event, targetPath: string) => {
    sendToWorker({ type: 'focus', path: targetPath })
  })

  ipcMain.handle('item:showInExplorer', async (_event, targetPath: string) => {
    shell.showItemInFolder(normalizeFsPath(targetPath))
  })

  ipcMain.handle('item:copyPath', async (_event, targetPath: string) => {
    clipboard.writeText(normalizeFsPath(targetPath))
  })

  ipcMain.handle(
    'item:searchOnWeb',
    async (_event, name: string, targetPath: string, itemType: 'folder' | 'file') => {
      const url = buildSmartWebSearchUrl(name, targetPath, itemType)
      await shell.openExternal(url)
    }
  )

  ipcMain.handle('ai:getSettings', async () => {
    return await loadAiSettings(app.getPath('userData'))
  })

  ipcMain.handle('ai:saveSettings', async (_event, nextSettings: AiSettings) => {
    return await saveAiSettings(nextSettings, app.getPath('userData'))
  })

  ipcMain.handle(
    'ai:listLocalModels',
    async (_event, baseUrl: string, apiStyle: 'ollama' | 'openai') => {
      return await discoverLocalModels(baseUrl, apiStyle)
    }
  )

  ipcMain.handle('ai:analyze', async (_event, snapshot: ScanSnapshot) => {
    return await analyzeDiskSnapshotWithAi(snapshot, app.getPath('userData'))
  })

  ipcMain.handle(
    'item:moveToTrash',
    async (_event, targetPath: string, permanent = false): Promise<TrashResult> => {
      const norm = normalizeFsPath(targetPath)
      const res = await executeDiskTrashOrDelete(norm, permanent, (p) => shell.trashItem(p))
      if (res.ok) {
        sendToWorker({ type: 'removeNode', path: norm })
      }
      return res
    }
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (scanWorker) {
    scanWorker.terminate()
    scanWorker = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
