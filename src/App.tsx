import { useEffect, useMemo, useRef } from 'react';
import { extractFrontmatter } from '@/core/markdown/frontmatter';
import { isModKey } from '@/core/shortcuts/keymap';
import { MilkdownEditor, type MilkdownEditorHandle } from '@/editor/wysiwyg/MilkdownEditor';
import { SourceEditor } from '@/editor/source/SourceEditor';
import { useEditorStore } from '@/services/store/useEditorStore';
import { FrontmatterCard } from './components/FrontmatterCard';
import { MobileToolbar, type QuickActionType } from './components/MobileToolbar';
import { RichPreviewPanel } from './components/RichPreviewPanel';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { TitleBar } from './components/TitleBar';
import { UpdateModal } from './components/UpdateModal';
import { isTauriRuntime } from './services/platform';
import { shouldPromptUpdate } from './services/updater/updateService';

const SLASH_SNIPPETS: { label: string; desc: string; snippet: string }[] = [
  { label: '二级标题', desc: '## 章节标题', snippet: '\n## 新章节\n' },
  { label: '任务清单', desc: '- [ ] 待办事项', snippet: '\n- [ ] 待办事项\n' },
  { label: '引用块', desc: '> 重点摘录', snippet: '\n> 在这里输入引用内容\n' },
  {
    label: 'GFM 表格',
    desc: '插入 3 列标准表格',
    snippet: '\n| 列 A | 列 B | 列 C |\n| :--- | :---: | ---: |\n| 内容 1 | 状态 | 100 |\n',
  },
  {
    label: '代码块',
    desc: '```typescript',
    snippet: '\n```typescript\nconsole.log("ShowWorker");\n```\n',
  },
  {
    label: 'KaTeX 公式块',
    desc: '$$ ... $$',
    snippet: '\n$$\na^2 + b^2 = c^2\n$$\n',
  },
  {
    label: 'Mermaid 流程图',
    desc: '```mermaid',
    snippet: '\n```mermaid\nflowchart LR\n  A["开始"] --> B["完成"]\n```\n',
  },
];

export function App() {
  const store = useEditorStore();
  const wysiwygRef = useRef<MilkdownEditorHandle | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void store.bootstrap();
  }, [store]);

  // 桌面端启动 3 秒后静默自动检测更新
  useEffect(() => {
    if (!store.isBootstrapped || !isTauriRuntime || !store.settings.autoCheckUpdates) {
      return;
    }
    const timer = setTimeout(() => {
      void store.checkForUpdates({ silent: true });
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isBootstrapped]);

  // 全局快捷键：Mod+/ 切换模式，Mod+S 保存，Mod+\ 切换侧栏，Mod+Shift+F 搜索
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isModKey(e, store.platform)) return;
      if (e.key === '/') {
        e.preventDefault();
        store.toggleViewMode();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        void store.saveDocument(true);
      } else if (e.key === '\\') {
        e.preventDefault();
        store.toggleSidebar();
      } else if (e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        store.setSidebarTab('search');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const { body } = useMemo(() => {
    if (!store.session) return { body: '' };
    return extractFrontmatter(store.session.currentContent);
  }, [store.session]);

  const isDarkTheme = useMemo(() => {
    if (store.settings.theme === 'night-slate') return true;
    if (store.settings.theme === 'system' && typeof window !== 'undefined') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }
    return false;
  }, [store.settings.theme]);

  const handleMobileAction = (action: QuickActionType) => {
    if (action === 'toggleSource') {
      store.toggleViewMode();
      return;
    }
    const map: Record<Exclude<QuickActionType, 'toggleSource'>, string> = {
      h2: '\n## 标题\n',
      bold: '**重点**',
      code: '`code`',
      task: '\n- [ ] 待办事项\n',
      table: '\n| 列 1 | 列 2 |\n| :--- | :--- |\n| 值 1 | 值 2 |\n',
      math: '\n$$\nE = mc^2\n$$\n',
    };
    if (store.session?.viewMode === 'wysiwyg') {
      wysiwygRef.current?.insertMarkdownBlock(map[action]);
    } else if (store.session) {
      store.updateFullContent(`${store.session.currentContent}\n${map[action]}`);
    }
  };

  return (
    <div
      data-theme={store.settings.theme}
      data-platform={store.platform}
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--text-primary)' }}
    >
      <TitleBar
        platform={store.platform}
        workspace={store.workspace}
        session={store.session}
        theme={store.settings.theme}
        focusMode={store.focusMode}
        typewriterMode={store.typewriterMode}
        onToggleSidebar={() => store.toggleSidebar()}
        onOpenWorkspace={() => void store.openWorkspace()}
        onToggleSlashMenu={() => store.setSlashMenuOpen(!store.slashMenuOpen)}
        onToggleViewMode={() => store.toggleViewMode()}
        onSave={() => void store.saveDocument(true)}
        onExportHtml={() => {
          const html = wysiwygRef.current?.getRenderedHtml() ?? '';
          void store.exportHtml(html);
        }}
        onToggleFocus={() => store.toggleFocusMode()}
        onToggleTypewriter={() => store.toggleTypewriterMode()}
        onChangeTheme={(theme) => store.setTheme(theme)}
      />

      {store.availableUpdate &&
        !store.updateBannerDismissed &&
        !store.updateModalOpen &&
        shouldPromptUpdate(store.availableUpdate.version, store.settings.skippedUpdateVersion) && (
          <div
            className="px-4 py-2 text-xs flex items-center justify-between border-b"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <span>
              发现 ShowWorker 新版本 <strong>v{store.availableUpdate.version}</strong>（当前 v{store.appVersion}）
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => store.setUpdateModalOpen(true)}
                className="px-2.5 py-1 rounded font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-fg)' }}
              >
                查看更新
              </button>
              <button
                type="button"
                onClick={() => store.dismissUpdateBanner()}
                className="px-2.5 py-1 rounded border cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                稍后
              </button>
            </div>
          </div>
        )}

      {/* 崩溃恢复与外部修改冲突提醒条 */}
      {store.pendingRecovery && (
        <div
          className="px-4 py-2 text-xs flex items-center justify-between border-b"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span>检测到上次异常退出前的未保存草稿，是否恢复？</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => store.applyRecoverySnapshot()}
              className="px-2.5 py-1 rounded font-medium cursor-pointer"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-fg)' }}
            >
              恢复草稿
            </button>
            <button
              type="button"
              onClick={() => store.dismissRecoverySnapshot()}
              className="px-2.5 py-1 rounded border cursor-pointer"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {store.session?.syncConflict === 'external_modified' && (
        <div
          className="px-4 py-2 text-xs flex items-center justify-between border-b bg-amber-500/15"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span>磁盘上的文件已被外部程序修改，是否重新加载？</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void store.resolveExternalConflict('reload')}
              className="px-2.5 py-1 rounded font-medium bg-amber-600 text-white cursor-pointer"
            >
              重新加载磁盘版本
            </button>
            <button
              type="button"
              onClick={() => void store.resolveExternalConflict('keep')}
              className="px-2.5 py-1 rounded border cursor-pointer"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              保留当前并覆盖保存
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        <Sidebar
          visible={store.machineState.sidebarVisible}
          activeTab={store.machineState.activeSidebarTab}
          tree={store.tree}
          activeDocUri={store.session?.uri}
          activeDocDirty={store.session?.isDirty ?? false}
          outline={store.outline}
          searchQuery={store.searchQuery}
          searchResults={store.searchResults}
          onCloseMobile={() => {
            if (store.platform === 'ios') {
              store.toggleSidebar(false);
            }
          }}
          onChangeTab={(tab) => store.setSidebarTab(tab)}
          onSelectFile={(uri, line) => void store.openDocument(uri, line)}
          onCreateFile={(name) => void store.createDocument(name)}
          onRenameFile={(uri, newName) => void store.renameNode(uri, newName)}
          onDeleteFile={(uri) => void store.deleteNode(uri)}
          onSelectOutline={(line) => store.requestScrollToLine(line)}
          onSearch={(q) => void store.searchWorkspace(q)}
        />

        {/* 主画布区域 */}
        <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
          {!store.session ? (
            <div
              className="flex-1 flex flex-col items-center justify-center p-6 text-center text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              <p className="font-medium text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                欢迎使用 ShowWorker
              </p>
              <p>请在左侧选择或新建一篇 Markdown 文档，或打开本地工作区文件夹。</p>
            </div>
          ) : store.session.viewMode === 'wysiwyg' ? (
            <div
              ref={canvasScrollRef}
              className={`flex-1 overflow-y-auto thin-scroll px-3 sm:px-6 ${
                store.focusMode ? 'focus-mode-active' : ''
              }`}
            >
              <FrontmatterCard
                frontmatterRaw={store.session.frontmatterRaw}
                onChange={(nextFm) => store.updateFrontmatter(nextFm)}
              />

              <MilkdownEditor
                ref={wysiwygRef}
                docId={store.session.docId}
                markdown={body}
                typewriterMode={store.typewriterMode}
                scrollContainerRef={canvasScrollRef}
                scrollToLine={store.pendingScrollLine}
                onScrolled={() => store.requestScrollToLine(null)}
                onChange={(nextBody) => store.updateBodyContent(nextBody)}
                onOpenSlashMenu={() => store.setSlashMenuOpen(true)}
                onSaveImage={(fileName, b64) => store.saveImageAsset(fileName, b64)}
              />

              <RichPreviewPanel blocks={store.richBlocks} isDark={isDarkTheme} />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <SourceEditor
                docId={store.session.docId}
                value={store.session.currentContent}
                scrollToLine={store.pendingScrollLine}
                onScrolled={() => store.requestScrollToLine(null)}
                onChange={(nextFull) => store.updateFullContent(nextFull)}
              />
            </div>
          )}

          {/* 斜杠命令菜单 */}
          {store.slashMenuOpen && (
            <div
              className="absolute top-3 right-4 z-40 w-64 rounded-xl border shadow-xl p-1.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div
                className="px-2.5 py-1.5 flex items-center justify-between font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>插入 Markdown 块</span>
                <button
                  type="button"
                  onClick={() => store.setSlashMenuOpen(false)}
                  className="cursor-pointer hover:opacity-75"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-0.5 mt-1">
                {SLASH_SNIPPETS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (store.session?.viewMode === 'wysiwyg') {
                        wysiwygRef.current?.insertMarkdownBlock(item.snippet);
                      } else if (store.session) {
                        store.updateFullContent(`${store.session.currentContent}\n${item.snippet}`);
                      }
                      store.setSlashMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between hover:opacity-85"
                    style={{ backgroundColor: 'var(--bg-hover)' }}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="font-editor-mono" style={{ color: 'var(--text-muted)' }}>
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toast 反馈 */}
          {store.toastMessage && (
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-md"
              style={{
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-canvas)',
              }}
            >
              {store.toastMessage}
            </div>
          )}
        </main>
      </div>

      {/* 桌面状态栏 / 移动端快捷符号条 */}
      <div className="hidden md:block">
        <StatusBar
          session={store.session}
          platform={store.platform}
          appVersion={store.appVersion}
          updateStatus={store.updateStatus}
          availableUpdate={store.availableUpdate}
          onSave={() => void store.saveDocument(true)}
          onToggleEol={() => store.toggleEol()}
          onOpenUpdateModal={() => {
            store.setUpdateModalOpen(true);
            if (store.updateStatus === 'idle' || store.updateStatus === 'up-to-date' || store.updateStatus === 'error') {
              void store.checkForUpdates({ silent: false });
            }
          }}
        />
      </div>

      {store.session && (
        <MobileToolbar
          viewMode={store.session.viewMode}
          onAction={handleMobileAction}
        />
      )}

      <UpdateModal
        open={store.updateModalOpen}
        appVersion={store.appVersion}
        status={store.updateStatus}
        updateInfo={store.availableUpdate}
        progress={store.updateProgress}
        errorMessage={store.updateError}
        autoCheckUpdates={store.settings.autoCheckUpdates}
        onClose={() => store.setUpdateModalOpen(false)}
        onCheckNow={() => void store.checkForUpdates({ silent: false })}
        onInstall={() => void store.installAvailableUpdate()}
        onSkipVersion={() => store.skipAvailableUpdate()}
        onToggleAutoCheck={() => store.toggleAutoCheckUpdates()}
      />
    </div>
  );
}
