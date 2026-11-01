import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { GoogleGenAI } from '@google/genai'
import type {
  AiAnalysisReport,
  AiAnalyzeResponse,
  AiRecommendationItem,
  AiRiskLevel,
  AiSettings,
  ScanSnapshot
} from '../shared/types'

const execFileAsync = promisify(execFile)

const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
  geminiModel: 'gemini-3.8-flash',
  localApiStyle: 'ollama',
  localBaseUrl: 'http://localhost:11434',
  localModel: '',
  unloadAfterAnalysis: true
}

function getSettingsFilePath(customDir?: string): string {
  const baseDir = customDir || path.join(os.homedir(), '.radardisco')
  return path.join(baseDir, 'ai-settings.json')
}

export async function loadAiSettings(customDir?: string): Promise<AiSettings> {
  const filePath = getSettingsFilePath(customDir)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AiSettings>
    let geminiModel = parsed.geminiModel || DEFAULT_AI_SETTINGS.geminiModel
    if (/^gemini-(1\.5|2\.0|2\.5)/.test(geminiModel)) {
      geminiModel = 'gemini-3.8-flash'
    }
    return {
      provider: parsed.provider === 'local' ? 'local' : 'gemini',
      geminiApiKey: parsed.geminiApiKey ?? DEFAULT_AI_SETTINGS.geminiApiKey,
      geminiModel,
      localApiStyle: parsed.localApiStyle === 'openai' ? 'openai' : 'ollama',
      localBaseUrl: parsed.localBaseUrl || DEFAULT_AI_SETTINGS.localBaseUrl,
      localModel: parsed.localModel ?? '',
      unloadAfterAnalysis: parsed.unloadAfterAnalysis ?? true
    }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export async function saveAiSettings(
  next: AiSettings,
  customDir?: string
): Promise<AiSettings> {
  const filePath = getSettingsFilePath(customDir)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const normalized: AiSettings = {
    provider: next.provider === 'local' ? 'local' : 'gemini',
    geminiApiKey: (next.geminiApiKey ?? '').trim(),
    geminiModel: next.geminiModel || 'gemini-3.8-flash',
    localApiStyle: next.localApiStyle === 'openai' ? 'openai' : 'ollama',
    localBaseUrl: (next.localBaseUrl || 'http://localhost:11434').trim().replace(/\/+$/, ''),
    localModel: (next.localModel ?? '').trim(),
    unloadAfterAnalysis: next.unloadAfterAnalysis ?? true
  }
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8')
  return normalized
}

export function buildSmartWebSearchUrl(
  name: string,
  targetPath: string,
  itemType: 'folder' | 'file'
): string {
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

export async function discoverLocalModels(
  baseUrl: string,
  apiStyle: 'ollama' | 'openai'
): Promise<string[]> {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, '')

  if (apiStyle === 'ollama') {
    try {
      const res = await fetch(`${cleanUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name?: string }> }
        const names = (data.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n))
        if (names.length > 0) return names
      }
    } catch {
      // Fallback to /v1/models below
    }
  }

  try {
    const res = await fetch(`${cleanUrl}/v1/models`, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id?: string }> }
      return (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id))
    }
  } catch {
    // Ignore connection failure
  }

  return []
}

function formatHumanSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, idx)).toFixed(1)} ${units[idx]}`
}

const REPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
      description: 'Resumo executivo em português do espaço analisado e recomendações principais.'
    },
    estimatedReclaimableBytes: {
      type: 'number',
      description: 'Soma aproximada em bytes dos itens safe/caution facilmente recuperáveis.'
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          path: { type: 'string' },
          itemType: { type: 'string', enum: ['folder', 'file'] },
          sizeBytes: { type: 'number' },
          riskLevel: { type: 'string', enum: ['safe', 'caution', 'danger'] },
          whatIsIt: { type: 'string' },
          whyAndImpact: { type: 'string' }
        },
        required: ['name', 'path', 'itemType', 'sizeBytes', 'riskLevel', 'whatIsIt', 'whyAndImpact']
      }
    }
  },
  required: ['summary', 'estimatedReclaimableBytes', 'recommendations']
}

const SYSTEM_INSTRUCTION = `Especialista em armazenamento Windows, dev, jogos e IA.
Classifique os itens escaneados em 3 níveis (riskLevel):
- "safe": Caches regeneráveis (pip\\cache, uv\\cache, .cache, .gradle\\caches, DXCache, ShaderCache, Zen\\Data\\cache), Temp, CrashDumps, Lixeira.
- "caution": node_modules, .venv, conda/envs (recriáveis se inativos), VaultCache/jogos (limpar pelo launcher), modelos IA (.lmstudio\\models, ollama, .gguf, .safetensors) se não usados, instaladores antigos.
- "danger": Windows, System32, WinSxS, Program Files, AppData\\Roaming crítico, OneDrive/Documentos pessoais, pagefile.sys/hiberfil.sys.

IMPORTANTE:
- Seja MUITO conciso e direto no seu raciocínio interno (não prolongue o rascunho) para economizar tokens.
- Responda SEMPRE em pt-BR, usando EXATAMENTE o "path", "name" e "sizeBytes" recebidos.
- Selecione de 8 a 12 itens mais relevantes (priorize safe e caution grandes, mais 2-3 alertas danger importantes).
- Retorne APENAS JSON válido neste formato exato:
{"summary":"...","estimatedReclaimableBytes":12345,"recommendations":[{"name":"...","path":"...","itemType":"folder","sizeBytes":12345,"riskLevel":"safe","whatIsIt":"...","whyAndImpact":"..."}]}`

function maskUserPath(p: string, username: string): string {
  if (!username) return p
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return p.replace(new RegExp(`(\\\\Users\\\\)${escaped}(\\\\|$)`, 'ig'), '$1<USER>$2')
}

function unmaskUserPath(p: string, username: string): string {
  if (!username) return p
  return p.replace(/\\Users\\<USER>(\\|$)/gi, `\\Users\\${username}$1`)
}

function extractJsonObject(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim())
    }
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
    }
    throw new Error('A resposta do modelo não veio em formato JSON válido.')
  }
}

/**
 * Builds an ultra-compact (~800-1100 tokens) deduplicated summary of folders, space hogs and files
 * so local reasoning models with 8k context windows (like LM Studio / Ollama) have 6,500+ tokens free for output.
 */
function buildCompactPrompt(snapshot: ScanSnapshot, username: string): string {
  const seenPaths = new Set<string>()
  const folderLines: string[] = []

  // 1. Add Space Hogs first (highest actionable signal: caches, node_modules, .venv, AI models)
  for (const h of snapshot.spaceHogs.slice(0, 16)) {
    const key = h.path.toLowerCase()
    if (seenPaths.has(key)) continue
    seenPaths.add(key)
    const mp = maskUserPath(h.path, username)
    folderLines.push(
      `FOLDER | name="${h.name}" | sizeBytes=${h.size} (${formatHumanSize(h.size)}) | kind="${h.kind}" | path="${mp}"`
    )
  }

  // 2. Add Top Folders (not already listed in spaceHogs)
  const sourceFolders = snapshot.topFolders?.length
    ? snapshot.topFolders
    : snapshot.items.filter((i) => i.type === 'folder')

  for (const f of sourceFolders) {
    if (folderLines.length >= 26) break
    const key = f.path.toLowerCase()
    if (seenPaths.has(key)) continue
    seenPaths.add(key)
    const mp = maskUserPath(f.path, username)
    const badgeInfo = f.specialBadge ? ` | badge="${f.specialBadge}"` : ''
    folderLines.push(
      `FOLDER | name="${f.name}" | sizeBytes=${f.size} (${formatHumanSize(f.size)})${badgeInfo} | path="${mp}"`
    )
  }

  // 3. Add Top 10 Largest Individual Files
  const fileLines: string[] = []
  for (const file of snapshot.topFiles.slice(0, 10)) {
    const mp = maskUserPath(file.path, username)
    fileLines.push(
      `FILE | name="${file.name}" | sizeBytes=${file.size} (${formatHumanSize(file.size)}) | cat="${file.category}" | path="${mp}"`
    )
  }

  return [
    `Unidade/Raiz: ${maskUserPath(snapshot.rootPath, username)} | Total Mapeado: ${formatHumanSize(snapshot.stats.totalBytes)} (${snapshot.stats.totalBytes} bytes) | Arquivos: ${snapshot.stats.scannedFiles}`,
    `--- PASTAS PRINCIPAIS E CACHES ---`,
    ...folderLines,
    `--- MAIORES ARQUIVOS INDIVIDUAIS ---`,
    ...fileLines
  ].join('\n')
}

async function callOpenAiCompatibleLocal(
  cleanBase: string,
  modelUsed: string,
  userPrompt: string
): Promise<{ content: string; finishReason?: string }> {
  const baseBody = {
    model: modelUsed,
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: userPrompt }
    ]
  }

  // Try with structured json_schema first (supported natively by LM Studio >= 0.3)
  let res = await fetch(`${cleanBase}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...baseBody,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'disk_analysis_report',
          strict: true,
          schema: REPORT_JSON_SCHEMA
        }
      }
    })
  })

  // Fallback without response_format if server rejects json_schema
  if (!res.ok && res.status === 400) {
    res = await fetch(`${cleanBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody)
    })
  }

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Erro no servidor local (${res.status}): ${errBody}`)
  }

  const json = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string
      message?: { content?: string; reasoning_content?: string }
    }>
  }

  const choice = json.choices?.[0]
  const content = (choice?.message?.content ?? '').trim()

  // Fallback: if a reasoning model put the final JSON block at the end of reasoning_content before stopping
  if (!content && choice?.message?.reasoning_content) {
    const reasoning = choice.message.reasoning_content
    const fence = reasoning.match(/```json\s*(\{[\s\S]*?\})\s*```/i)
    if (fence?.[1] && !fence[1].includes('"..."')) {
      return { content: fence[1], finishReason: choice.finish_reason }
    }
  }

  return { content, finishReason: choice?.finish_reason }
}

/**
 * Unloads the running local model from VRAM/RAM after analysis completes.
 * - Ollama: sends keep_alive: 0 to /api/generate
 * - LM Studio: executes `lms unload --all` via LM Studio CLI (and tries REST unload endpoint)
 */
export async function unloadLocalModelFromMemory(
  cleanBase: string,
  modelUsed: string,
  apiStyle: 'ollama' | 'openai'
): Promise<void> {
  if (apiStyle === 'ollama') {
    try {
      await fetch(`${cleanBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelUsed, keep_alive: 0 })
      })
    } catch {
      // ignore if already stopped
    }
    return
  }

  // LM Studio: try CLI `lms unload --all`
  const candidateBins = [
    'lms',
    path.join(os.homedir(), '.lmstudio', 'bin', 'lms.exe'),
    path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'Programs',
      'LM Studio',
      'resources',
      'app',
      '.webpack',
      'lms.exe'
    )
  ]

  for (const bin of candidateBins) {
    try {
      await execFileAsync(bin, ['unload', '--all'], { timeout: 8000, windowsHide: true })
      return
    } catch {
      // Try next candidate
    }
  }
}

export async function analyzeDiskSnapshotWithAi(
  snapshot: ScanSnapshot,
  customDir?: string
): Promise<AiAnalyzeResponse> {
  const settings = await loadAiSettings(customDir)

  if (settings.provider === 'gemini' && !settings.geminiApiKey.trim()) {
    return {
      ok: false,
      needsSetup: true,
      error: 'Configure sua chave da Google Gemini API ou selecione um modelo local (Ollama / LM Studio).'
    }
  }

  if (settings.provider === 'local' && !settings.localModel.trim()) {
    const discovered = await discoverLocalModels(settings.localBaseUrl, settings.localApiStyle)
    if (discovered.length === 0) {
      return {
        ok: false,
        needsSetup: true,
        error: `Não encontrei modelos rodando em ${settings.localBaseUrl}. Verifique se o Ollama ou LM Studio está aberto ou configure o modelo.`
      }
    }
    settings.localModel = discovered[0]
  }

  // Only mask username when sending to cloud (Gemini); keep exact paths for local models
  const username = settings.provider === 'gemini' ? os.userInfo().username || '' : ''
  const compactData = buildCompactPrompt(snapshot, username)
  const userPrompt = `Analise este mapeamento do disco Windows e retorne o diagnóstico em JSON:\n\n${compactData}`

  // Build lookup table of real scanned paths to guarantee 100% exact filesystem paths on return
  const realPathByLower = new Map<string, string>()
  const realPathByName = new Map<string, string>()
  for (const list of [
    snapshot.spaceHogs,
    snapshot.topFolders ?? [],
    snapshot.items,
    snapshot.topFiles
  ]) {
    for (const entry of list) {
      realPathByLower.set(entry.path.toLowerCase().replace(/\//g, '\\'), entry.path)
      if (!realPathByName.has(entry.name.toLowerCase())) {
        realPathByName.set(entry.name.toLowerCase(), entry.path)
      }
    }
  }

  try {
    let rawOutputText = ''
    let finishReason: string | undefined
    let providerLabel = ''
    let modelUsed = ''

    if (settings.provider === 'gemini') {
      providerLabel = 'Google Gemini'
      modelUsed = settings.geminiModel || 'gemini-3.8-flash'

      const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey.trim() })
      const interaction = await ai.interactions.create({
        model: modelUsed,
        system_instruction: SYSTEM_INSTRUCTION,
        input: userPrompt,
        response_format: REPORT_JSON_SCHEMA as never,
        store: false
      })

      rawOutputText = interaction.output_text ?? ''
    } else {
      const cleanBase = settings.localBaseUrl.trim().replace(/\/+$/, '')
      modelUsed = settings.localModel

      try {
        if (settings.localApiStyle === 'ollama') {
          providerLabel = 'Ollama (Local)'
          const res = await fetch(`${cleanBase}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: modelUsed,
              stream: false,
              keep_alive: settings.unloadAfterAnalysis !== false ? 0 : '5m',
              format: REPORT_JSON_SCHEMA,
              options: { num_ctx: 8192 },
              messages: [
                { role: 'system', content: SYSTEM_INSTRUCTION },
                { role: 'user', content: userPrompt }
              ]
            })
          })
          if (!res.ok) {
            const errBody = await res.text()
            throw new Error(`Erro no Ollama (${res.status}): ${errBody}`)
          }
          const json = (await res.json()) as { message?: { content?: string } }
          rawOutputText = json.message?.content ?? ''
        } else {
          providerLabel = 'LM Studio (Local)'
          const localRes = await callOpenAiCompatibleLocal(cleanBase, modelUsed, userPrompt)
          rawOutputText = localRes.content
          finishReason = localRes.finishReason
        }
      } finally {
        if (settings.unloadAfterAnalysis !== false) {
          await unloadLocalModelFromMemory(cleanBase, modelUsed, settings.localApiStyle)
        }
      }
    }

    if (!rawOutputText) {
      if (finishReason === 'length') {
        throw new Error(
          'O modelo local atingiu o limite de tokens (Context Length) durante o raciocínio antes de concluir o JSON. Tente clicar em Analisar novamente ou aumente o Context Length do modelo no LM Studio para 12288/16384.'
        )
      }
      throw new Error('O modelo de IA retornou uma resposta vazia.')
    }

    const parsed = extractJsonObject(rawOutputText)
    const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : []

    const recommendations: AiRecommendationItem[] = rawRecs.map((item: Record<string, unknown>) => {
      const rawRisk = String(item.riskLevel ?? 'caution').toLowerCase()
      const riskLevel: AiRiskLevel =
        rawRisk === 'safe' || rawRisk === 'caution' || rawRisk === 'danger' ? rawRisk : 'caution'

      const itemName = String(item.name ?? 'Item')
      const unmasked = unmaskUserPath(String(item.path ?? ''), os.userInfo().username || '').replace(
        /\//g,
        '\\'
      )
      const resolvedPath =
        realPathByLower.get(unmasked.toLowerCase()) ??
        realPathByName.get(itemName.toLowerCase()) ??
        unmasked

      return {
        name: itemName,
        path: resolvedPath,
        itemType: item.itemType === 'file' ? 'file' : 'folder',
        sizeBytes: Number(item.sizeBytes ?? 0),
        riskLevel,
        whatIsIt: String(item.whatIsIt ?? item.description ?? ''),
        whyAndImpact: String(item.whyAndImpact ?? item.reason ?? '')
      }
    })

    const summaryText = String(
      parsed.summary ?? parsed.analysis_summary ?? 'Análise concluída com sucesso.'
    )

    const fallbackReclaimable = recommendations
      .filter((r) => r.riskLevel === 'safe' || r.riskLevel === 'caution')
      .reduce((acc, r) => acc + r.sizeBytes, 0)

    const report: AiAnalysisReport = {
      providerUsed: providerLabel,
      modelUsed,
      generatedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      summary: summaryText,
      estimatedReclaimableBytes: Number(parsed.estimatedReclaimableBytes ?? fallbackReclaimable),
      recommendations
    }

    return { ok: true, report }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro inesperado ao consultar o modelo de IA.'
    }
  }
}
