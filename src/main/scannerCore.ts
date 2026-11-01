import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  FileCategory,
  ScanItemSnapshot,
  ScanSnapshot,
  SpaceHogEntry,
  TopFileEntry,
  TopFolderEntry
} from '../shared/types'

export interface DirectFileNode {
  name: string
  path: string
  size: number
  category: FileCategory
}

export interface DirNode {
  name: string
  path: string
  parent: DirNode | null
  depth: number
  ownFilesSize: number
  totalSize: number
  ownFileCount: number
  totalFileCount: number
  totalFolderCount: number
  pendingSubdirs: number
  accessDenied: boolean
  specialBadge?: string
  hogKind?: string
  categorySizes: Record<FileCategory, number>
  children: Map<string, DirNode>
  directFiles: DirectFileNode[]
}

const AI_EXTS = new Set([
  '.safetensors',
  '.gguf',
  '.ckpt',
  '.onnx',
  '.pt',
  '.pth',
  '.bin',
  '.ggml',
  '.tflite',
  '.pb',
  '.h5'
])

const GAME_APP_EXTS = new Set([
  '.exe',
  '.dll',
  '.pak',
  '.asar',
  '.msi',
  '.iso',
  '.cab',
  '.wad',
  '.vpk',
  '.bundle',
  '.unity3d',
  '.rpf',
  '.ucas',
  '.utoc'
])

const MEDIA_EXTS = new Set([
  '.mp4',
  '.mkv',
  '.mov',
  '.avi',
  '.webm',
  '.wmv',
  '.flv',
  '.m4v',
  '.mp3',
  '.wav',
  '.flac',
  '.ogg',
  '.aac',
  '.m4a',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tiff',
  '.psd',
  '.raw',
  '.svg'
])

const ARCHIVE_EXTS = new Set([
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.zst',
  '.tgz',
  '.vhdx',
  '.vhd',
  '.vmdk',
  '.ova',
  '.bak',
  '.dmp'
])

const DOC_EXTS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.epub',
  '.SQL',
  '.sql',
  '.db',
  '.sqlite'
])

const DEV_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.pyc',
  '.pyd',
  '.rs',
  '.go',
  '.java',
  '.jar',
  '.class',
  '.c',
  '.cpp',
  '.h',
  '.cs',
  '.pdb',
  '.obj',
  '.lib',
  '.map'
])

export function createEmptyCategoryRecord(): Record<FileCategory, number> {
  return {
    ai_models: 0,
    games_apps: 0,
    media: 0,
    dev_deps: 0,
    archives: 0,
    documents: 0,
    other: 0
  }
}

export function classifyFile(fileName: string, folderContextBadge?: string): FileCategory {
  if (folderContextBadge === 'node_modules' || folderContextBadge === 'Ambiente Virtual' || folderContextBadge === 'Git') {
    return 'dev_deps'
  }
  if (folderContextBadge === 'Modelo IA') {
    return 'ai_models'
  }
  const ext = path.extname(fileName).toLowerCase()
  if (AI_EXTS.has(ext)) return 'ai_models'
  if (GAME_APP_EXTS.has(ext)) return 'games_apps'
  if (MEDIA_EXTS.has(ext)) return 'media'
  if (ARCHIVE_EXTS.has(ext)) return 'archives'
  if (DOC_EXTS.has(ext)) return 'documents'
  if (DEV_EXTS.has(ext)) return 'dev_deps'
  return 'other'
}

export function detectFolderKind(folderName: string): { badge?: string; hogKind?: string } {
  const lower = folderName.toLowerCase()
  if (lower === 'node_modules') {
    return { badge: 'node_modules', hogKind: 'Dependências Node (node_modules)' }
  }
  if (lower === '.venv' || lower === 'venv' || lower === 'conda' || lower === 'site-packages') {
    return { badge: 'Ambiente Virtual', hogKind: 'Ambiente Python (.venv)' }
  }
  if (lower === '.git') {
    return { badge: 'Git', hogKind: 'Repositório Git (.git)' }
  }
  if (
    lower === 'cache' ||
    lower === 'caches' ||
    lower === 'gpucache' ||
    lower === 'code cache' ||
    lower === 'shadercache' ||
    lower === '.cache' ||
    lower === 'NuGetFallbackFolder'.toLowerCase()
  ) {
    return { badge: 'Cache', hogKind: 'Pasta de Cache' }
  }
  if (lower === 'temp' || lower === 'tmp' || lower === 'crashdumps') {
    return { badge: 'Temp', hogKind: 'Arquivos Temporários' }
  }
  if (
    lower === 'huggingface' ||
    lower === 'ollama' ||
    lower === 'checkpoints' ||
    lower === 'loras' ||
    lower === 'diffusion_models' ||
    lower === 'unet' ||
    lower === 'gguf'
  ) {
    return { badge: 'Modelo IA', hogKind: 'Modelos & Pesos de IA' }
  }
  if (lower === 'steamapps' || lower === 'epic games' || lower === 'riot games') {
    return { badge: 'Jogos', hogKind: 'Biblioteca de Jogos' }
  }
  if (lower === '$recycle.bin' || lower === 'system volume information') {
    return { badge: 'Sistema' }
  }
  return {}
}

export function getDominantCategory(
  categorySizes: Record<FileCategory, number>,
  specialBadge?: string
): FileCategory {
  if (specialBadge === 'node_modules' || specialBadge === 'Ambiente Virtual' || specialBadge === 'Git') {
    return 'dev_deps'
  }
  if (specialBadge === 'Modelo IA') return 'ai_models'
  if (specialBadge === 'Jogos') return 'games_apps'

  let bestCat: FileCategory = 'other'
  let bestVal = 0
  for (const [cat, val] of Object.entries(categorySizes) as Array<[FileCategory, number]>) {
    if (val > bestVal) {
      bestVal = val
      bestCat = cat
    }
  }
  return bestCat
}

export function normalizeFsPath(p: string): string {
  const resolved = path.resolve(p)
  // Keep drive root with trailing slash like C:\
  if (/^[a-zA-Z]:\\?$/.test(resolved)) {
    return resolved.endsWith('\\') ? resolved : `${resolved}\\`
  }
  return resolved.replace(/\\+$/, '')
}

export class DiskScanEngine {
  public rootPath: string
  public focusPath: string
  public status: ScanSnapshot['status'] = 'idle'
  public errorMessage?: string

  public rootNode: DirNode
  public nodeByPath = new Map<string, DirNode>()
  public spaceHogs = new Map<string, DirNode>()
  public topFiles: TopFileEntry[] = []
  public categoryTotals: Record<FileCategory, number> = createEmptyCategoryRecord()

  public scannedFiles = 0
  public scannedFolders = 0
  public skippedCount = 0
  public currentPath = ''
  public startTimeMs = 0
  public pausedAccumulatedMs = 0
  private pauseStartedAt: number | null = null

  private priorityQueue: DirNode[] = []
  private normalQueue: DirNode[] = []
  private pauseWaiters: Array<() => void> = []
  private cancelled = false
  private concurrency: number
  private maxDirectFilesPerFolder = 150
  private maxTopFiles = 50

  constructor(rootPath: string, concurrency = 24) {
    this.rootPath = normalizeFsPath(rootPath)
    this.focusPath = this.rootPath
    this.concurrency = concurrency

    const rootName = /^[a-zA-Z]:\\$/.test(this.rootPath)
      ? this.rootPath
      : path.basename(this.rootPath) || this.rootPath

    this.rootNode = this.createDirNode(rootName, this.rootPath, null, 0)
    this.nodeByPath.set(this.rootPath.toLowerCase(), this.rootNode)
  }

  private createDirNode(name: string, fullPath: string, parent: DirNode | null, depth: number): DirNode {
    const inheritedBadge = parent?.specialBadge
    const detected = detectFolderKind(name)
    const node: DirNode = {
      name,
      path: fullPath,
      parent,
      depth,
      ownFilesSize: 0,
      totalSize: 0,
      ownFileCount: 0,
      totalFileCount: 0,
      totalFolderCount: 0,
      pendingSubdirs: 0,
      accessDenied: false,
      specialBadge: detected.badge ?? inheritedBadge,
      hogKind: detected.hogKind,
      categorySizes: createEmptyCategoryRecord(),
      children: new Map(),
      directFiles: []
    }

    // Register space hog if this folder itself triggered a hogKind and no ancestor already has the same hogKind
    if (detected.hogKind && (!parent || !this.hasAncestorHog(parent))) {
      this.spaceHogs.set(fullPath.toLowerCase(), node)
    }

    return node
  }

  private hasAncestorHog(node: DirNode | null): boolean {
    let curr = node
    while (curr) {
      if (curr.hogKind) return true
      curr = curr.parent
    }
    return false
  }

  private addPending(node: DirNode, delta: number): void {
    let curr: DirNode | null = node
    while (curr) {
      curr.pendingSubdirs = Math.max(0, curr.pendingSubdirs + delta)
      curr = curr.parent
    }
  }

  private propagateMetrics(
    node: DirNode,
    deltaBytes: number,
    deltaFiles: number,
    deltaFolders: number,
    batchCategories: Record<FileCategory, number>
  ): void {
    let curr: DirNode | null = node
    while (curr) {
      curr.totalSize = Math.max(0, curr.totalSize + deltaBytes)
      curr.totalFileCount = Math.max(0, curr.totalFileCount + deltaFiles)
      curr.totalFolderCount = Math.max(0, curr.totalFolderCount + deltaFolders)
      for (const [cat, val] of Object.entries(batchCategories) as Array<[FileCategory, number]>) {
        if (val !== 0) {
          curr.categorySizes[cat] = Math.max(0, curr.categorySizes[cat] + val)
        }
      }
      curr = curr.parent
    }

    for (const [cat, val] of Object.entries(batchCategories) as Array<[FileCategory, number]>) {
      if (val !== 0) {
        this.categoryTotals[cat] = Math.max(0, this.categoryTotals[cat] + val)
      }
    }
  }

  private recordTopFile(file: TopFileEntry): void {
    if (file.size <= 0) return
    if (
      this.topFiles.length >= this.maxTopFiles &&
      file.size <= this.topFiles[this.topFiles.length - 1].size
    ) {
      return
    }
    this.topFiles.push(file)
    this.topFiles.sort((a, b) => b.size - a.size)
    if (this.topFiles.length > this.maxTopFiles) {
      this.topFiles.length = this.maxTopFiles
    }
  }

  private enqueueDir(node: DirNode): void {
    this.addPending(node, 1)
    const focusLower = this.focusPath.toLowerCase()
    const nodeLower = node.path.toLowerCase()
    if (node.depth <= 2 || nodeLower.startsWith(focusLower)) {
      this.priorityQueue.push(node)
    } else {
      this.normalQueue.push(node)
    }
  }

  private dequeueDir(): DirNode | undefined {
    // Use shift on small depth or pop on priority queue
    if (this.priorityQueue.length > 0) {
      return this.priorityQueue.shift()
    }
    return this.normalQueue.pop()
  }

  public setFocusPath(targetPath: string): void {
    const norm = normalizeFsPath(targetPath)
    if (this.nodeByPath.has(norm.toLowerCase())) {
      this.focusPath = norm
      const focusLower = norm.toLowerCase()
      // Promote matching queued nodes to priorityQueue
      const remaining: DirNode[] = []
      for (const item of this.normalQueue) {
        if (item.path.toLowerCase().startsWith(focusLower)) {
          this.priorityQueue.push(item)
        } else {
          remaining.push(item)
        }
      }
      this.normalQueue = remaining
    }
  }

  public pause(): void {
    if (this.status === 'scanning') {
      this.status = 'paused'
      this.pauseStartedAt = Date.now()
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      if (this.pauseStartedAt !== null) {
        this.pausedAccumulatedMs += Date.now() - this.pauseStartedAt
        this.pauseStartedAt = null
      }
      this.status = 'scanning'
      const waiters = this.pauseWaiters.splice(0)
      for (const resolve of waiters) resolve()
    }
  }

  public cancel(): void {
    this.cancelled = true
    this.status = 'cancelled'
    this.priorityQueue.length = 0
    this.normalQueue.length = 0
    const waiters = this.pauseWaiters.splice(0)
    for (const resolve of waiters) resolve()
  }

  private async waitIfPaused(): Promise<void> {
    while (this.status === 'paused' && !this.cancelled) {
      await new Promise<void>((resolve) => this.pauseWaiters.push(resolve))
    }
  }

  public async run(onProgress?: () => void): Promise<void> {
    this.status = 'scanning'
    this.startTimeMs = Date.now()
    this.enqueueDir(this.rootNode)

    const workers: Promise<void>[] = []
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.workerLoop(onProgress))
    }
    await Promise.all(workers)

    if (!this.cancelled && (this.status as ScanSnapshot['status']) !== 'error') {
      this.status = 'completed'
      this.currentPath = ''
    }
  }

  private async workerLoop(onProgress?: () => void): Promise<void> {
    while (!this.cancelled) {
      await this.waitIfPaused()
      if (this.cancelled) break

      const dirNode = this.dequeueDir()
      if (!dirNode) {
        // Check if any other worker is still processing a directory that might enqueue children
        if (this.rootNode.pendingSubdirs === 0) {
          break
        }
        await new Promise((r) => setTimeout(r, 8))
        continue
      }

      await this.scanDirectory(dirNode)
      onProgress?.()
    }
  }

  private async scanDirectory(dirNode: DirNode): Promise<void> {
    this.currentPath = dirNode.path
    this.scannedFolders++

    let dirHandle
    try {
      dirHandle = await fs.opendir(dirNode.path, { bufferSize: 64 })
    } catch {
      dirNode.accessDenied = true
      this.skippedCount++
      this.addPending(dirNode, -1)
      return
    }

    let batchBytes = 0
    let batchFiles = 0
    let batchFolders = 0
    const batchCategories = createEmptyCategoryRecord()
    const fileStatPromises: Promise<void>[] = []

    const flushBatch = (): void => {
      if (batchBytes > 0 || batchFiles > 0 || batchFolders > 0) {
        dirNode.ownFilesSize += batchBytes
        dirNode.ownFileCount += batchFiles
        this.propagateMetrics(dirNode, batchBytes, batchFiles, batchFolders, batchCategories)
        batchBytes = 0
        batchFiles = 0
        batchFolders = 0
        for (const k of Object.keys(batchCategories) as FileCategory[]) {
          batchCategories[k] = 0
        }
      }
    }

    try {
      for await (const dirent of dirHandle) {
        if (this.cancelled) break
        if (this.status === 'paused') {
          flushBatch()
          await this.waitIfPaused()
        }

        // Ignore symbolic links / Windows junctions to prevent infinite loops and double counting
        if (dirent.isSymbolicLink()) {
          continue
        }

        const entryName = dirent.name
        const fullPath = path.join(dirNode.path, entryName)

        if (dirent.isDirectory()) {
          const childNode = this.createDirNode(entryName, fullPath, dirNode, dirNode.depth + 1)
          dirNode.children.set(fullPath.toLowerCase(), childNode)
          this.nodeByPath.set(fullPath.toLowerCase(), childNode)
          batchFolders++
          this.enqueueDir(childNode)
        } else if (dirent.isFile()) {
          fileStatPromises.push(
            fs
              .lstat(fullPath)
              .then((stat) => {
                if (stat.isSymbolicLink()) return
                const size = stat.size
                const category = classifyFile(entryName, dirNode.specialBadge)
                batchBytes += size
                batchFiles++
                batchCategories[category] += size
                this.scannedFiles++

                // Record in folder direct files (keep bounded top files per folder)
                dirNode.directFiles.push({
                  name: entryName,
                  path: fullPath,
                  size,
                  category
                })
                if (dirNode.directFiles.length > this.maxDirectFilesPerFolder * 2) {
                  dirNode.directFiles.sort((a, b) => b.size - a.size)
                  dirNode.directFiles.length = this.maxDirectFilesPerFolder
                }

                this.recordTopFile({
                  name: entryName,
                  path: fullPath,
                  parentPath: dirNode.path,
                  size,
                  category
                })
              })
              .catch(() => {
                this.skippedCount++
              })
          )

          if (fileStatPromises.length >= 64) {
            await Promise.all(fileStatPromises.splice(0))
            flushBatch()
          }
        }
      }

      if (fileStatPromises.length > 0) {
        await Promise.all(fileStatPromises.splice(0))
      }
      flushBatch()

      if (dirNode.directFiles.length > this.maxDirectFilesPerFolder) {
        dirNode.directFiles.sort((a, b) => b.size - a.size)
        dirNode.directFiles.length = this.maxDirectFilesPerFolder
      }
    } catch {
      this.skippedCount++
    } finally {
      this.addPending(dirNode, -1)
    }
  }

  public removeNodeByPath(targetPath: string): number {
    const norm = normalizeFsPath(targetPath)
    const key = norm.toLowerCase()

    // Case 1: Target is a directory
    const dirNode = this.nodeByPath.get(key)
    if (dirNode && dirNode.parent) {
      const parent = dirNode.parent
      const removedBytes = dirNode.totalSize
      const removedFiles = dirNode.totalFileCount
      const removedFolders = dirNode.totalFolderCount + 1
      const negCategories = createEmptyCategoryRecord()
      for (const [cat, val] of Object.entries(dirNode.categorySizes) as Array<[FileCategory, number]>) {
        negCategories[cat] = -val
      }

      parent.children.delete(key)
      this.propagateMetrics(parent, -removedBytes, -removedFiles, -removedFolders, negCategories)
      this.scannedFiles = Math.max(0, this.scannedFiles - removedFiles)
      this.scannedFolders = Math.max(0, this.scannedFolders - removedFolders)

      // Clean descendants from maps and topFiles
      const prefix = key + '\\'
      for (const k of Array.from(this.nodeByPath.keys())) {
        if (k === key || k.startsWith(prefix)) {
          this.nodeByPath.delete(k)
          this.spaceHogs.delete(k)
        }
      }
      this.topFiles = this.topFiles.filter((f) => {
        const fk = f.path.toLowerCase()
        return fk !== key && !fk.startsWith(prefix)
      })

      if (this.focusPath.toLowerCase() === key || this.focusPath.toLowerCase().startsWith(prefix)) {
        this.focusPath = parent.path
      }
      return removedBytes
    }

    // Case 2: Target is a direct file inside its parent folder
    const parentPath = normalizeFsPath(path.dirname(norm))
    const parentNode = this.nodeByPath.get(parentPath.toLowerCase())
    if (parentNode) {
      const idx = parentNode.directFiles.findIndex((f) => f.path.toLowerCase() === key)
      if (idx !== -1) {
        const [removedFile] = parentNode.directFiles.splice(idx, 1)
        const negCategories = createEmptyCategoryRecord()
        negCategories[removedFile.category] = -removedFile.size
        parentNode.ownFilesSize = Math.max(0, parentNode.ownFilesSize - removedFile.size)
        parentNode.ownFileCount = Math.max(0, parentNode.ownFileCount - 1)
        this.propagateMetrics(parentNode, -removedFile.size, -1, 0, negCategories)
        this.scannedFiles = Math.max(0, this.scannedFiles - 1)
        this.topFiles = this.topFiles.filter((f) => f.path.toLowerCase() !== key)
        return removedFile.size
      }
    }

    return 0
  }

  public getSnapshot(): ScanSnapshot {
    const focusNode = this.nodeByPath.get(this.focusPath.toLowerCase()) ?? this.rootNode
    const rootSize = Math.max(1, this.rootNode.totalSize)
    const parentSize = Math.max(1, focusNode.totalSize)

    // Build breadcrumbs from rootNode -> focusNode
    const breadcrumbs: Array<{ name: string; path: string; size: number }> = []
    let curr: DirNode | null = focusNode
    while (curr) {
      breadcrumbs.unshift({
        name: curr.name,
        path: curr.path,
        size: curr.totalSize
      })
      curr = curr.parent
    }

    const items: ScanItemSnapshot[] = []

    for (const childDir of focusNode.children.values()) {
      const dominantCat = getDominantCategory(childDir.categorySizes, childDir.specialBadge)

      // Top children preview for nested treemap blocks
      const childrenPreview = Array.from(childDir.children.values())
        .filter((c) => c.totalSize > 0)
        .sort((a, b) => b.totalSize - a.totalSize)
        .slice(0, 6)
        .map((c) => ({
          name: c.name,
          path: c.path,
          size: c.totalSize,
          category: getDominantCategory(c.categorySizes, c.specialBadge),
          type: 'folder' as const
        }))

      items.push({
        name: childDir.name,
        path: childDir.path,
        type: 'folder',
        size: childDir.totalSize,
        percentOfParent: focusNode.totalSize > 0 ? (childDir.totalSize / parentSize) * 100 : 0,
        percentOfRoot: this.rootNode.totalSize > 0 ? (childDir.totalSize / rootSize) * 100 : 0,
        fileCount: childDir.totalFileCount,
        folderCount: childDir.totalFolderCount,
        isScanning: childDir.pendingSubdirs > 0,
        accessDenied: childDir.accessDenied,
        category: dominantCat,
        specialBadge: childDir.specialBadge,
        childrenPreview: childrenPreview.length > 0 ? childrenPreview : undefined
      })
    }

    for (const file of focusNode.directFiles) {
      items.push({
        name: file.name,
        path: file.path,
        type: 'file',
        size: file.size,
        percentOfParent: focusNode.totalSize > 0 ? (file.size / parentSize) * 100 : 0,
        percentOfRoot: this.rootNode.totalSize > 0 ? (file.size / rootSize) * 100 : 0,
        fileCount: 1,
        folderCount: 0,
        isScanning: false,
        category: file.category
      })
    }

    items.sort((a, b) => b.size - a.size)
    const boundedItems = items.slice(0, 250)

    const hogsList: SpaceHogEntry[] = Array.from(this.spaceHogs.values())
      .filter((h) => h.totalSize > 10 * 1024 * 1024) // > 10 MB
      .sort((a, b) => b.totalSize - a.totalSize)
      .slice(0, 40)
      .map((h) => ({
        name: h.name,
        path: h.path,
        size: h.totalSize,
        fileCount: h.totalFileCount,
        kind: h.hogKind ?? 'Pasta Pesada',
        category: getDominantCategory(h.categorySizes, h.specialBadge)
      }))

    // Collect top significant folders across the scanned tree (depths 1..4) for AI analysis
    const candidateFolders: DirNode[] = []
    for (const dir of this.nodeByPath.values()) {
      if (dir.depth >= 1 && dir.depth <= 4 && dir.totalSize > 5 * 1024 * 1024) {
        candidateFolders.push(dir)
      }
    }
    candidateFolders.sort((a, b) => b.totalSize - a.totalSize)
    const topFolders: TopFolderEntry[] = candidateFolders.slice(0, 35).map((d) => ({
      name: d.name,
      path: d.path,
      size: d.totalSize,
      fileCount: d.totalFileCount,
      category: getDominantCategory(d.categorySizes, d.specialBadge),
      specialBadge: d.specialBadge
    }))

    const now = this.pauseStartedAt ?? Date.now()
    const elapsedMs =
      this.startTimeMs > 0 ? Math.max(1, now - this.startTimeMs - this.pausedAccumulatedMs) : 0
    const filesPerSec = elapsedMs > 0 ? Math.round((this.scannedFiles / elapsedMs) * 1000) : 0

    return {
      status: this.status,
      rootPath: this.rootPath,
      focusPath: focusNode.path,
      focusSize: focusNode.totalSize,
      breadcrumbs,
      items: boundedItems,
      topFolders,
      topFiles: this.topFiles.slice(0, 50),
      spaceHogs: hogsList,
      categoryTotals: { ...this.categoryTotals },
      errorMessage: this.errorMessage,
      stats: {
        scannedFiles: this.scannedFiles,
        scannedFolders: this.scannedFolders,
        skippedCount: this.skippedCount,
        totalBytes: this.rootNode.totalSize,
        elapsedMs,
        filesPerSec,
        currentPath: this.currentPath
      }
    }
  }
}
