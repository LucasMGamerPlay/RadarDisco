export type FileCategory =
  | 'ai_models'   // .safetensors, .gguf, .ckpt, .onnx, .pt, .pth, .bin
  | 'games_apps'  // .exe, .dll, .pak, .asar, .msi, .iso, .cab
  | 'media'       // .mp4, .mkv, .mov, .mp3, .wav, .flac, .png, .jpg, .webp, .avi
  | 'dev_deps'    // node_modules, .git, .venv, __pycache__, dist, target, .next
  | 'archives'    // .zip, .rar, .7z, .tar, .gz, .vhdx, .vmdk, .bak
  | 'documents'   // .pdf, .docx, .xlsx, .pptx, .txt, .md, .csv, .json
  | 'other';

export interface DriveInfo {
  mount: string;       // ex: "C:\"
  label: string;       // ex: "Sistema"
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export interface ScanChildPreview {
  name: string;
  path: string;
  size: number;
  category: FileCategory;
  type: 'folder' | 'file';
}

export interface ScanItemSnapshot {
  name: string;
  path: string;
  type: 'folder' | 'file';
  size: number;
  percentOfParent: number;
  percentOfRoot: number;
  fileCount: number;
  folderCount: number;
  isScanning: boolean;
  accessDenied?: boolean;
  category: FileCategory;
  specialBadge?: string;
  childrenPreview?: ScanChildPreview[];
}

export interface TopFolderEntry {
  name: string;
  path: string;
  size: number;
  fileCount: number;
  category: FileCategory;
  specialBadge?: string;
}

export interface TopFileEntry {
  name: string;
  path: string;
  parentPath: string;
  size: number;
  category: FileCategory;
}

export interface SpaceHogEntry {
  name: string;
  path: string;
  size: number;
  fileCount: number;
  kind: string;
  category: FileCategory;
}

export interface ScanSnapshot {
  status: 'idle' | 'scanning' | 'paused' | 'completed' | 'cancelled' | 'error';
  rootPath: string;
  focusPath: string;
  focusSize: number;
  breadcrumbs: Array<{ name: string; path: string; size: number }>;
  items: ScanItemSnapshot[];
  topFolders: TopFolderEntry[];
  topFiles: TopFileEntry[];
  spaceHogs: SpaceHogEntry[];
  categoryTotals: Record<FileCategory, number>;
  errorMessage?: string;
  stats: {
    scannedFiles: number;
    scannedFolders: number;
    skippedCount: number;
    totalBytes: number;
    elapsedMs: number;
    filesPerSec: number;
    currentPath: string;
  };
}

export type WorkerCommand =
  | { type: 'start'; rootPath: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'cancel' }
  | { type: 'focus'; path: string }
  | { type: 'removeNode'; path: string };

export interface TrashResult {
  ok: boolean;
  error?: string;
  freedBytes?: number;
  partial?: boolean;
  message?: string;
}

export type AiProvider = 'gemini' | 'local';

export interface AiSettings {
  provider: AiProvider;
  geminiApiKey: string;
  geminiModel: string;
  localApiStyle: 'ollama' | 'openai';
  localBaseUrl: string;
  localModel: string;
  unloadAfterAnalysis?: boolean;
}

export type AiRiskLevel = 'safe' | 'caution' | 'danger';

export interface AiRecommendationItem {
  name: string;
  path: string;
  itemType: 'folder' | 'file';
  sizeBytes: number;
  riskLevel: AiRiskLevel;
  whatIsIt: string;
  whyAndImpact: string;
}

export interface AiAnalysisReport {
  providerUsed: string;
  modelUsed: string;
  generatedAt: string;
  summary: string;
  estimatedReclaimableBytes: number;
  recommendations: AiRecommendationItem[];
}

export interface AiAnalyzeResponse {
  ok: boolean;
  report?: AiAnalysisReport;
  error?: string;
  needsSetup?: boolean;
}

export interface DiskRadarApi {
  listDrives: () => Promise<DriveInfo[]>;
  pickFolder: () => Promise<string | null>;
  startScan: (rootPath: string) => Promise<void>;
  pauseScan: () => Promise<void>;
  resumeScan: () => Promise<void>;
  cancelScan: () => Promise<void>;
  focusPath: (targetPath: string) => Promise<void>;
  showInExplorer: (targetPath: string) => Promise<void>;
  copyPath: (targetPath: string) => Promise<void>;
  searchOnWeb: (name: string, targetPath: string, itemType: 'folder' | 'file') => Promise<void>;
  moveToTrash: (targetPath: string, permanent?: boolean) => Promise<TrashResult>;
  getAiSettings: () => Promise<AiSettings>;
  saveAiSettings: (settings: AiSettings) => Promise<AiSettings>;
  listLocalModels: (baseUrl: string, apiStyle: 'ollama' | 'openai') => Promise<string[]>;
  analyzeWithAi: (snapshot: ScanSnapshot) => Promise<AiAnalyzeResponse>;
  onScanSnapshot: (callback: (snapshot: ScanSnapshot) => void) => () => void;
}
