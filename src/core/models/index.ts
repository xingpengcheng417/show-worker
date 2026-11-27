export type PlatformOrigin = 'desktop_path' | 'ios_bookmark' | 'icloud_container' | 'web_mock';
export type PlatformKind = 'macos' | 'windows' | 'ipados' | 'ios' | 'web';

export interface Workspace {
  id: string;
  name: string;
  rootUri: string;
  platformOrigin: PlatformOrigin;
  securityBookmark?: string;
  expandedDirs: string[];
  lastOpenedAt: number;
}

export interface FileNode {
  id: string;
  name: string;
  relativePath: string;
  uri: string;
  kind: 'file' | 'directory';
  ext?: string;
  sizeBytes?: number;
  modifiedAt: number;
  children?: FileNode[];
}

export interface FileWatchEvent {
  workspaceId: string;
  uri: string;
  eventType: 'created' | 'modified' | 'deleted' | 'renamed';
  newUri?: string;
  timestamp: number;
}

export type LineEnding = 'LF' | 'CRLF';
export type ViewMode = 'wysiwyg' | 'source';
export type SyncConflictState = 'none' | 'external_modified' | 'external_deleted';

export interface CursorAnchor {
  pmPos: number;
  line: number;
  column: number;
  blockIndex: number;
  scrollTopRatio: number;
}

export interface DocumentStats {
  chars: number;
  words: number;
  lines: number;
  readingMinutes: number;
}

export interface DocumentSession {
  docId: string;
  uri: string;
  fileName: string;
  diskHash: string;
  savedContent: string;
  currentContent: string;
  isDirty: boolean;
  syncConflict: SyncConflictState;
  eol: LineEnding;
  encoding: 'UTF-8' | 'UTF-8-BOM';
  frontmatterRaw?: string;
  viewMode: ViewMode;
  cursorAnchor: CursorAnchor;
  stats: DocumentStats;
  lastSavedAt?: number;
  isLargeFile?: boolean;
}

export interface OutlineNode {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  slug: string;
  pos: number;
  line: number;
}

export interface SearchHit {
  uri: string;
  relativePath: string;
  fileName: string;
  line: number;
  column: number;
  matchLength: number;
  linePreview: string;
}

export interface RichBlockItem {
  id: string;
  kind: 'math' | 'mermaid';
  source: string;
  line: number;
}

export type AssetStorageStrategy =
  | 'relative_assets'
  | 'same_name_folder'
  | 'workspace_assets'
  | 'custom_dir';

export interface AssetPolicy {
  strategy: AssetStorageStrategy;
  customSubDir?: string;
  namingRule: 'timestamp_uuid' | 'original_dedup' | 'hash_short';
  forcePosixPath: boolean;
  encodeWhitespace: boolean;
  maxPasteWidthPx: number;
}

export interface RecoverySnapshot {
  snapshotId: string;
  docId: string;
  uri: string;
  baseDiskHash: string;
  draftContent: string;
  capturedAt: number;
  appVersion: string;
}

export interface RecentItem {
  uri: string;
  name: string;
  kind: 'file' | 'workspace';
  platformOrigin: PlatformOrigin;
  lastAccessedAt: number;
}

export type ThemeId = 'system' | 'paper-light' | 'warm-sepia' | 'night-slate';

export interface AppSettings {
  theme: ThemeId;
  fontSizePx: number;
  lineHeight: number;
  contentMaxWidthPx: number;
  defaultEol: LineEnding;
  autoSaveEnabled: boolean;
  autoSaveDelayMs: number;
  focusModeDefault: boolean;
  typewriterModeDefault: boolean;
  spellcheckEnabled: boolean;
  assetPolicy: AssetPolicy;
  keybindings: Record<string, string>;
}

export interface LocalMachineState {
  windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
    maximized: boolean;
  };
  sidebarVisible: boolean;
  sidebarWidthPx: number;
  activeSidebarTab: 'files' | 'toc' | 'search';
  lastWorkspaceUri?: string;
  openDocUris: string[];
  activeDocUri?: string;
  recentItems: RecentItem[];
}
