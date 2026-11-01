import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { TrashResult } from '../shared/types'

const execFileAsync = promisify(execFile)

function normalizeFsPath(p: string): string {
  const resolved = path.resolve(p)
  if (/^[a-zA-Z]:\\?$/.test(resolved)) {
    return resolved.endsWith('\\') ? resolved : `${resolved}\\`
  }
  return resolved.replace(/\\+$/, '')
}

const PROTECTED_PATHS = new Set([
  'c:\\',
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\users',
  'c:\\programdata',
  'c:\\system volume information',
  'c:\\$recycle.bin'
])

export function isProtectedSystemPath(targetPath: string): boolean {
  const norm = normalizeFsPath(targetPath).toLowerCase()
  if (/^[a-z]:\\$/.test(norm)) return true
  if (PROTECTED_PATHS.has(norm)) return true
  if (norm.startsWith('c:\\windows\\')) return true
  return false
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p)
    return true
  } catch {
    return false
  }
}

async function sendToWindowsRecycleBinViaPowerShell(targetPath: string, isDir: boolean): Promise<void> {
  const escaped = targetPath.replace(/'/g, "''")
  const method = isDir ? 'DeleteDirectory' : 'DeleteFile'
  const psScript = `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${method}('${escaped}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
    timeout: 30000,
    windowsHide: true
  })
}

async function removeSingleTarget(
  targetPath: string,
  isDir: boolean,
  permanent: boolean,
  electronTrashFn?: (p: string) => Promise<void>
): Promise<void> {
  if (permanent) {
    await fs.rm(targetPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 })
    return
  }

  if (electronTrashFn) {
    await electronTrashFn(targetPath)
  } else {
    await sendToWindowsRecycleBinViaPowerShell(targetPath, isDir)
  }
}

/**
 * Safely moves a folder/file to the Windows Recycle Bin (or permanently deletes it if requested),
 * verifies on disk that it was actually removed, and if a folder couldn't be removed as a single unit
 * (e.g. a cache folder like Temp/DXCache with 1 locked file in use), cleans all unlocked items inside it!
 */
export async function executeDiskTrashOrDelete(
  rawPath: string,
  permanent = false,
  electronTrashFn?: (p: string) => Promise<void>
): Promise<TrashResult> {
  const norm = normalizeFsPath(rawPath)

  if (isProtectedSystemPath(norm)) {
    return {
      ok: false,
      error: 'Este diretório faz parte do sistema operacional ou raiz da unidade e está protegido contra exclusão.'
    }
  }

  let stat
  try {
    stat = await fs.lstat(norm)
  } catch {
    return {
      ok: false,
      error: `O caminho não foi encontrado no disco: ${norm}`
    }
  }

  const isDir = stat.isDirectory()

  // Step 1: Try removing the item as a whole
  try {
    await removeSingleTarget(norm, isDir, permanent, electronTrashFn)
  } catch {
    // If top-level trash failed (e.g. read-only or locked child), we fall through to verification & child-by-child cleanup
  }

  // Step 2: Verify if the target is actually gone from the filesystem
  if (!(await pathExists(norm))) {
    return { ok: true }
  }

  // Step 3: If it's a single file and still exists, try force removing read-only attribute or report locked
  if (!isDir) {
    try {
      await fs.chmod(norm, 0o666)
      await fs.rm(norm, { force: true })
    } catch {
      // still locked
    }
    if (!(await pathExists(norm))) {
      return { ok: true }
    }
    return {
      ok: false,
      error: 'Este arquivo está em uso por outro programa no momento e não pôde ser apagado.'
    }
  }

  // Step 4: Target is a directory that still exists on disk (common for Temp / Cache folders with 1 locked file,
  // or folders too large for the Recycle Bin). Clean child-by-child!
  let entries
  try {
    entries = await fs.readdir(norm, { withFileTypes: true })
  } catch {
    return {
      ok: false,
      error: 'Não foi possível acessar o conteúdo desta pasta (Permissão negada pelo Windows).'
    }
  }

  let deletedCount = 0
  let lockedCount = 0

  for (const entry of entries) {
    const childPath = path.join(norm, entry.name)
    const childIsDir = entry.isDirectory()
    try {
      await removeSingleTarget(childPath, childIsDir, permanent, electronTrashFn)
    } catch {
      // Fallback: if Recycle Bin rejected the child (e.g. too large or read-only), try fs.rm
      try {
        await fs.rm(childPath, { recursive: true, force: true, maxRetries: 1, retryDelay: 50 })
      } catch {
        // Locked by running process
      }
    }

    if (await pathExists(childPath)) {
      lockedCount++
    } else {
      deletedCount++
    }
  }

  // Try removing the parent directory itself if all children were removed
  if (lockedCount === 0) {
    try {
      await fs.rmdir(norm)
    } catch {
      // ignore if non-empty
    }
  }

  const stillThere = await pathExists(norm)
  if (!stillThere) {
    return { ok: true }
  }

  if (deletedCount > 0) {
    return {
      ok: true,
      partial: true,
      message: `Limpeza concluída (${deletedCount} subitens apagados; ${lockedCount} arquivo(s) em uso pelo sistema foram ignorados).`
    }
  }

  return {
    ok: false,
    error:
      'Os arquivos desta pasta estão em uso por outro programa ou exigem permissão de Administrador. Feche os programas relacionados e tente novamente.'
  }
}
