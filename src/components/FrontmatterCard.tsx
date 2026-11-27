import { useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2 } from 'lucide-react';

interface FrontmatterCardProps {
  frontmatterRaw?: string;
  onChange: (nextValue: string) => void;
}

export function FrontmatterCard({ frontmatterRaw, onChange }: FrontmatterCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (frontmatterRaw === undefined) {
    return null;
  }

  return (
    <div
      className="mx-auto max-w-[800px] mt-4 mb-2 rounded-xl border overflow-hidden text-xs"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-code)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3.5 py-2 flex items-center justify-between cursor-pointer font-medium"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <FileCode2 className="w-3.5 h-3.5" />
          YAML Frontmatter 元数据（已隔离无损保留）
        </span>
        <span className="flex items-center gap-1">
          {expanded ? '收起' : '展开编辑'}
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3.5 pb-3">
          <textarea
            value={frontmatterRaw}
            onChange={(e) => onChange(e.target.value)}
            rows={Math.max(3, frontmatterRaw.split('\n').length)}
            spellCheck={false}
            className="w-full rounded-lg border p-2.5 font-editor-mono text-xs leading-relaxed resize-y focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </div>
      )}
    </div>
  );
}
