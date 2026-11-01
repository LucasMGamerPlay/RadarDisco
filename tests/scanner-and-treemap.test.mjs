import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { Worker } from 'node:worker_threads'
import { DiskScanEngine } from '../src/main/scannerCore.ts'
import { buildSmartWebSearchUrl } from '../src/main/aiService.ts'
import { executeDiskTrashOrDelete } from '../src/main/trashService.ts'
import { computeSquarifiedTreemap } from '../src/renderer/src/utils/treemap.ts'

test('DiskScanEngine scans nested folders, classifies AI/node_modules, and removes nodes accurately', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'radardisco-test-'))

  try {
    const modelsDir = path.join(tempRoot, 'ollama')
    const nodeModulesDir = path.join(tempRoot, 'projeto', 'node_modules', 'pkg')
    const mediaDir = path.join(tempRoot, 'videos')

    await fs.mkdir(modelsDir, { recursive: true })
    await fs.mkdir(nodeModulesDir, { recursive: true })
    await fs.mkdir(mediaDir, { recursive: true })

    // Create sample files with known byte sizes
    await fs.writeFile(path.join(modelsDir, 'llama3.gguf'), Buffer.alloc(15 * 1024 * 1024, 1)) // 15 MB
    await fs.writeFile(path.join(nodeModulesDir, 'bundle.js'), Buffer.alloc(12 * 1024 * 1024, 2)) // 12 MB
    await fs.writeFile(path.join(mediaDir, 'aula.mp4'), Buffer.alloc(5 * 1024 * 1024, 3)) // 5 MB

    const engine = new DiskScanEngine(tempRoot, 8)
    await engine.run()

    const snap = engine.getSnapshot()
    const expectedTotal = (15 + 12 + 5) * 1024 * 1024

    assert.equal(snap.status, 'completed')
    assert.equal(snap.stats.scannedFiles, 3)
    assert.equal(snap.stats.totalBytes, expectedTotal)
    assert.equal(snap.categoryTotals.ai_models, 15 * 1024 * 1024)
    assert.equal(snap.categoryTotals.dev_deps, 12 * 1024 * 1024)
    assert.equal(snap.categoryTotals.media, 5 * 1024 * 1024)

    // Verify space hogs detected (>10 MB)
    assert.ok(snap.spaceHogs.length >= 2, 'Should detect ollama and node_modules as space hogs')

    // Test drill-down focusPath
    engine.setFocusPath(modelsDir)
    const focusedSnap = engine.getSnapshot()
    assert.equal(focusedSnap.focusPath.toLowerCase(), modelsDir.toLowerCase())
    assert.equal(focusedSnap.breadcrumbs.length, 2)
    assert.equal(focusedSnap.items.length, 1)
    assert.equal(focusedSnap.items[0].name, 'llama3.gguf')

    // Test instant node removal after moving to Recycle Bin
    const removedBytes = engine.removeNodeByPath(modelsDir)
    assert.equal(removedBytes, 15 * 1024 * 1024)
    const afterRemoveSnap = engine.getSnapshot()
    assert.equal(afterRemoveSnap.stats.totalBytes, (12 + 5) * 1024 * 1024)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('computeSquarifiedTreemap preserves total area and produces valid coordinates', () => {
  const inputs = [
    { data: 'A', value: 500 },
    { data: 'B', value: 300 },
    { data: 'C', value: 150 },
    { data: 'D', value: 50 }
  ]
  const width = 800
  const height = 500
  const rects = computeSquarifiedTreemap(inputs, width, height)

  assert.equal(rects.length, 4)

  let sumArea = 0
  for (const r of rects) {
    assert.ok(Number.isFinite(r.x) && r.x >= 0)
    assert.ok(Number.isFinite(r.y) && r.y >= 0)
    assert.ok(Number.isFinite(r.width) && r.width > 0)
    assert.ok(Number.isFinite(r.height) && r.height > 0)
    sumArea += r.width * r.height
  }

  assert.ok(Math.abs(sumArea - width * height) < 1, 'Total area of treemap rectangles must match container')
})

test('Built scannerWorker.js communicates via worker_threads and completes scan', async () => {
  const workerPath = path.resolve('out/main/scannerWorker.js')
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'radardisco-worker-'))

  try {
    await fs.writeFile(path.join(tempRoot, 'model.safetensors'), Buffer.alloc(2 * 1024 * 1024, 1))
    const snapshots = await new Promise((resolve, reject) => {
      const worker = new Worker(workerPath)
      const received = []
      worker.on('message', (snap) => {
        received.push(snap)
        if (snap.status === 'completed') {
          worker.terminate().then(() => resolve(received))
        }
      })
      worker.on('error', reject)
      worker.postMessage({ type: 'start', rootPath: tempRoot })
    })

    const last = snapshots[snapshots.length - 1]
    assert.equal(last.status, 'completed')
    assert.equal(last.stats.totalBytes, 2 * 1024 * 1024)
    assert.equal(last.categoryTotals.ai_models, 2 * 1024 * 1024)
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})

test('buildSmartWebSearchUrl strips personal Windows username and builds accurate search query', () => {
  const url = buildSmartWebSearchUrl(
    'DXCache',
    'C:\\Users\\lucas\\AppData\\Local\\NVIDIA\\DXCache',
    'folder'
  )
  const decoded = decodeURIComponent(url)
  assert.ok(!decoded.includes('lucas'), 'Should strip personal username from Google search query')
  assert.ok(decoded.includes('"DXCache"'))
  assert.ok(decoded.includes('Local\\NVIDIA\\DXCache'))
})

test('executeDiskTrashOrDelete removes folder on real disk and blocks system roots', async () => {
  const blocked = await executeDiskTrashOrDelete('C:\\Windows', true)
  assert.equal(blocked.ok, false)

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'radardisco-trash-'))
  const targetFolder = path.join(tempRoot, 'cache-to-delete')
  await fs.mkdir(targetFolder, { recursive: true })
  await fs.writeFile(path.join(targetFolder, 'temp.bin'), Buffer.alloc(1024, 1))

  try {
    const res = await executeDiskTrashOrDelete(targetFolder, true)
    assert.equal(res.ok, true)
    await assert.rejects(fs.access(targetFolder), 'Folder must no longer exist on disk')
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true })
  }
})



