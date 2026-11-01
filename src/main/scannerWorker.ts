import { parentPort } from 'node:worker_threads'
import { DiskScanEngine } from './scannerCore'
import type { WorkerCommand } from '../shared/types'

let engine: DiskScanEngine | null = null
let snapshotTimer: NodeJS.Timeout | null = null

function emitSnapshot(): void {
  if (!engine || !parentPort) return
  parentPort.postMessage(engine.getSnapshot())
}

function startPeriodicSnapshots(): void {
  stopPeriodicSnapshots()
  snapshotTimer = setInterval(() => {
    emitSnapshot()
  }, 120)
}

function stopPeriodicSnapshots(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer)
    snapshotTimer = null
  }
}

parentPort?.on('message', async (cmd: WorkerCommand) => {
  switch (cmd.type) {
    case 'start': {
      if (engine) {
        engine.cancel()
      }
      engine = new DiskScanEngine(cmd.rootPath, 24)
      emitSnapshot()
      startPeriodicSnapshots()

      try {
        await engine.run()
      } catch (err) {
        if (engine) {
          engine.status = 'error'
          engine.errorMessage = err instanceof Error ? err.message : String(err)
        }
      } finally {
        stopPeriodicSnapshots()
        emitSnapshot()
      }
      break
    }

    case 'pause': {
      engine?.pause()
      emitSnapshot()
      break
    }

    case 'resume': {
      engine?.resume()
      emitSnapshot()
      break
    }

    case 'cancel': {
      engine?.cancel()
      stopPeriodicSnapshots()
      emitSnapshot()
      break
    }

    case 'focus': {
      if (engine) {
        engine.setFocusPath(cmd.path)
        emitSnapshot()
      }
      break
    }

    case 'removeNode': {
      if (engine) {
        engine.removeNodeByPath(cmd.path)
        emitSnapshot()
      }
      break
    }
  }
})
