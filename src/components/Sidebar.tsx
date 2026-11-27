import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder,
  ListTree,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  FileNode,
  LocalMachineState,
  OutlineNode,
  SearchHit,
} from '@/core/models';

interface SidebarProps {
  visible: boolean;
  activeTab: LocalMachineState['activeSidebarTab'];
  tree: FileNode[];
  activeDocUri?: string;
  activeDocDirty: boolean;
  outline: OutlineNode[];
  searchQuery: string;
  searchResults: SearchHit[];
  onCloseMobile: () => void;
  onChangeTab: (tab: LocalMachineState['activeSidebarTab']) => void;
  onSelectFile: (uri: string, line?: number) => void;
  onCreateFile: (name: string) => void;
  onRenameFile: (uri: string, newName: string) => void;
  onDeleteFile: (uri: string) => void;
  onSelectOutline: (line: number) => void;
  onSearch: (query: string) => void;
}

export function Sidebar({
  visible,
  activeTab,
  tree,
  activeDocUri,
  activeDocDirty,
  outline,
  searchQuery,
  searchResults,
  onCloseMobile,
  onChangeTab,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onSelectOutline,
  onSearch,
}: SidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingUri, setRenamingUri] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});

  if (!visible) {
    return null;
  }

  const toggleDir = (uri: string) => {
    setExpandedDirs((prev) => ({ ...prev, [uri]: !(prev[uri] ?? true) }));
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreateFile(newName.trim());
    setNewName('');
    setCreating(false);
  };

  const renderTreeNodes = (nodes: FileNode[], depth = 0) =>
    nodes.map((node) => {
      if (node.kind === 'directory') {
        const isOpen = expandedDirs[node.uri] ?? true;
        return (
          <div key={node.uri}>
            <button
              type="button"
              onClick={() => toggleDir(node.uri)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-left cursor-pointer hover:opacity-85"
              style={{ paddingLeft: `${8 + depth * 12}px`, color: 'var(--text-muted)' }}
            >
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
              <Folder className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {isOpen && node.children && <div>{renderTreeNodes(node.children, depth + 1)}</div>}
          </div>
        );
      }

      const isActive = node.uri === activeDocUri;
      const isEditing = renamingUri === node.uri;

      if (isEditing) {
        return (
          <form
            key={node.uri}
            onSubmit={(e) => {
              e.preventDefault();
              onRenameFile(node.uri, renameText);
              setRenamingUri(null);
            }}
            className="px-2 py-1"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
          >
            <input
              autoFocus
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onBlur={() => setRenamingUri(null)}
              className="w-full px-2 py-1 rounded border text-xs focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                borderColor: 'var(--accent-primary)',
              }}
            />
          </form>
        );
      }

      return (
        <div
          key={node.uri}
          className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs cursor-pointer"
          style={{
            paddingLeft: `${10 + depth * 12}px`,
            backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: isActive ? 600 : 400,
          }}
          onClick={() => {
            onSelectFile(node.uri);
            onCloseMobile();
          }}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate flex-1">{node.name}</span>
          {isActive && activeDocDirty && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--accent-primary)' }}
            />
          )}
          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingUri(node.uri);
                setRenameText(node.name);
              }}
              className="p-0.5 rounded hover:opacity-80"
              title="重命名"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(node.uri);
              }}
              className="p-0.5 rounded hover:text-red-500"
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    });

  return (
    <>
      <div
        onClick={onCloseMobile}
        className="md:hidden fixed inset-0 bg-black/40 z-20"
      />
      <aside
        className="fixed md:static inset-y-0 left-0 z-30 w-64 shrink-0 flex flex-col border-r"
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {/* 侧栏标签页 */}
        <div
          className="grid grid-cols-3 p-1.5 gap-1 border-b shrink-0 text-xs"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={() => onChangeTab('files')}
            className="flex items-center justify-center gap-1 py-1.5 rounded-md font-medium cursor-pointer"
            style={
              activeTab === 'files'
                ? { backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }
                : { color: 'var(--text-muted)' }
            }
          >
            <Folder className="w-3.5 h-3.5" />
            <span>文件</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('toc')}
            className="flex items-center justify-center gap-1 py-1.5 rounded-md font-medium cursor-pointer"
            style={
              activeTab === 'toc'
                ? { backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }
                : { color: 'var(--text-muted)' }
            }
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>大纲</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('search')}
            className="flex items-center justify-center gap-1 py-1.5 rounded-md font-medium cursor-pointer"
            style={
              activeTab === 'search'
                ? { backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }
                : { color: 'var(--text-muted)' }
            }
          >
            <Search className="w-3.5 h-3.5" />
            <span>搜索</span>
          </button>
        </div>

        {/* 面板内容 */}
        {activeTab === 'files' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-3 py-2 flex items-center justify-between text-xs">
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                Markdown 文档
              </span>
              <button
                type="button"
                onClick={() => setCreating((v) => !v)}
                className="p-1 rounded hover:opacity-80 cursor-pointer"
                style={{ color: 'var(--accent-primary)' }}
                title="新建 Markdown 文档"
              >
                <FilePlus2 className="w-4 h-4" />
              </button>
            </div>

            {creating && (
              <form onSubmit={handleCreateSubmit} className="px-2.5 pb-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="输入文件名，例如 随笔.md"
                  className="w-full px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    color: 'var(--text-primary)',
                    borderColor: 'var(--accent-primary)',
                  }}
                />
              </form>
            )}

            <div className="flex-1 overflow-y-auto thin-scroll px-2 pb-4 space-y-0.5">
              {tree.length === 0 ? (
                <div className="px-2 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  工作区暂无 Markdown 文件
                </div>
              ) : (
                renderTreeNodes(tree)
              )}
            </div>
          </div>
        )}

        {activeTab === 'toc' && (
          <div className="flex-1 overflow-y-auto thin-scroll p-2.5 space-y-0.5 text-xs">
            {outline.length === 0 ? (
              <div className="px-2 py-3" style={{ color: 'var(--text-muted)' }}>
                当前文档暂无标题
              </div>
            ) : (
              outline.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectOutline(item.line);
                    onCloseMobile();
                  }}
                  className="w-full text-left py-1.5 pr-2 rounded-md truncate cursor-pointer hover:opacity-85"
                  style={{
                    paddingLeft: `${8 + (item.level - 1) * 12}px`,
                    color: item.level === 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: item.level === 1 ? 600 : 400,
                  }}
                  title={`第 ${item.line} 行`}
                >
                  {item.text}
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="flex-1 flex flex-col min-h-0 p-2.5 gap-2 text-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="全文检索工作区内容..."
              className="w-full px-2.5 py-1.5 rounded-lg border focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-subtle)',
              }}
            />

            <div className="flex-1 overflow-y-auto thin-scroll space-y-1.5">
              {!searchQuery.trim() ? (
                <div className="px-1 py-2" style={{ color: 'var(--text-muted)' }}>
                  输入关键词搜索所有 Markdown 文件
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-1 py-2" style={{ color: 'var(--text-muted)' }}>
                  未找到匹配项
                </div>
              ) : (
                searchResults.map((hit, idx) => (
                  <button
                    key={`${hit.uri}-${hit.line}-${idx}`}
                    type="button"
                    onClick={() => {
                      onSelectFile(hit.uri, hit.line);
                      onCloseMobile();
                    }}
                    className="w-full text-left p-2 rounded-lg border cursor-pointer hover:opacity-85"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="font-semibold truncate"
                        style={{ color: 'var(--accent-primary)' }}
                      >
                        {hit.fileName}
                      </span>
                      <span className="font-editor-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                        :{hit.line}
                      </span>
                    </div>
                    <div className="mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                      {hit.linePreview}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
