import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Editor, defaultValueCtx, editorViewCtx, rootCtx } from '@milkdown/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import {
  commonmark,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
} from '@milkdown/preset-commonmark';
import {
  addColAfterCommand,
  addRowAfterCommand,
  deleteSelectedCellsCommand,
  gfm,
  setAlignCommand,
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm';
import { callCommand, getHTML, insert, replaceAll } from '@milkdown/utils';

export interface MilkdownEditorHandle {
  insertMarkdownBlock: (markdownSnippet: string) => void;
  toggleFormat: (fmt: 'bold' | 'italic' | 'strike' | 'code') => void;
  scrollToLine: (line: number) => void;
  getRenderedHtml: () => string;
}

interface MilkdownEditorProps {
  docId: string;
  markdown: string;
  typewriterMode: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  scrollToLine: number | null;
  onScrolled: () => void;
  onChange: (nextMarkdown: string) => void;
  onOpenSlashMenu: () => void;
  onSaveImage: (fileName: string, base64Data: string) => Promise<string | null>;
}

export const MilkdownEditor = forwardRef<MilkdownEditorHandle, MilkdownEditorProps>(
  function MilkdownEditor(
    {
      docId,
      markdown,
      typewriterMode,
      scrollContainerRef,
      scrollToLine,
      onScrolled,
      onChange,
      onOpenSlashMenu,
      onSaveImage,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const lastEmittedMdRef = useRef<string>(markdown);
    const suppressChangeRef = useRef(false);
    const composingRef = useRef(false);

    const onChangeRef = useRef(onChange);
    const onOpenSlashRef = useRef(onOpenSlashMenu);
    const onSaveImageRef = useRef(onSaveImage);
    const typewriterRef = useRef(typewriterMode);

    onChangeRef.current = onChange;
    onOpenSlashRef.current = onOpenSlashMenu;
    onSaveImageRef.current = onSaveImage;
    typewriterRef.current = typewriterMode;

    const [inTable, setInTable] = useState(false);
    const [selectionBar, setSelectionBar] = useState<{
      visible: boolean;
      top: number;
      left: number;
    }>({ visible: false, top: 0, left: 0 });

    const syncActiveBlockAndSelection = () => {
      const editor = editorRef.current;
      const container = mountRef.current;
      if (!editor || !container) return;

      try {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;
          const { selection } = state;

          // 检测是否处于表格内部
          let insideTable = false;
          const { $from } = selection;
          for (let d = $from.depth; d > 0; d -= 1) {
            if ($from.node(d).type.name === 'table') {
              insideTable = true;
              break;
            }
          }
          setInTable(insideTable);

          // 更新专注模式活动块高亮
          const proseEl = container.querySelector('.ProseMirror');
          if (proseEl) {
            proseEl.querySelectorAll('.is-active-block').forEach((el) => {
              el.classList.remove('is-active-block');
            });
            const domAt = view.domAtPos(selection.head);
            let node: Node | null = domAt.node;
            while (node && node.parentNode !== proseEl) {
              node = node.parentNode;
            }
            if (node instanceof HTMLElement) {
              node.classList.add('is-active-block');
              if (typewriterRef.current && scrollContainerRef.current) {
                const scroller = scrollContainerRef.current;
                const rect = node.getBoundingClientRect();
                const scrollerRect = scroller.getBoundingClientRect();
                const targetTop = scrollerRect.top + scrollerRect.height * 0.44;
                const delta = rect.top - targetTop;
                if (Math.abs(delta) > 28) {
                  scroller.scrollBy({ top: delta, behavior: 'smooth' });
                }
              }
            }
          }

          // 划词轻量格式浮窗定位
          if (!selection.empty) {
            const coords = view.coordsAtPos(selection.from);
            setSelectionBar({
              visible: true,
              top: Math.max(48, coords.top - 42),
              left: Math.max(16, Math.min(window.innerWidth - 210, coords.left)),
            });
          } else {
            setSelectionBar((prev) => (prev.visible ? { ...prev, visible: false } : prev));
          }
        });
      } catch {
        // ignore transient view unmounted errors
      }
    };

    useImperativeHandle(ref, () => ({
      insertMarkdownBlock(snippet: string) {
        const editor = editorRef.current;
        if (!editor) return;
        editor.action(insert(snippet));
      },
      toggleFormat(fmt) {
        const editor = editorRef.current;
        if (!editor) return;
        if (fmt === 'bold') editor.action(callCommand(toggleStrongCommand.key));
        else if (fmt === 'italic') editor.action(callCommand(toggleEmphasisCommand.key));
        else if (fmt === 'strike') editor.action(callCommand(toggleStrikethroughCommand.key));
        else if (fmt === 'code') editor.action(callCommand(toggleInlineCodeCommand.key));
      },
      scrollToLine(line: number) {
        const container = mountRef.current;
        const scroller = scrollContainerRef.current;
        if (!container || !scroller) return;
        const prose = container.querySelector('.ProseMirror');
        if (!prose) return;
        const headings = Array.from(prose.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const totalLines = Math.max(1, lastEmittedMdRef.current.split('\n').length);
        const ratio = Math.min(1, Math.max(0, (line - 1) / totalLines));
        if (headings.length > 0 && line <= 5) {
          headings[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        scroller.scrollTo({
          top: scroller.scrollHeight * ratio,
          behavior: 'smooth',
        });
      },
      getRenderedHtml() {
        const editor = editorRef.current;
        if (!editor) return mountRef.current?.innerHTML ?? '';
        try {
          return editor.action(getHTML());
        } catch {
          return mountRef.current?.innerHTML ?? '';
        }
      },
    }));

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      let disposed = false;
      lastEmittedMdRef.current = markdown;

      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, container);
          ctx.set(defaultValueCtx, markdown);
          ctx.get(listenerCtx).markdownUpdated((_ctx, nextMd, prevMd) => {
            if (disposed || suppressChangeRef.current || composingRef.current) {
              return;
            }
            if (nextMd !== prevMd) {
              lastEmittedMdRef.current = nextMd;
              onChangeRef.current(nextMd);
              if (/(?:^|\n)\/$/.test(nextMd)) {
                onOpenSlashRef.current();
              }
            }
          });
          ctx.get(listenerCtx).selectionUpdated(() => {
            if (!disposed) {
              syncActiveBlockAndSelection();
            }
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(clipboard);

      editor
        .create()
        .then((created) => {
          if (disposed) {
            void created.destroy();
            return;
          }
          editorRef.current = created;
          syncActiveBlockAndSelection();
        })
        .catch(() => {
          // ignore init race when switching documents rapidly
        });

      const handleCompositionStart = () => {
        composingRef.current = true;
      };
      const handleCompositionEnd = () => {
        composingRef.current = false;
        const active = editorRef.current;
        if (active && !disposed) {
          try {
            active.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              if (view) {
                syncActiveBlockAndSelection();
              }
            });
          } catch {
            // ignore
          }
        }
      };

      const handleImageFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/')) continue;
          const reader = new FileReader();
          reader.onload = async () => {
            const result = typeof reader.result === 'string' ? reader.result : '';
            if (!result) return;
            const relPath = await onSaveImageRef.current(file.name || 'image.png', result);
            if (relPath && editorRef.current) {
              editorRef.current.action(insert(`![${file.name || 'image'}](${relPath})`));
            }
          };
          reader.readAsDataURL(file);
        }
      };

      const onPaste = (e: ClipboardEvent) => {
        if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
          const hasImg = Array.from(e.clipboardData.files).some((f) =>
            f.type.startsWith('image/'),
          );
          if (hasImg) {
            e.preventDefault();
            void handleImageFiles(e.clipboardData.files);
          }
        }
      };

      const onDrop = (e: DragEvent) => {
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          const hasImg = Array.from(e.dataTransfer.files).some((f) =>
            f.type.startsWith('image/'),
          );
          if (hasImg) {
            e.preventDefault();
            void handleImageFiles(e.dataTransfer.files);
          }
        }
      };

      container.addEventListener('compositionstart', handleCompositionStart);
      container.addEventListener('compositionend', handleCompositionEnd);
      container.addEventListener('paste', onPaste);
      container.addEventListener('drop', onDrop);

      return () => {
        disposed = true;
        container.removeEventListener('compositionstart', handleCompositionStart);
        container.removeEventListener('compositionend', handleCompositionEnd);
        container.removeEventListener('paste', onPaste);
        container.removeEventListener('drop', onDrop);
        if (editorRef.current) {
          void editorRef.current.destroy();
          editorRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docId]);

    // 外部切换视图或恢复草稿同步至 Milkdown
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || markdown === lastEmittedMdRef.current) return;
      suppressChangeRef.current = true;
      lastEmittedMdRef.current = markdown;
      try {
        editor.action(replaceAll(markdown));
      } finally {
        suppressChangeRef.current = false;
      }
    }, [markdown]);

    // 响应大纲/搜索点击定位
    useEffect(() => {
      if (!scrollToLine) return;
      const scroller = scrollContainerRef.current;
      if (scroller) {
        const totalLines = Math.max(1, lastEmittedMdRef.current.split('\n').length);
        const ratio = Math.min(1, Math.max(0, (scrollToLine - 1) / totalLines));
        scroller.scrollTo({ top: scroller.scrollHeight * ratio, behavior: 'smooth' });
      }
      onScrolled();
    }, [scrollToLine, scrollContainerRef, onScrolled]);

    const runTableCommand = (action: 'addRow' | 'addCol' | 'left' | 'center' | 'right' | 'del') => {
      const editor = editorRef.current;
      if (!editor) return;
      if (action === 'addRow') editor.action(callCommand(addRowAfterCommand.key));
      else if (action === 'addCol') editor.action(callCommand(addColAfterCommand.key));
      else if (action === 'del') editor.action(callCommand(deleteSelectedCellsCommand.key));
      else editor.action(callCommand(setAlignCommand.key, action));
    };

    return (
      <div className="relative markflow-prose">
        {/* 表格上下文悬浮工具条 */}
        {inTable && (
          <div
            className="sticky top-2 z-20 mx-auto w-fit px-2.5 py-1.5 rounded-xl border shadow-md flex items-center gap-1.5 text-xs"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <span className="font-medium mr-1" style={{ color: 'var(--text-muted)' }}>
              表格
            </span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runTableCommand('addRow');
              }}
              className="px-2 py-0.5 rounded hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              + 行
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runTableCommand('addCol');
              }}
              className="px-2 py-0.5 rounded hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              + 列
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runTableCommand('left');
              }}
              className="px-2 py-0.5 rounded hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              左对齐
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runTableCommand('center');
              }}
              className="px-2 py-0.5 rounded hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              居中
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runTableCommand('right');
              }}
              className="px-2 py-0.5 rounded hover:opacity-80 cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              右对齐
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                runTableCommand('del');
              }}
              className="px-2 py-0.5 rounded hover:text-red-500 cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              删除选区
            </button>
          </div>
        )}

        {/* 划词极简工具浮窗 */}
        {selectionBar.visible && (
          <div
            className="fixed z-40 px-1.5 py-1 rounded-lg border shadow-lg flex items-center gap-1 text-xs"
            style={{
              top: selectionBar.top,
              left: selectionBar.left,
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editorRef.current?.action(callCommand(toggleStrongCommand.key));
              }}
              className="px-2 py-1 rounded font-bold cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              B
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editorRef.current?.action(callCommand(toggleEmphasisCommand.key));
              }}
              className="px-2 py-1 rounded italic cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              I
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editorRef.current?.action(callCommand(toggleStrikethroughCommand.key));
              }}
              className="px-2 py-1 rounded line-through cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              S
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                editorRef.current?.action(callCommand(toggleInlineCodeCommand.key));
              }}
              className="px-2 py-1 rounded font-editor-mono cursor-pointer"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              Code
            </button>
          </div>
        )}

        <div ref={mountRef} />
      </div>
    );
  },
);
