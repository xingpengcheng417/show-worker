import type { DocumentSession, PlatformKind } from '@/core/models';
import { formatShortcut } from '@/core/shortcuts/keymap';

interface StatusBarProps {
  session: DocumentSession | null;
  platform: PlatformKind;
  onSave: () => void;
  onToggleEol: () => void;
}

export function StatusBar({ session, platform, onSave, onToggleEol }: StatusBarProps) {
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
        <span className="font-editor-mono">UTF-8</span>
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
      </div>
    </footer>
  );
}
