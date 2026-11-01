import { resolve } from 'path'
import { execFile } from 'node:child_process'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { listWindowsDrives } from './src/main/driveService'
import { DiskScanEngine, normalizeFsPath } from './src/main/scannerCore'
import { executeDiskTrashOrDelete } from './src/main/trashService'
import {
  analyzeDiskSnapshotWithAi,
  discoverLocalModels,
  loadAiSettings,
  saveAiSettings
} from './src/main/aiService'
import type { AiSettings, ScanSnapshot } from './src/shared/types'

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolveBody) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {})
      } catch {
        resolveBody({})
      }
    })
  })
}

function browserFallbackApiPlugin(): Plugin {
  let engine: DiskScanEngine | null = null
  let timer: NodeJS.Timeout | null = null
  const clients = new Set<ServerResponse>()

  const broadcast = (): void => {
    if (!engine || clients.size === 0) return
    const payload = `data: ${JSON.stringify(engine.getSnapshot())}\n\n`
    for (const res of clients) {
      res.write(payload)
    }
  }

  const stopTimer = (): void => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return {
    name: 'radardisco-browser-fallback-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()

        res.setHeader('Cache-Control', 'no-cache')

        if (url === '/api/drives' && req.method === 'GET') {
          const drives = await listWindowsDrives()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(drives))
          return
        }

        if (url === '/api/scan/events' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            Connection: 'keep-alive',
            'Cache-Control': 'no-cache'
          })
          clients.add(res)
          if (engine) {
            res.write(`data: ${JSON.stringify(engine.getSnapshot())}\n\n`)
          }
          req.on('close', () => {
            clients.delete(res)
          })
          return
        }

        if (url === '/api/scan/start' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const rootPath = String(body.rootPath ?? 'C:\\')
          if (engine) engine.cancel()
          engine = new DiskScanEngine(rootPath, 24)
          broadcast()
          stopTimer()
          timer = setInterval(broadcast, 120)

          engine
            .run()
            .catch(() => {})
            .finally(() => {
              stopTimer()
              broadcast()
            })

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url === '/api/scan/pause' && req.method === 'POST') {
          engine?.pause()
          broadcast()
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url === '/api/scan/resume' && req.method === 'POST') {
          engine?.resume()
          broadcast()
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url === '/api/scan/cancel' && req.method === 'POST') {
          engine?.cancel()
          stopTimer()
          broadcast()
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url === '/api/scan/focus' && req.method === 'POST') {
          const body = await readJsonBody(req)
          if (engine && typeof body.path === 'string') {
            engine.setFocusPath(body.path)
            broadcast()
          }
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url === '/api/item/explorer' && req.method === 'POST') {
          const body = await readJsonBody(req)
          if (typeof body.path === 'string') {
            const norm = normalizeFsPath(body.path)
            execFile('explorer.exe', [`/select,${norm}`])
          }
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (url === '/api/item/trash' && req.method === 'POST') {
          const body = await readJsonBody(req)
          if (typeof body.path === 'string') {
            const norm = normalizeFsPath(body.path)
            const trashRes = await executeDiskTrashOrDelete(norm, Boolean(body.permanent))
            if (trashRes.ok && engine) {
              engine.removeNodeByPath(norm)
              broadcast()
            }
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(trashRes))
            return
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Caminho inválido' }))
          return
        }

        if (url === '/api/ai/settings' && req.method === 'GET') {
          const settings = await loadAiSettings()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(settings))
          return
        }

        if (url === '/api/ai/settings' && req.method === 'POST') {
          const body = (await readJsonBody(req)) as unknown as AiSettings
          const saved = await saveAiSettings(body)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(saved))
          return
        }

        if (url === '/api/ai/local-models' && req.method === 'POST') {
          const body = await readJsonBody(req)
          const models = await discoverLocalModels(
            String(body.baseUrl ?? 'http://localhost:11434'),
            body.apiStyle === 'openai' ? 'openai' : 'ollama'
          )
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(models))
          return
        }

        if (url === '/api/ai/analyze' && req.method === 'POST') {
          const body = (await readJsonBody(req)) as unknown as ScanSnapshot
          const result = await analyzeDiskSnapshotWithAi(body)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
          return
        }

        next()
      })
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          scannerWorker: resolve(__dirname, 'src/main/scannerWorker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss(), browserFallbackApiPlugin()]
  }
})
