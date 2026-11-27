import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';

interface SourceEditorProps {
  docId: string;
  value: string;
  scrollToLine: number | null;
  onChange: (nextValue: string) => void;
  onScrolled: () => void;
}

export function SourceEditor({
  docId,
  value,
  scrollToLine,
  onChange,
  onScrolled,
}: SourceEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const externalValueRef = useRef(value);
  const composingRef = useRef(false);

  onChangeRef.current = onChange;
  externalValueRef.current = value;

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    const theme = EditorView.theme({
      '&': {
        height: '100%',
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        fontSize: '14px',
      },
      '.cm-scroller': {
        fontFamily: 'var(--font-mono-win)',
        lineHeight: '1.7',
        padding: '16px 0',
      },
      '.cm-content': {
        maxWidth: '860px',
        padding: '0 20px',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-sidebar)',
        color: 'var(--text-muted)',
        borderRight: '1px solid var(--border-subtle)',
        paddingRight: '6px',
      },
      '.cm-activeLine': {
        backgroundColor: 'var(--bg-hover)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'var(--bg-hover)',
        color: 'var(--text-primary)',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--accent-primary)',
      },
    });

    const state = EditorState.create({
      doc: externalValueRef.current,
      extensions: [
        lineNumbers(),
        history(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        theme,
        EditorView.domEventHandlers({
          compositionstart: () => {
            composingRef.current = true;
            return false;
          },
          compositionend: (_event, view) => {
            composingRef.current = false;
            onChangeRef.current(view.state.doc.toString());
            return false;
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !composingRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [docId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !scrollToLine) return;
    const clampedLine = Math.max(1, Math.min(scrollToLine, view.state.doc.lines));
    const lineInfo = view.state.doc.line(clampedLine);
    view.dispatch({
      selection: { anchor: lineInfo.from },
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
    });
    onScrolled();
  }, [scrollToLine, onScrolled]);

  return <div ref={hostRef} className="h-full w-full font-editor-mono" />;
}
