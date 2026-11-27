import type { ViewMode } from '@/core/models';

export type QuickActionType =
  | 'h2'
  | 'bold'
  | 'code'
  | 'task'
  | 'table'
  | 'math'
  | 'toggleSource';

interface MobileToolbarProps {
  viewMode: ViewMode;
  onAction: (action: QuickActionType) => void;
}

export function MobileToolbar({ viewMode, onAction }: MobileToolbarProps) {
  const buttons: { label: string; action: QuickActionType; primary?: boolean }[] = [
    { label: '##', action: 'h2' },
    { label: '**', action: 'bold' },
    { label: '`代码`', action: 'code' },
    { label: '- [ ]', action: 'task' },
    { label: '表格', action: 'table' },
    { label: '$$', action: 'math' },
    { label: viewMode === 'wysiwyg' ? '源码' : '预览', action: 'toggleSource', primary: true },
  ];

  return (
    <footer
      className="md:hidden shrink-0 px-2 py-2 border-t flex items-center gap-1.5 overflow-x-auto thin-scroll text-xs"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      {buttons.map((b) => (
        <button
          key={b.action}
          type="button"
          onClick={() => onAction(b.action)}
          className={`px-3 py-1.5 rounded-lg font-medium shrink-0 cursor-pointer border ${
            b.primary ? 'ml-auto' : ''
          }`}
          style={
            b.primary
              ? {
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-fg)',
                  borderColor: 'var(--accent-primary)',
                }
              : {
                  backgroundColor: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  borderColor: 'var(--border-subtle)',
                }
          }
        >
          {b.label}
        </button>
      ))}
    </footer>
  );
}
