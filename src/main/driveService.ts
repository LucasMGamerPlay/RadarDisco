import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import type { DriveInfo } from '../shared/types'

const execFileAsync = promisify(execFile)

interface CimDisk {
  DeviceID?: string
  VolumeName?: string | null
  DriveType?: number
  Size?: number | null
  FreeSpace?: number | null
}

export async function listWindowsDrives(): Promise<DriveInfo[]> {
  try {
    const psCommand =
      '@(Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, VolumeName, DriveType, Size, FreeSpace) | ConvertTo-Json -Compress'
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psCommand], {
      timeout: 8000,
      windowsHide: true
    })

    const raw = stdout.trim()
    if (raw) {
      const parsed = JSON.parse(raw)
      const list: CimDisk[] = Array.isArray(parsed) ? parsed : [parsed]
      const drives: DriveInfo[] = []

      for (const item of list) {
        if (!item.DeviceID || !item.Size || item.Size <= 0) continue
        const totalBytes = Number(item.Size)
        const freeBytes = Number(item.FreeSpace ?? 0)
        const usedBytes = Math.max(0, totalBytes - freeBytes)
        const usedPercent = totalBytes > 0 ? Math.min(100, (usedBytes / totalBytes) * 100) : 0
        const mount = item.DeviceID.endsWith('\\') ? item.DeviceID : `${item.DeviceID}\\`
        const label = item.VolumeName && item.VolumeName.trim().length > 0 ? item.VolumeName.trim() : 'Disco Local'

        drives.push({
          mount,
          label,
          totalBytes,
          freeBytes,
          usedBytes,
          usedPercent
        })
      }

      if (drives.length > 0) {
        return drives.sort((a, b) => a.mount.localeCompare(b.mount))
      }
    }
  } catch {
    // Fallback below if PowerShell CIM is unavailable
  }

  // Fallback using Node native fs.statfs across letters C..Z
  const fallbackDrives: DriveInfo[] = []
  const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  await Promise.all(
    letters.map(async (letter) => {
      const mount = `${letter}:\\`
      try {
        const stats = await fs.statfs(mount)
        const totalBytes = stats.blocks * stats.bsize
        const freeBytes = stats.bfree * stats.bsize
        if (totalBytes > 0) {
          const usedBytes = Math.max(0, totalBytes - freeBytes)
          fallbackDrives.push({
            mount,
            label: 'Disco Local',
            totalBytes,
            freeBytes,
            usedBytes,
            usedPercent: (usedBytes / totalBytes) * 100
          })
        }
      } catch {
        // Drive letter not mounted
      }
    })
  )

  return fallbackDrives.sort((a, b) => a.mount.localeCompare(b.mount))
}
