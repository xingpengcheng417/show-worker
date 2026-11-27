import { detectLineEnding, normalizeToLf } from '@/core/markdown/eol';
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

const STORAGE_DOCS_KEY = 'showworker:web-docs:v1';
const STORAGE_ASSETS_KEY = 'showworker:web-assets:v1';

interface VirtualDoc {
  uri: string;
  name: string;
  relativePath: string;
  content: string;
  modifiedAt: number;
}

const DEFAULT_DOCS: VirtualDoc[] = [
  {
    uri: 'web://workspace/架构设计规范.md',
    name: '架构设计规范.md',
    relativePath: '架构设计规范.md',
    modifiedAt: Date.now() - 3600_000,
    content: `---
title: 跨平台 Markdown 编辑器架构
platform: [Windows, macOS, iPadOS, iOS]
version: 0.1.0
---

# ShowWorker · Typora 风格跨平台编辑器

以 **Tauri 2.x** 为容器，结合 **Milkdown** 所见即所得内核与 **CodeMirror 6** 源码视图，实现 Windows 与 macOS 桌面端的原生轻量写作体验，并保持向 iPadOS / iOS 延展的架构弹性。

> 设计原则：日常写作只见纸面与文字，语法符号退场；按下 \`Ctrl+/\`（macOS 为 \`⌘+/\`）即可瞬间切换源码模式。

## 核心特性校验清单

- [x] Milkdown 实时所见即所得与 InputRules 瞬时转换
- [x] YAML Frontmatter 隔离卡片与换行符无损往返
- [x] 表格上下文增删行列工具条与划词浮窗
- [ ] 在本地安装 Rust 与 MSVC 工具链后启动 \`npm run tauri dev\`

## 四端平台适配矩阵

| 平台 | 窗口壳层 | 存储适配器 | 状态 |
| :--- | :--- | :--- | :---: |
| macOS | 交通灯 Overlay 避让 | DesktopFsAdapter | 已就绪 |
| Windows 11 | 自绘无边框 + Snap | DesktopFsAdapter | 已就绪 |
| iPadOS / iOS | 抽屉侧栏 + 符号条 | Swift Bookmark | 预留接口 |

## 数学公式与架构图实时渲染

$$
E = mc^2 + \\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

\`\`\`mermaid
flowchart LR
  User["用户输入"] --> Core["Editor Core"]
  Core --> Draft["崩溃恢复快照"]
  Core --> Disk["Rust 原子写入"]
\`\`\`

\`\`\`typescript
export interface DocumentSession {
  docId: string;
  eol: 'LF' | 'CRLF';
  isDirty: boolean;
  viewMode: 'wysiwyg' | 'source';
}
\`\`\`
`,
  },
  {
    uri: 'web://workspace/产品原型清单.md',
    name: '产品原型清单.md',
    relativePath: '产品原型清单.md',
    modifiedAt: Date.now() - 1800_000,
    content: `---
title: MVP 产品验证清单
owner: ShowWorker
---

# MVP 产品原型验收清单

本篇用于核对一期落地交互细节，重点保障中文输入法（IME）兼容与双端热键习惯一致。

## 输入法与快捷键校验

- [x] 监听 \`compositionstart\` / \`compositionend\`，避免拼音选词期误触发转换
- [x] 抽象 \`Mod\` 键：macOS 映射 \`⌘\`，Windows 映射 \`Ctrl\`
- [x] 粘贴图片自动落盘并插入 POSIX 正斜杠相对路径

| 文档规模 | 渲染策略 | 目标帧率 |
| :--- | :--- | ---: |
| 1,000 行 | WYSIWYG 全量渲染 | 60 fps |
| 5,000 行 | 局部事务更新 | 60 fps |
| 大于 5 MB | 自动切换源码视图 | 60 fps |
`,
  },
  {
    uri: 'web://workspace/双端兼容笔记.md',
    name: '双端兼容笔记.md',
    relativePath: '双端兼容笔记.md',
    modifiedAt: Date.now() - 600_000,
    content: [
      '---',
      'title: Windows 与 Apple 生态兼容备忘',
      'eol_policy: preserve',
      '---',
      '',
      '# Windows 与 macOS 兼容关键规范',
      '',
      '即使在 Windows 上创建并编辑文档，写入 Markdown 的图片相对路径也必须统一使用正斜杠 `/`，防止 macOS 与 iOS 打开后图片失效。',
      '',
      '```rust',
      'let normalized = rel_path.replace("\\\\", "/");',
      'assert!(!normalized.contains("\\\\"));',
      '```',
      '',
      '> 提示：本文件默认保留为 `CRLF` 换行符，你可以在右下角状态栏点击切换 `LF` / `CRLF`。',
    ].join('\r\n'),
  },
];

function simpleHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}

function loadVirtualDocs(): VirtualDoc[] {
  try {
    const raw = localStorage.getItem(STORAGE_DOCS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as VirtualDoc[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted localStorage
  }
  localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(DEFAULT_DOCS));
  return DEFAULT_DOCS.map((d) => ({ ...d }));
}

function saveVirtualDocs(docs: VirtualDoc[]): void {
  localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(docs));
}

function loadVirtualAssets(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_ASSETS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export const webStorageAdapter: StorageAdapter = {
  isNative: false,

  async getDefaultWorkspace(): Promise<Workspace> {
    return {
      id: 'ws-web-demo',
      name: 'show-worker (演示工作区)',
      rootUri: 'web://workspace',
      platformOrigin: 'web_mock',
      expandedDirs: [],
      lastOpenedAt: Date.now(),
    };
  },

  async openWorkspaceDialog(): Promise<Workspace | null> {
    return this.getDefaultWorkspace();
  },

  async takePendingOpenFile(): Promise<string | null> {
    return null;
  },

  async openFileContext(filePath: string): Promise<OpenFileContextResult> {
    const workspace = await this.getDefaultWorkspace();
    return { workspace, fileUri: filePath };
  },

  async listTree(): Promise<FileNode[]> {
    const docs = loadVirtualDocs();
    return docs.map((d) => ({
      id: d.uri,
      name: d.name,
      relativePath: d.relativePath,
      uri: d.uri,
      kind: 'file',
      ext: 'md',
      sizeBytes: d.content.length,
      modifiedAt: d.modifiedAt,
    }));
  },

  async readDoc(uri: string): Promise<DocReadPayload> {
    const docs = loadVirtualDocs();
    const doc = docs.find((d) => d.uri === uri) ?? docs[0];
    return {
      uri: doc.uri,
      fileName: doc.name,
      content: doc.content,
      diskHash: simpleHash(doc.content),
      eol: detectLineEnding(doc.content),
      encoding: 'UTF-8',
      isLargeFile: doc.content.length > 5 * 1024 * 1024,
    };
  },

  async writeDocAtomic(payload: WriteDocPayload): Promise<WriteDocResult> {
    const docs = loadVirtualDocs();
    const idx = docs.findIndex((d) => d.uri === payload.uri);
    const now = Date.now();
    if (idx >= 0) {
      docs[idx] = {
        ...docs[idx],
        content: payload.content,
        modifiedAt: now,
      };
    } else {
      const name = payload.uri.split('/').pop() || '未命名.md';
      docs.push({
        uri: payload.uri,
        name,
        relativePath: name,
        content: payload.content,
        modifiedAt: now,
      });
    }
    saveVirtualDocs(docs);
    return {
      diskHash: simpleHash(payload.content),
      savedAt: now,
    };
  },

  async createDoc(
    parentDirUri: string,
    fileName: string,
    initialContent = '',
  ): Promise<FileNode> {
    const normalizedName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    const docs = loadVirtualDocs();
    const uri = `${parentDirUri.replace(/\/$/, '')}/${normalizedName}`;
    if (docs.some((d) => d.uri === uri)) {
      throw new Error(`文件 ${normalizedName} 已存在`);
    }
    const now = Date.now();
    const content =
      initialContent || `# ${normalizedName.replace(/\.md$/i, '')}\n\n开始写作...\n`;
    docs.unshift({
      uri,
      name: normalizedName,
      relativePath: normalizedName,
      content,
      modifiedAt: now,
    });
    saveVirtualDocs(docs);
    return {
      id: uri,
      name: normalizedName,
      relativePath: normalizedName,
      uri,
      kind: 'file',
      ext: 'md',
      sizeBytes: content.length,
      modifiedAt: now,
    };
  },

  async deleteNode(uri: string): Promise<void> {
    const docs = loadVirtualDocs().filter((d) => d.uri !== uri);
    saveVirtualDocs(docs);
  },

  async renameNode(uri: string, newName: string): Promise<FileNode> {
    const normalizedName = newName.endsWith('.md') ? newName : `${newName}.md`;
    const docs = loadVirtualDocs();
    const target = docs.find((d) => d.uri === uri);
    if (!target) {
      throw new Error('目标文件不存在');
    }
    const parent = uri.slice(0, uri.lastIndexOf('/'));
    const newUri = `${parent}/${normalizedName}`;
    target.uri = newUri;
    target.name = normalizedName;
    target.relativePath = normalizedName;
    target.modifiedAt = Date.now();
    saveVirtualDocs(docs);
    return {
      id: newUri,
      name: normalizedName,
      relativePath: normalizedName,
      uri: newUri,
      kind: 'file',
      ext: 'md',
      sizeBytes: target.content.length,
      modifiedAt: target.modifiedAt,
    };
  },

  async saveImage(
    _docUri: string,
    _docId: string,
    fileName: string,
    base64Data: string,
    policy: AssetPolicy,
  ): Promise<SavedAssetResult> {
    const safeName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    const rel = formatPosixRelativePath(`./assets/${safeName}`, policy.encodeWhitespace);
    const dataUrl = base64Data.startsWith('data:')
      ? base64Data
      : `data:image/png;base64,${base64Data}`;
    const assets = loadVirtualAssets();
    assets[rel] = dataUrl;
    localStorage.setItem(STORAGE_ASSETS_KEY, JSON.stringify(assets));
    return {
      relativePath: rel,
      displayUrl: dataUrl,
    };
  },

  resolveAssetUrl(_docId: string, relativePath: string): string {
    if (/^(https?:|data:)/i.test(relativePath)) {
      return relativePath;
    }
    const assets = loadVirtualAssets();
    return assets[relativePath] || relativePath;
  },

  async searchWorkspace(_rootUri: string, query: string): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }
    const docs = loadVirtualDocs();
    const hits: SearchHit[] = [];

    for (const doc of docs) {
      const lines = normalizeToLf(doc.content).split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const idx = lines[i].toLowerCase().indexOf(q);
        if (idx >= 0) {
          hits.push({
            uri: doc.uri,
            relativePath: doc.relativePath,
            fileName: doc.name,
            line: i + 1,
            column: idx + 1,
            matchLength: q.length,
            linePreview: lines[i].trim().slice(0, 120),
          });
        }
      }
    }
    return hits.slice(0, 80);
  },

  async exportHtml(title: string, htmlBody: string, themeCss: string): Promise<string> {
    const docHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { max-width: 820px; margin: 40px auto; padding: 0 24px; font-family: -apple-system, "PingFang SC", "Segoe UI", sans-serif; line-height: 1.75; color: #1f2329; }
    ${themeCss}
  </style>
</head>
<body>${htmlBody}</body>
</html>`;
    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\.md$/i, '')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    return a.download;
  },
};

export const webWindowControls: WindowControls = {
  async minimize() {
    // 浏览器预览环境空操作
  },
  async toggleMaximize() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.().catch(() => undefined);
    } else {
      await document.exitFullscreen?.().catch(() => undefined);
    }
  },
  async close() {
    // 浏览器预览环境空操作
  },
  printPage() {
    window.print();
  },
};
