import { useEffect, useId, useState } from 'react';
import katex from 'katex';
import mermaid from 'mermaid';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import type { RichBlockItem } from '@/core/models';

interface RichPreviewPanelProps {
  blocks: RichBlockItem[];
  isDark: boolean;
}

let mermaidInitializedTheme: string | null = null;

function MathPreviewCard({ source }: { source: string }) {
  let html = '';
  let error = '';
  try {
    html = katex.renderToString(source, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div
      className="rounded-xl border p-3 overflow-x-auto"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
    >
      <div className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
        KaTeX 公式实时渲染
      </div>
      {error ? (
        <div className="text-xs text-red-500">{error}</div>
      ) : (
        <div
          className="text-center py-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function MermaidPreviewCard({ source, isDark }: { source: string; isDark: boolean }) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let active = true;
    const theme = isDark ? 'dark' : 'default';
    if (mermaidInitializedTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        theme,
        securityLevel: 'strict',
      });
      mermaidInitializedTheme = theme;
    }

    mermaid
      .render(`mf_${reactId}_${Date.now()}`, source)
      .then((res) => {
        if (active) {
          setSvg(res.svg);
          setError('');
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Mermaid 语法渲染失败');
        }
      });

    return () => {
      active = false;
    };
  }, [source, isDark, reactId]);

  return (
    <div
      className="rounded-xl border p-3 overflow-x-auto"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}
    >
      <div className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
        Mermaid 图表实时渲染
      </div>
      {error ? (
        <pre className="text-xs text-amber-600 whitespace-pre-wrap">{error}</pre>
      ) : (
        <div
          className="flex justify-center py-1"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}

export function RichPreviewPanel({ blocks, isDark }: RichPreviewPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <section
      className="mx-auto max-w-[800px] mt-4 mb-6 rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-quote)' }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-medium cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          公式与图表实时预览卡片 ({blocks.length})
        </span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3">
          {blocks.map((block) =>
            block.kind === 'math' ? (
              <MathPreviewCard key={block.id} source={block.source} />
            ) : (
              <MermaidPreviewCard key={block.id} source={block.source} isDark={isDark} />
            ),
          )}
        </div>
      )}
    </section>
  );
}
