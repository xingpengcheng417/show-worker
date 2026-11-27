import type { DocumentSession, PlatformKind, UpdateInfo, UpdateStatus } from '@/core/models';
import { formatShortcut } from '@/core/shortcuts/keymap';

interface StatusBarProps {
  session: DocumentSession | null;
  platform: PlatformKind;
  appVersion: string;
  updateStatus: UpdateStatus;
  availableUpdate: UpdateInfo | null;
  onSave: () => void;
  onToggleEol: () => void;
  onOpenUpdateModal: () => void;
}

export function StatusBar({
  session,
  platform,
  appVersion,
  updateStatus,
  availableUpdate,
  onSave,
  onToggleEol,
  onOpenUpdateModal,
}: StatusBarProps) {
  const renderUpdateButton = () => (
    <button
      type="button"
      onClick={onOpenUpdateModal}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:opacity-85 cursor-pointer font-editor-mono"
      style={{
        backgroundColor: availableUpdate ? 'var(--accent-soft)' : 'var(--bg-code)',
        color: availableUpdate ? 'var(--accent-primary)' : 'var(--text-muted)',
      }}
      title="检查版本更新"
    >
      {availableUpdate && (
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        />
      )}
      <span>
        {availableUpdate
          ? `新版本 v${availableUpdate.version}`
          : updateStatus === 'checking'
            ? '检查更新中...'
            : `v${appVersion} · 检查更新`}
      </span>
    </button>
  );

  if (!session) {
    return (
      <footer
        className="h-8 px-3 shrink-0 flex items-center justify-between text-xs border-t select-none"
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-muted)',
        }}
      >
        <span>就绪 · 请在左侧选择或新建 Markdown 文档</span>
        <div className="flex items-center gap-3">
          {renderUpdateButton()}
          <span className="font-editor-mono">UTF-8</span>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className="h-8 px-3 shrink-0 flex items-center justify-between text-xs border-t select-none"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--text-muted)',
      }}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1.5 hover:opacity-80 cursor-pointer"
          title="点击立即保存"
        >
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: session.isDirty ? '#f59e0b' : '#22c55e' }}
          />
          <span>{session.isDirty ? '未保存' : '已保存'}</span>
        </button>

        <span>
          {session.stats.words} 词 · {session.stats.chars} 字符 · 约 {session.stats.readingMinutes} 分钟
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleEol}
          className="px-1.5 py-0.5 rounded font-editor-mono hover:opacity-80 cursor-pointer"
          style={{ backgroundColor: 'var(--bg-code)' }}
          title="点击切换换行符 (LF / CRLF)"
        >
          {session.eol}
        </button>
        <span className="font-editor-mono">{session.encoding}</span>
        <span className="hidden sm:inline font-editor-mono">
          {session.viewMode === 'wysiwyg' ? 'WYSIWYG' : 'SOURCE'} · {formatShortcut('Mod+/', platform)}
        </span>
        {renderUpdateButton()}
      </div>
    </footer>
  );
}
