import type { DiskRadarApi } from '../shared/types'

declare global {
  interface Window {
    diskApi: DiskRadarApi
  }
}
