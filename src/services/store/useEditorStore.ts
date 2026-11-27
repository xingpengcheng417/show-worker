import { create } from 'zustand';
import { applyLineEnding, normalizeToLf } from '@/core/markdown/eol';
import { combineFrontmatter, extractFrontmatter } from '@/core/markdown/frontmatter';
import {
  computeDocumentStats,
  extractOutline,
  extractRichBlocks,
} from '@/core/markdown/outline';
import { detectPlatform } from '@/core/shortcuts/keymap';
import type {
  AppSettings,
  DocumentSession,
  FileNode,
  LocalMachineState,
  OutlineNode,
  PlatformKind,
  RecoverySnapshot,
  RichBlockItem,
  SearchHit,
  ThemeId,
  UpdateInfo,
  UpdateProgress,
  UpdateStatus,
  ViewMode,
  Workspace,
} from '@/core/models';
import { isTauriRuntime, storageAdapter } from '@/services/platform';
import {
  clearRecoverySnapshot,
  getRecoverySnapshot,
  saveRecoverySnapshot,
} from '@/services/recovery/snapshotStore';
import {
  checkAppUpdate,
  getAppVersion,
  installAppUpdate,
  shouldPromptUpdate,
} from '@/services/updater/updateService';
import type { Update } from '@tauri-apps/plugin-updater';

const SETTINGS_KEY = 'showworker:app-settings:v1';
const MACHINE_KEY = 'showworker:machine-state:v1';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'paper-light',
  fontSizePx: 15,
  lineHeight: 1.75,
  contentMaxWidthPx: 800,
  defaultEol: 'LF',
  autoSaveEnabled: true,
  autoSaveDelayMs: 1500,
  focusModeDefault: false,
  typewriterModeDefault: false,
  spellcheckEnabled: false,
  autoCheckUpdates: true,
  assetPolicy: {
    strategy: 'relative_assets',
    namingRule: 'timestamp_uuid',
    forcePosixPath: true,
    encodeWhitespace: false,
    maxPasteWidthPx: 0,
  },
  keybindings: {
    toggleSource: 'Mod+/',
    save: 'Mod+S',
    toggleSidebar: 'Mod+\\',
    searchWorkspace: 'Mod+Shift+F',
  },
};

const DEFAULT_MACHINE_STATE: LocalMachineState = {
  windowBounds: { x: 100, y: 80, width: 1200, height: 780, maximized: false },
  sidebarVisible: true,
  sidebarWidthPx: 264,
  activeSidebarTab: 'files',
  openDocUris: [],
  recentItems: [],
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

function makeDocId(uri: string): string {
  let hash = 0;
  for (let i = 0; i < uri.length; i += 1) {
    hash = (hash * 31 + uri.charCodeAt(i)) | 0;
  }
  return `doc_${Math.abs(hash).toString(36)}`;
}

let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUpdateHandle: Update | null = null;

export interface EditorState {
  platform: PlatformKind;
  workspace: Workspace | null;
  tree: FileNode[];
  session: DocumentSession | null;
  outline: OutlineNode[];
  richBlocks: RichBlockItem[];
  searchQuery: string;
  searchResults: SearchHit[];
  settings: AppSettings;
  machineState: LocalMachineState;
  focusMode: boolean;
  typewriterMode: boolean;
  slashMenuOpen: boolean;
  pendingScrollLine: number | null;
  pendingRecovery: RecoverySnapshot | null;
  toastMessage: string | null;
  isBootstrapped: boolean;
  appVersion: string;
  updateStatus: UpdateStatus;
  availableUpdate: UpdateInfo | null;
  updateProgress: UpdateProgress;
  updateError: string | null;
  updateModalOpen: boolean;
  updateBannerDismissed: boolean;

  bootstrap: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  refreshTree: () => Promise<void>;
  openDocument: (uri: string, targetLine?: number) => Promise<void>;
  updateBodyContent: (bodyMarkdown: string) => void;
  updateFullContent: (fullMarkdown: string) => void;
  updateFrontmatter: (frontmatterRaw: string) => void;
  saveDocument: (force?: boolean) => Promise<void>;
  createDocument: (fileName: string) => Promise<void>;
  renameNode: (uri: string, newName: string) => Promise<void>;
  deleteNode: (uri: string) => Promise<void>;
  toggleViewMode: (target?: ViewMode) => void;
  toggleEol: () => void;
  toggleSidebar: (visible?: boolean) => void;
  setSidebarTab: (tab: LocalMachineState['activeSidebarTab']) => void;
  setTheme: (theme: ThemeId) => void;
  toggleFocusMode: () => void;
  toggleTypewriterMode: () => void;
  setSlashMenuOpen: (open: boolean) => void;
  requestScrollToLine: (line: number | null) => void;
  searchWorkspace: (query: string) => Promise<void>;
  saveImageAsset: (fileName: string, base64Data: string) => Promise<string | null>;
  exportHtml: (renderedHtml: string) => Promise<void>;
  applyRecoverySnapshot: () => void;
  dismissRecoverySnapshot: () => void;
  resolveExternalConflict: (action: 'reload' | 'keep') => Promise<void>;
  notify: (message: string) => void;
  checkForUpdates: (options?: { silent?: boolean }) => Promise<void>;
  installAvailableUpdate: () => Promise<void>;
  skipAvailableUpdate: () => void;
  setUpdateModalOpen: (open: boolean) => void;
  dismissUpdateBanner: () => void;
  toggleAutoCheckUpdates: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  platform: detectPlatform(),
  workspace: null,
  tree: [],
  session: null,
  outline: [],
  richBlocks: [],
  searchQuery: '',
  searchResults: [],
  settings: loadJson(SETTINGS_KEY, DEFAULT_SETTINGS),
  machineState: loadJson(MACHINE_KEY, DEFAULT_MACHINE_STATE),
  focusMode: false,
  typewriterMode: false,
  slashMenuOpen: false,
  pendingScrollLine: null,
  pendingRecovery: null,
  toastMessage: null,
  isBootstrapped: false,
  appVersion: '0.1.0',
  updateStatus: 'idle',
  availableUpdate: null,
  updateProgress: { downloadedBytes: 0, percent: 0 },
  updateError: null,
  updateModalOpen: false,
  updateBannerDismissed: false,

  notify(message: string) {
    set({ toastMessage: message });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
    }, 2400);
  },

  async bootstrap() {
    if (get().isBootstrapped) return;
    const platform = detectPlatform();
    const isPhone = platform === 'ios';
    const settings = get().settings;
    const machine = {
      ...get().machineState,
      sidebarVisible: isPhone ? false : get().machineState.sidebarVisible,
    };

    try {
      const [ws, appVersion] = await Promise.all([
        storageAdapter.getDefaultWorkspace(),
        getAppVersion(),
      ]);
      const tree = await storageAdapter.listTree(ws.rootUri);
      set({
        platform,
        workspace: ws,
        tree,
        machineState: machine,
        focusMode: settings.focusModeDefault,
        typewriterMode: settings.typewriterModeDefault,
        appVersion,
        isBootstrapped: true,
      });

      const firstFile = findFirstMarkdown(tree);
      const targetUri = machine.activeDocUri && hasUri(tree, machine.activeDocUri)
        ? machine.activeDocUri
        : firstFile?.uri;
      if (targetUri) {
        await get().openDocument(targetUri);
      }
    } catch (err) {
      set({ isBootstrapped: true });
      get().notify(`初始化工作区失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },

  async openWorkspace() {
    try {
      const ws = await storageAdapter.openWorkspaceDialog();
      if (!ws) return;
      const tree = await storageAdapter.listTree(ws.rootUri);
      set({ workspace: ws, tree, searchResults: [] });
      const firstFile = findFirstMarkdown(tree);
      if (firstFile) {
        await get().openDocument(firstFile.uri);
      } else {
        set({ session: null, outline: [], richBlocks: [] });
      }
      get().notify(`已打开工作区：${ws.name}`);
    } catch (err) {
      get().notify(`打开工作区失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },

  async refreshTree() {
    const ws = get().workspace;
    if (!ws) return;
    const tree = await storageAdapter.listTree(ws.rootUri);
    set({ tree });
  },

  async openDocument(uri: string, targetLine?: number) {
    const prev = get().session;
    if (prev && prev.isDirty && prev.uri !== uri) {
      await get().saveDocument(true);
    }

    try {
      const payload = await storageAdapter.readDoc(uri);
      const { frontmatterRaw, body } = extractFrontmatter(payload.content);
      const viewMode: ViewMode = payload.isLargeFile ? 'source' : 'wysiwyg';

      const session: DocumentSession = {
        docId: makeDocId(payload.uri),
        uri: payload.uri,
        fileName: payload.fileName,
        diskHash: payload.diskHash,
        savedContent: payload.content,
        currentContent: payload.content,
        isDirty: false,
        syncConflict: 'none',
        eol: payload.eol,
        encoding: payload.encoding,
        frontmatterRaw,
        viewMode,
        cursorAnchor: {
          pmPos: 0,
          line: targetLine ?? 1,
          column: 1,
          blockIndex: 0,
          scrollTopRatio: 0,
        },
        stats: computeDocumentStats(body),
        lastSavedAt: Date.now(),
        isLargeFile: payload.isLargeFile,
      };

      const snapshot = getRecoverySnapshot(payload.uri);
      const pendingRecovery =
        snapshot &&
        snapshot.baseDiskHash === payload.diskHash &&
        snapshot.draftContent !== payload.content
          ? snapshot
          : null;

      const nextMachine: LocalMachineState = {
        ...get().machineState,
        activeDocUri: payload.uri,
      };
      localStorage.setItem(MACHINE_KEY, JSON.stringify(nextMachine));

      set({
        session,
        outline: extractOutline(body),
        richBlocks: extractRichBlocks(body),
        machineState: nextMachine,
        pendingRecovery,
        pendingScrollLine: targetLine ?? null,
      });

      if (payload.isLargeFile) {
        get().notify('文件超过 5 MB，已自动切换至高性能源码模式');
      }
    } catch (err) {
      get().notify(`读取文件失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },

  updateBodyContent(bodyMarkdown: string) {
    const { session, settings } = get();
    if (!session) return;
    const normalizedBody = normalizeToLf(bodyMarkdown);
    const full = combineFrontmatter(session.frontmatterRaw, normalizedBody, session.eol);
    if (full === session.currentContent) return;

    const isDirty = full !== session.savedContent;
    const updated: DocumentSession = {
      ...session,
      currentContent: full,
      isDirty,
      stats: computeDocumentStats(normalizedBody),
    };

    set({
      session: updated,
      outline: extractOutline(normalizedBody),
      richBlocks: extractRichBlocks(normalizedBody),
    });

    scheduleDraftAndAutoSave(updated, settings, () => {
      void get().saveDocument(false);
    });
  },

  updateFullContent(fullMarkdown: string) {
    const { session, settings } = get();
    if (!session) return;
    const full = applyLineEnding(fullMarkdown, session.eol);
    const { frontmatterRaw, body } = extractFrontmatter(full);
    const isDirty = full !== session.savedContent;

    const updated: DocumentSession = {
      ...session,
      frontmatterRaw,
      currentContent: full,
      isDirty,
      stats: computeDocumentStats(body),
    };

    set({
      session: updated,
      outline: extractOutline(body),
      richBlocks: extractRichBlocks(body),
    });

    scheduleDraftAndAutoSave(updated, settings, () => {
      void get().saveDocument(false);
    });
  },

  updateFrontmatter(frontmatterRaw: string) {
    const { session, settings } = get();
    if (!session) return;
    const { body } = extractFrontmatter(session.currentContent);
    const full = combineFrontmatter(frontmatterRaw, body, session.eol);
    const isDirty = full !== session.savedContent;

    const updated: DocumentSession = {
      ...session,
      frontmatterRaw,
      currentContent: full,
      isDirty,
    };

    set({ session: updated });
    scheduleDraftAndAutoSave(updated, settings, () => {
      void get().saveDocument(false);
    });
  },

  async saveDocument(force = true) {
    const session = get().session;
    if (!session) return;
    if (!force && !session.isDirty) return;

    try {
      const result = await storageAdapter.writeDocAtomic({
        uri: session.uri,
        content: session.currentContent,
        expectedHash: session.diskHash,
      });
      clearRecoverySnapshot(session.uri);
      set((state) => ({
        session:
          state.session && state.session.uri === session.uri
            ? {
                ...state.session,
                diskHash: result.diskHash,
                savedContent: state.session.currentContent,
                isDirty: false,
                syncConflict: 'none',
                lastSavedAt: result.savedAt,
              }
            : state.session,
      }));
      if (force) {
        get().notify(`已保存：${session.fileName}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('CONFLICT')) {
        set((state) => ({
          session: state.session
            ? { ...state.session, syncConflict: 'external_modified' }
            : null,
        }));
        get().notify('检测到文件在外部被修改，请先处理冲突');
      } else {
        get().notify(`保存失败：${message}`);
      }
    }
  },

  async createDocument(fileName: string) {
    const ws = get().workspace;
    if (!ws || !fileName.trim()) return;
    try {
      const created = await storageAdapter.createDoc(ws.rootUri, fileName.trim());
      await get().refreshTree();
      await get().openDocument(created.uri);
      get().notify(`已创建：${created.name}`);
    } catch (err) {
      get().notify(`新建失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },

  async renameNode(uri: string, newName: string) {
    if (!newName.trim()) return;
    try {
      const renamed = await storageAdapter.renameNode(uri, newName.trim());
      await get().refreshTree();
      if (get().session?.uri === uri) {
        await get().openDocument(renamed.uri);
      }
      get().notify(`已重命名为：${renamed.name}`);
    } catch (err) {
      get().notify(`重命名失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },

  async deleteNode(uri: string) {
    try {
      await storageAdapter.deleteNode(uri);
      clearRecoverySnapshot(uri);
      await get().refreshTree();
      if (get().session?.uri === uri) {
        const nextFile = findFirstMarkdown(get().tree);
        if (nextFile) {
          await get().openDocument(nextFile.uri);
        } else {
          set({ session: null, outline: [], richBlocks: [] });
        }
      }
      get().notify('已删除文件');
    } catch (err) {
      get().notify(`删除失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },

  toggleViewMode(target?: ViewMode) {
    const session = get().session;
    if (!session) return;
    const nextMode: ViewMode =
      target ?? (session.viewMode === 'wysiwyg' ? 'source' : 'wysiwyg');
    if (nextMode === session.viewMode) return;
    set({
      session: { ...session, viewMode: nextMode },
      slashMenuOpen: false,
    });
    get().notify(nextMode === 'source' ? '已切换至源码视图' : '已切换至所见即所得');
  },

  toggleEol() {
    const session = get().session;
    if (!session) return;
    const nextEol = session.eol === 'LF' ? 'CRLF' : 'LF';
    const nextContent = applyLineEnding(session.currentContent, nextEol);
    set({
      session: {
        ...session,
        eol: nextEol,
        currentContent: nextContent,
        isDirty: nextContent !== session.savedContent,
      },
    });
    get().notify(`换行符已切换为 ${nextEol}`);
  },

  toggleSidebar(visible?: boolean) {
    const nextVisible = visible ?? !get().machineState.sidebarVisible;
    const nextMachine = { ...get().machineState, sidebarVisible: nextVisible };
    localStorage.setItem(MACHINE_KEY, JSON.stringify(nextMachine));
    set({ machineState: nextMachine });
  },

  setSidebarTab(tab) {
    const nextMachine = {
      ...get().machineState,
      sidebarVisible: true,
      activeSidebarTab: tab,
    };
    localStorage.setItem(MACHINE_KEY, JSON.stringify(nextMachine));
    set({ machineState: nextMachine });
  },

  setTheme(theme) {
    const nextSettings = { ...get().settings, theme };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    set({ settings: nextSettings });
  },

  toggleFocusMode() {
    const next = !get().focusMode;
    set({ focusMode: next });
    get().notify(next ? '已开启专注模式' : '已关闭专注模式');
  },

  toggleTypewriterMode() {
    const next = !get().typewriterMode;
    set({ typewriterMode: next });
    get().notify(next ? '已开启打字机模式' : '已关闭打字机模式');
  },

  setSlashMenuOpen(open) {
    set({ slashMenuOpen: open });
  },

  requestScrollToLine(line) {
    set({ pendingScrollLine: line });
  },

  async searchWorkspace(query: string) {
    set({ searchQuery: query });
    const ws = get().workspace;
    if (!ws || !query.trim()) {
      set({ searchResults: [] });
      return;
    }
    const results = await storageAdapter.searchWorkspace(ws.rootUri, query);
    set({ searchResults: results });
  },

  async saveImageAsset(fileName: string, base64Data: string) {
    const { session, settings } = get();
    if (!session) return null;
    try {
      const saved = await storageAdapter.saveImage(
        session.uri,
        session.docId,
        fileName,
        base64Data,
        settings.assetPolicy,
      );
      get().notify(`图片已保存至 ${saved.relativePath}`);
      return saved.relativePath;
    } catch (err) {
      get().notify(`图片保存失败：${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  },

  async exportHtml(renderedHtml: string) {
    const session = get().session;
    if (!session) return;
    try {
      const outPath = await storageAdapter.exportHtml(
        session.fileName,
        renderedHtml,
        'pre { background: #f3f4f6; padding: 14px; border-radius: 8px; overflow-x: auto; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #e5e7eb; padding: 8px 12px; } blockquote { border-left: 3px solid #2563eb; margin: 1em 0; padding: 0.4em 1em; color: #646a73; }',
      );
      get().notify(`已导出 HTML：${outPath}`);
    } catch (err) {
      get().notify(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },

  applyRecoverySnapshot() {
    const { pendingRecovery, session } = get();
    if (!pendingRecovery || !session || pendingRecovery.uri !== session.uri) return;
    get().updateFullContent(pendingRecovery.draftContent);
    set({ pendingRecovery: null });
    get().notify('已恢复上次未保存的草稿');
  },

  dismissRecoverySnapshot() {
    const { pendingRecovery } = get();
    if (pendingRecovery) {
      clearRecoverySnapshot(pendingRecovery.uri);
    }
    set({ pendingRecovery: null });
  },

  async resolveExternalConflict(action: 'reload' | 'keep') {
    const session = get().session;
    if (!session) return;
    if (action === 'reload') {
      clearRecoverySnapshot(session.uri);
      await get().openDocument(session.uri);
      get().notify('已重新加载磁盘最新版本');
    } else {
      const payload = await storageAdapter.readDoc(session.uri);
      set({
        session: {
          ...session,
          diskHash: payload.diskHash,
          syncConflict: 'none',
        },
      });
      await get().saveDocument(true);
    }
  },

  async checkForUpdates(options) {
    const silent = options?.silent ?? false;
    if (!isTauriRuntime) {
      if (!silent) {
        set({
          updateModalOpen: true,
          updateStatus: 'error',
          updateError: '当前处于浏览器预览模式，自动更新仅在桌面端安装包内生效。',
        });
      }
      return;
    }

    set({
      updateStatus: 'checking',
      updateError: null,
      ...(silent ? {} : { updateModalOpen: true }),
    });

    try {
      const res = await checkAppUpdate();
      if (res.status === 'available') {
        pendingUpdateHandle = res.handle;
        const shouldShow = shouldPromptUpdate(
          res.info.version,
          get().settings.skippedUpdateVersion,
        );
        set({
          updateStatus: 'available',
          availableUpdate: res.info,
          updateBannerDismissed: !shouldShow,
          ...(silent ? {} : { updateModalOpen: true }),
        });
      } else {
        pendingUpdateHandle = null;
        set({
          updateStatus: 'up-to-date',
          availableUpdate: null,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (silent) {
        set({ updateStatus: 'idle' });
      } else {
        set({
          updateStatus: 'error',
          updateError: message,
        });
      }
    }
  },

  async installAvailableUpdate() {
    if (!pendingUpdateHandle) {
      await get().checkForUpdates({ silent: false });
      return;
    }
    set({
      updateStatus: 'downloading',
      updateProgress: { downloadedBytes: 0, percent: 0 },
      updateError: null,
    });

    try {
      await installAppUpdate(pendingUpdateHandle, (progress) => {
        set({
          updateStatus: progress.percent >= 100 ? 'installing' : 'downloading',
          updateProgress: progress,
        });
      });
    } catch (err) {
      set({
        updateStatus: 'error',
        updateError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  skipAvailableUpdate() {
    const ver = get().availableUpdate?.version;
    const nextSettings = { ...get().settings, skippedUpdateVersion: ver };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    set({
      settings: nextSettings,
      updateModalOpen: false,
      updateBannerDismissed: true,
    });
    if (ver) {
      get().notify(`已跳过 v${ver} 更新提醒`);
    }
  },

  setUpdateModalOpen(open) {
    set({ updateModalOpen: open });
  },

  dismissUpdateBanner() {
    set({ updateBannerDismissed: true });
  },

  toggleAutoCheckUpdates() {
    const nextSettings = {
      ...get().settings,
      autoCheckUpdates: !get().settings.autoCheckUpdates,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    set({ settings: nextSettings });
  },
}));

function scheduleDraftAndAutoSave(
  session: DocumentSession,
  settings: AppSettings,
  triggerSave: () => void,
): void {
  if (snapshotTimer) clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => {
    if (session.isDirty) {
      saveRecoverySnapshot({
        snapshotId: `snap-${session.docId}`,
        docId: session.docId,
        uri: session.uri,
        baseDiskHash: session.diskHash,
        draftContent: session.currentContent,
        capturedAt: Date.now(),
        appVersion: '0.1.0',
      });
    }
  }, 800);

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  if (settings.autoSaveEnabled && session.isDirty) {
    autoSaveTimer = setTimeout(() => {
      triggerSave();
    }, settings.autoSaveDelayMs);
  }
}

function findFirstMarkdown(nodes: FileNode[]): FileNode | null {
  for (const node of nodes) {
    if (node.kind === 'file' && /\.(md|markdown|mdx)$/i.test(node.name)) {
      return node;
    }
    if (node.children) {
      const found = findFirstMarkdown(node.children);
      if (found) return found;
    }
  }
  return null;
}

function hasUri(nodes: FileNode[], uri: string): boolean {
  for (const node of nodes) {
    if (node.uri === uri) return true;
    if (node.children && hasUri(node.children, uri)) return true;
  }
  return false;
}
