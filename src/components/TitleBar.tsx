import {
  Code2,
  Download,
  Eye,
  Focus,
  FolderOpen,
  Maximize2,
  Minus,
  PanelLeft,
  Plus,
  Save,
  Type,
  X,
} from 'lucide-react';
import type { DocumentSession, PlatformKind, ThemeId, Workspace } from '@/core/models';
import { isApplePlatform } from '@/core/shortcuts/keymap';
import { windowControls } from '@/services/platform';

interface TitleBarProps {
  platform: PlatformKind;
  workspace: Workspace | null;
  session: DocumentSession | null;
  theme: ThemeId;
  focusMode: boolean;
  typewriterMode: boolean;
  onToggleSidebar: () => void;
  onOpenWorkspace: () => void;
  onToggleSlashMenu: () => void;
  onToggleViewMode: () => void;
  onSave: () => void;
  onExportHtml: () => void;
  onToggleFocus: () => void;
  onToggleTypewriter: () => void;
  onChangeTheme: (theme: ThemeId) => void;
}

export function TitleBar({
  platform,
  workspace,
  session,
  theme,
  focusMode,
  typewriterMode,
  onToggleSidebar,
  onOpenWorkspace,
  onToggleSlashMenu,
  onToggleViewMode,
  onSave,
  onExportHtml,
  onToggleFocus,
  onToggleTypewriter,
  onChangeTheme,
}: TitleBarProps) {
  const isApple = isApplePlatform(platform);
  const isWindows = platform === 'windows' || platform === 'web';

  return (
    <header
      data-tauri-drag-region
      className="h-10 shrink-0 px-3 flex items-center justify-between border-b select-none gap-2"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* 左侧：macOS 交通灯避让区 / Windows 应用标志 + 侧栏切换 + 文件标题 */}
      <div className="flex items-center gap-2 min-w-0">
        {platform === 'macos' && (
          <div className="w-[68px] shrink-0" aria-hidden="true" />
        )}

        {!isApple && (
          <div className="hidden sm:flex items-center gap-1.5 pr-1 shrink-0">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-fg)',
              }}
            >
              S
            </span>
            <span className="text-xs font-semibold tracking-tight">ShowWorker</span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:opacity-80 cursor-pointer"
          style={{ color: 'var(--text-muted)' }}
          title="展开/收起侧边栏"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenWorkspace}
          className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-xs hover:opacity-80 cursor-pointer"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-hover)' }}
          title="打开本地文件夹工作区"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="max-w-[120px] truncate">{workspace?.name || '工作区'}</span>
        </button>

        {session && (
          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <span style={{ color: 'var(--text-muted)' }} className="hidden sm:inline">/</span>
            <span className="font-semibold truncate">{session.fileName}</span>
            {session.isDirty && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                title="有未保存更改"
              />
            )}
          </div>
        )}
      </div>

      {/* 右侧：编辑器动作与 Windows 三键 */}
      <div className="flex items-center gap-1 shrink-0">
        {session && (
          <>
            <button
              type="button"
              onClick={onToggleSlashMenu}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border cursor-pointer hover:opacity-85"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
              title="插入块 (/)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>插入</span>
            </button>

            <button
              type="button"
              onClick={onToggleFocus}
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer"
              style={
                focusMode
                  ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent-primary)' }
                  : { color: 'var(--text-muted)' }
              }
              title="专注模式"
            >
              <Focus className="w-3.5 h-3.5" />
              <span>专注</span>
            </button>

            <button
              type="button"
              onClick={onToggleTypewriter}
              className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer"
              style={
                typewriterMode
                  ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent-primary)' }
                  : { color: 'var(--text-muted)' }
              }
              title="打字机居中滚动"
            >
              <Type className="w-3.5 h-3.5" />
              <span>打字机</span>
            </button>

            <button
              type="button"
              onClick={onToggleViewMode}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-code)',
                color: 'var(--text-primary)',
              }}
              title="切换所见即所得 / 源码模式"
            >
              {session.viewMode === 'wysiwyg' ? (
                <>
                  <Code2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">源码</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">预览</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onExportHtml}
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              title="导出 HTML"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onSave}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-fg)',
              }}
              title="保存文件"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">保存</span>
            </button>
          </>
        )}

        <select
          value={theme}
          onChange={(e) => onChangeTheme(e.target.value as ThemeId)}
          aria-label="切换主题"
          className="ml-1 px-2 py-1 rounded-md text-xs border focus:outline-none cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <option value="paper-light">纸感浅</option>
          <option value="warm-sepia">羊皮纸</option>
          <option value="night-slate">深夜黑</option>
          <option value="system">跟随系统</option>
        </select>

        {isWindows && (
          <div
            className="hidden md:flex items-center ml-1 pl-2 border-l"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            <button
              type="button"
              onClick={() => void windowControls.minimize()}
              className="w-8 h-7 flex items-center justify-center rounded hover:opacity-80 cursor-pointer"
              title="最小化"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void windowControls.toggleMaximize()}
              className="w-8 h-7 flex items-center justify-center rounded hover:opacity-80 cursor-pointer"
              title="最大化 / 还原"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void windowControls.close()}
              className="w-8 h-7 flex items-center justify-center rounded hover:text-red-500 cursor-pointer"
              title="关闭"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
