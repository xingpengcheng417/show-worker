import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, Sparkles, User, X } from 'lucide-react';

interface AboutModalProps {
  open: boolean;
  appVersion: string;
  onClose: () => void;
  onCheckUpdates: () => void;
}

const FEATURES = [
  {
    title: '沉浸所见即所得',
    desc: 'Typora 风格即时渲染，支持 Ctrl/⌘ + / 秒切源码视图',
  },
  {
    title: '完整富媒体排版',
    desc: '内置 GFM 表格工具条、KaTeX 公式与 Mermaid 架构图卡片',
  },
  {
    title: '无损往返与安全写盘',
    desc: '隔离保留 Frontmatter 与 LF/CRLF，支持崩溃草稿恢复',
  },
  {
    title: '跨平台与自动更新',
    desc: '支持 Windows / macOS 桌面端，内置自动检测版本升级',
  },
];

const REPO_URL = 'https://github.com/xingpengcheng417/show-worker';

export function AboutModal({
  open,
  appVersion,
  onClose,
  onCheckUpdates,
}: AboutModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleCopyRepo = () => {
    navigator.clipboard?.writeText(REPO_URL).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-sidebar)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shadow-sm"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-fg)',
              }}
            >
              S
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">ShowWorker</h2>
                <span
                  className="px-2 py-0.5 rounded-full font-editor-mono text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  v{appVersion}
                </span>
              </div>
              <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>
                轻量、本地优先的跨平台 Typora 风格 Markdown 编辑器
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:opacity-75 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            aria-label="关闭关于弹窗"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 正文介绍与作者信息 */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FEATURES.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border p-3 space-y-1"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-code)',
                }}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <Sparkles
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: 'var(--accent-primary)' }}
                  />
                  <span>{item.title}</span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl border p-3.5 space-y-2"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'var(--bg-quote)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <User className="w-3.5 h-3.5" />
                <span>作者</span>
              </span>
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                大侠的橙子
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span style={{ color: 'var(--text-muted)' }}>项目仓库</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-editor-mono truncate" style={{ color: 'var(--accent-primary)' }}>
                  {REPO_URL}
                </span>
                <button
                  type="button"
                  onClick={handleCopyRepo}
                  className="p-1 rounded hover:opacity-80 cursor-pointer shrink-0"
                  style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-muted)' }}
                  title="复制仓库地址"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)' }}>核心技术栈</span>
              <span className="font-editor-mono" style={{ color: 'var(--text-muted)' }}>
                Tauri 2 · React · Milkdown · CodeMirror 6
              </span>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-sidebar)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onClose();
              onCheckUpdates();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer hover:opacity-85"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>检查更新</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium cursor-pointer hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-fg)',
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
