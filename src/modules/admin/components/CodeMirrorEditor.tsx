import { useRef, useEffect, useMemo } from 'react'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { basicSetup } from 'codemirror'
import { sql, SQLite } from '@codemirror/lang-sql'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { useTheme } from '@/hooks/useTheme'
import type { CollectionInfo } from './TableBrowser'

interface CodeMirrorEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  collections: CollectionInfo[]
  placeholder?: string
}

function buildSchema(
  collections: CollectionInfo[],
): Record<string, readonly string[]> {
  const schema: Record<string, string[]> = {}
  for (const col of collections) {
    schema[col.name] = [
      'id',
      'created',
      'updated',
      ...col.schema.map((f) => f.name),
    ]
  }
  return schema
}

export default function CodeMirrorEditor({
  value,
  onChange,
  onExecute,
  collections,
  placeholder,
}: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const externalValueRef = useRef(value)
  const onExecuteRef = useRef(onExecute)
  const onChangeRef = useRef(onChange)
  const themeCompartment = useRef(new Compartment())
  const sqlCompartment = useRef(new Compartment())
  const { theme } = useTheme()

  // Keep callback refs fresh
  onExecuteRef.current = onExecute
  onChangeRef.current = onChange

  const schema = useMemo(() => buildSchema(collections), [collections])

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return

    const executeKeymap = keymap.of([
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: () => {
          onExecuteRef.current()
          return true
        },
      },
      {
        key: 'Ctrl-Space',
        run: (view) => {
          startCompletion(view)
          return true
        },
      },
    ])

    const state = EditorState.create({
      doc: value,
      extensions: [
        executeKeymap,
        basicSetup,
        sqlCompartment.current.of(
          sql({ dialect: SQLite, schema, upperCaseKeywords: true }),
        ),
        autocompletion(),
        themeCompartment.current.of(theme === 'dark' ? oneDark : []),
        cmPlaceholder(placeholder || ''),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString()
            externalValueRef.current = newValue
            onChangeRef.current(newValue)
          }
        }),
        EditorView.theme({
          '&': { fontSize: '13px' },
          '.cm-content': { fontFamily: 'ui-monospace, "JetBrains Mono", monospace' },
          '.cm-gutters': { borderRight: 'none' },
          '.cm-scroller': { minHeight: '120px' },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Only run on mount — onExecute/onChange captured via refs below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync theme changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompartment.current.reconfigure(
        theme === 'dark' ? oneDark : [],
      ),
    })
  }, [theme])

  // Sync schema changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: sqlCompartment.current.reconfigure(
        sql({ dialect: SQLite, schema, upperCaseKeywords: true }),
      ),
    })
  }, [schema])

  // Sync external value changes (e.g., history selection, clear)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (value !== externalValueRef.current) {
      externalValueRef.current = value
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-lg border border-gray-300 [&_.cm-editor]:min-h-[120px] [&_.cm-editor]:resize-y [&_.cm-editor]:overflow-auto dark:border-gray-600"
    />
  )
}
