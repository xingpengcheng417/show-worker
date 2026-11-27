import type {
  AssetPolicy,
  FileNode,
  LineEnding,
  SearchHit,
  Workspace,
} from '@/core/models';

export interface DocReadPayload {
  uri: string;
  fileName: string;
  content: string;
  diskHash: string;
  eol: LineEnding;
  encoding: 'UTF-8' | 'UTF-8-BOM';
  isLargeFile: boolean;
}

export interface WriteDocPayload {
  uri: string;
  content: string;
  expectedHash?: string;
}

export interface WriteDocResult {
  diskHash: string;
  savedAt: number;
}

export interface SavedAssetResult {
  relativePath: string;
  displayUrl: string;
}

export interface StorageAdapter {
  readonly isNative: boolean;
  getDefaultWorkspace(): Promise<Workspace>;
  openWorkspaceDialog(): Promise<Workspace | null>;
  listTree(rootUri: string): Promise<FileNode[]>;
  readDoc(uri: string): Promise<DocReadPayload>;
  writeDocAtomic(payload: WriteDocPayload): Promise<WriteDocResult>;
  createDoc(parentDirUri: string, fileName: string, initialContent?: string): Promise<FileNode>;
  deleteNode(uri: string): Promise<void>;
  renameNode(uri: string, newName: string): Promise<FileNode>;
  saveImage(
    docUri: string,
    docId: string,
    fileName: string,
    base64Data: string,
    policy: AssetPolicy,
  ): Promise<SavedAssetResult>;
  resolveAssetUrl(docId: string, relativePath: string): string;
  searchWorkspace(rootUri: string, query: string): Promise<SearchHit[]>;
  exportHtml(title: string, htmlBody: string, themeCss: string): Promise<string>;
}

export interface WindowControls {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  printPage(): void;
}
