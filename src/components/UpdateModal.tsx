import { CheckCircle2, DownloadCloud, RefreshCw, X } from 'lucide-react';
import type { UpdateInfo, UpdateProgress, UpdateStatus } from '@/core/models';

interface UpdateModalProps {
  open: boolean;
  appVersion: string;
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  progress: UpdateProgress;
  errorMessage: string | null;
  autoCheckUpdates: boolean;
  onClose: () => void;
  onCheckNow: () => void;
  onInstall: () => void;
  onSkipVersion: () => void;
  onToggleAutoCheck: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UpdateModal({
  open,
  appVersion,
  status,
  updateInfo,
  progress,
  errorMessage,
  autoCheckUpdates,
  onClose,
  onCheckNow,
  onInstall,
  onSkipVersion,
  onToggleAutoCheck,
}: UpdateModalProps) {
  if (!open) {
    return null;
  }

  const isBusy = status === 'checking' || status === 'downloading' || status === 'installing';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)' }}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            <DownloadCloud className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
            <span>检查更新 · ShowWorker</span>
          </div>
          {!isBusy && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:opacity-75 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              aria-label="关闭更新弹窗"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-muted)' }}>当前版本</span>
            <span className="font-editor-mono font-semibold">v{appVersion}</span>
          </div>

          {status === 'checking' && (
            <div className="flex items-center gap-2 py-3" style={{ color: 'var(--text-muted)' }}>
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
              <span>正在连接 GitHub Releases 检测新版本...</span>
            </div>
          )}

          {status === 'up-to-date' && (
            <div
              className="rounded-xl border p-3 flex items-center gap-2"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-code)' }}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>当前已是最新版本 v{appVersion}。</span>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-500 leading-relaxed">
              检查或安装更新失败：{errorMessage || '请检查网络连接或代理设置后重试'}
            </div>
          )}

          {updateInfo && (status === 'available' || status === 'downloading' || status === 'installing') && (
            <div
              className="rounded-xl border p-3 space-y-2"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-code)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm" style={{ color: 'var(--accent-primary)' }}>
                  发现新版本 v{updateInfo.version}
                </span>
                {updateInfo.date && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {updateInfo.date.slice(0, 10)}
                  </span>
                )}
              </div>

              <div
                className="max-h-36 overflow-y-auto thin-scroll whitespace-pre-wrap leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                {updateInfo.body?.trim() || '包含体验优化与稳定性修复。'}
              </div>

              {(status === 'downloading' || status === 'installing') && (
                <div className="pt-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span>
                      {status === 'installing' ? '正在安装并准备重启...' : '正在下载更新包...'}
                    </span>
                    <span className="font-editor-mono">
                      {progress.percent}%
                      {progress.totalBytes
                        ? ` (${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)})`
                        : ''}
                    </span>
                  </div>
                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--border-subtle)' }}
                  >
                    <div
                      className="h-full transition-all duration-150"
                      style={{
                        width: `${progress.percent}%`,
                        backgroundColor: 'var(--accent-primary)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center justify-between pt-1 cursor-pointer select-none">
            <span style={{ color: 'var(--text-muted)' }}>启动时自动检测新版本</span>
            <input
              type="checkbox"
              checked={autoCheckUpdates}
              onChange={onToggleAutoCheck}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
          </label>
        </div>

        <div
          className="px-4 py-3 border-t flex items-center justify-end gap-2"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)' }}
        >
          {updateInfo && status === 'available' ? (
            <>
              <button
                type="button"
                onClick={onSkipVersion}
                className="px-3 py-1.5 rounded-lg border cursor-pointer hover:opacity-80"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                跳过此版本
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border cursor-pointer hover:opacity-80"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                稍后再说
              </button>
              <button
                type="button"
                onClick={onInstall}
                className="px-3.5 py-1.5 rounded-lg font-medium cursor-pointer hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-fg)',
                }}
              >
                立即更新并重启
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isBusy}
                onClick={onCheckNow}
                className="px-3 py-1.5 rounded-lg border cursor-pointer disabled:opacity-50"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                重新检查
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg font-medium cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-fg)',
                }}
              >
                关闭
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
