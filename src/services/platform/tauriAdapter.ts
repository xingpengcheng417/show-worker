import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/plugin-dialog';
import { formatPosixRelativePath } from '@/core/markdown/outline';
import type { AssetPolicy, FileNode, SearchHit, Workspace } from '@/core/models';
import type {
  DocReadPayload,
  OpenFileContextResult,
  SavedAssetResult,
  StorageAdapter,
  WindowControls,
  WriteDocPayload,
  WriteDocResult,
} from './storageAdapter';

export const tauriStorageAdapter: StorageAdapter = {
  isNative: true,

  async getDefaultWorkspace(): Promise<Workspace> {
    return invoke<Workspace>('workspace_default');
  },

  async openWorkspaceDialog(): Promise<Workspace | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择 Markdown 工作区文件夹',
    });
    if (!selected || Array.isArray(selected)) {
      return null;
    }
    return invoke<Workspace>('workspace_open', { path: selected });
  },

  async takePendingOpenFile(): Promise<string | null> {
    return invoke<string | null>('take_pending_open_file');
  },

  async openFileContext(filePath: string): Promise<OpenFileContextResult> {
    return invoke<OpenFileContextResult>('open_file_context', { filePath });
  },

  async listTree(rootUri: string): Promise<FileNode[]> {
    return invoke<FileNode[]>('fs_list_tree', { rootUri });
  },

  async readDoc(uri: string): Promise<DocReadPayload> {
    return invoke<DocReadPayload>('doc_read', { uri });
  },

  async writeDocAtomic(payload: WriteDocPayload): Promise<WriteDocResult> {
    return invoke<WriteDocResult>('doc_write_atomic', { payload });
  },

  async createDoc(
    parentDirUri: string,
    fileName: string,
    initialContent = '',
  ): Promise<FileNode> {
    return invoke<FileNode>('doc_create', {
      parentDirUri,
      fileName,
      initialContent,
    });
  },

  async deleteNode(uri: string): Promise<void> {
    await invoke<void>('fs_delete', { uri });
  },

  async renameNode(uri: string, newName: string): Promise<FileNode> {
    return invoke<FileNode>('fs_rename', { uri, newName });
  },

  async saveImage(
    docUri: string,
    docId: string,
    fileName: string,
    base64Data: string,
    policy: AssetPolicy,
  ): Promise<SavedAssetResult> {
    const relativePath = await invoke<string>('asset_save_image', {
      docUri,
      fileName,
      base64Data,
      policy,
    });
    const posix = formatPosixRelativePath(relativePath, policy.encodeWhitespace);
    return {
      relativePath: posix,
      displayUrl: this.resolveAssetUrl(docId, posix),
    };
  },

  resolveAssetUrl(docId: string, relativePath: string): string {
    if (/^(https?:|data:|md-asset:)/i.test(relativePath)) {
      return relativePath;
    }
    const cleanRel = formatPosixRelativePath(relativePath, false)
      .split('/')
      .filter((seg) => seg && seg !== '.')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return `md-asset://localhost/${encodeURIComponent(docId)}/${cleanRel}`;
  },

  async searchWorkspace(rootUri: string, query: string): Promise<SearchHit[]> {
    return invoke<SearchHit[]>('search_workspace', { rootUri, query });
  },

  async exportHtml(title: string, htmlBody: string, themeCss: string): Promise<string> {
    return invoke<string>('doc_export_html', { title, htmlBody, themeCss });
  },
};

export const tauriWindowControls: WindowControls = {
  async minimize() {
    await getCurrentWindow().minimize();
  },
  async toggleMaximize() {
    await getCurrentWindow().toggleMaximize();
  },
  async close() {
    await getCurrentWindow().close();
  },
  printPage() {
    window.print();
  },
};
