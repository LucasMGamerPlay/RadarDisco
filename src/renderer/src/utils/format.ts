import type { FileCategory } from '@shared/types'

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

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
  const value = bytes / Math.pow(k, i)
  const fixed = i === 0 ? value.toFixed(0) : value.toFixed(value >= 100 ? 0 : decimals)
  return `${fixed} ${units[i]}`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0,0s'
  if (ms < 1000) return `${(ms / 1000).toFixed(1).replace('.', ',')}s`
  const totalSec = Math.floor(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  if (mins === 0) {
    const tenths = Math.floor((ms % 1000) / 100)
    return `${secs},${tenths}s`
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}

export interface CategoryMeta {
  id: FileCategory
  label: string
  shortLabel: string
  barClass: string
  badgeClass: string
  treemapBg: string
  treemapBorder: string
  hex: string
}

export const CATEGORY_META: Record<FileCategory, CategoryMeta> = {
  ai_models: {
    id: 'ai_models',
    label: 'Modelos & Pesos de IA',
    shortLabel: 'Modelos IA',
    barClass: 'bg-fuchsia-500',
    badgeClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    treemapBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.36), rgba(126, 34, 206, 0.52))',
    treemapBorder: 'rgba(216, 180, 254, 0.35)',
    hex: '#d946ef'
  },
  games_apps: {
    id: 'games_apps',
    label: 'Jogos, Executáveis & Sistema',
    shortLabel: 'Jogos / Apps',
    barClass: 'bg-sky-500',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    treemapBg: 'linear-gradient(135deg, rgba(14, 165, 233, 0.36), rgba(3, 105, 161, 0.52))',
    treemapBorder: 'rgba(125, 211, 252, 0.35)',
    hex: '#0ea5e9'
  },
  media: {
    id: 'media',
    label: 'Vídeos, Áudio & Imagens',
    shortLabel: 'Mídia',
    barClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    treemapBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.36), rgba(4, 120, 87, 0.52))',
    treemapBorder: 'rgba(110, 231, 183, 0.35)',
    hex: '#10b981'
  },
  dev_deps: {
    id: 'dev_deps',
    label: 'Código, node_modules & Ambientes',
    shortLabel: 'Dev / Deps',
    barClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    treemapBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.36), rgba(180, 83, 9, 0.52))',
    treemapBorder: 'rgba(252, 211, 77, 0.35)',
    hex: '#f59e0b'
  },
  archives: {
    id: 'archives',
    label: 'Compactados & Discos Virtuais',
    shortLabel: 'Compactados',
    barClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    treemapBg: 'linear-gradient(135deg, rgba(244, 63, 94, 0.36), rgba(190, 18, 60, 0.52))',
    treemapBorder: 'rgba(253, 164, 175, 0.35)',
    hex: '#f43f5e'
  },
  documents: {
    id: 'documents',
    label: 'Documentos & Bancos de Dados',
    shortLabel: 'Documentos',
    barClass: 'bg-indigo-400',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    treemapBg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.36), rgba(67, 56, 202, 0.52))',
    treemapBorder: 'rgba(165, 180, 252, 0.35)',
    hex: '#818cf8'
  },
  other: {
    id: 'other',
    label: 'Outros Arquivos',
    shortLabel: 'Outros',
    barClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    treemapBg: 'linear-gradient(135deg, rgba(100, 116, 139, 0.36), rgba(51, 65, 85, 0.52))',
    treemapBorder: 'rgba(148, 163, 184, 0.32)',
    hex: '#94a3b8'
  }
}
