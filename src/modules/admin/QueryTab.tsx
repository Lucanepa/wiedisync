import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import pb from '../../pb'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Play, Star, AlertCircle, Loader2 } from 'lucide-react'
import QueryStrip from './components/QueryStrip'
import type { QueryTemplate } from './components/QueryStrip'
import type { TemplateParam } from './components/TemplateParamForm'
import TemplateParamForm from './components/TemplateParamForm'
import VisualQueryBuilder from './components/VisualQueryBuilder'
import ChartView from './components/ChartView'
import ResultsTable from './components/ResultsTable'
import ExportToolbar from './components/ExportToolbar'
import CodeMirrorEditor from './components/CodeMirrorEditor'
import type { CollectionInfo } from './components/TableBrowser'

interface QueryTabProps {
  collections: CollectionInfo[]
}

const RECENT_KEY = 'query-recent'

function addToRecent(sql: string) {
  try {
    const existing: { query: string; timestamp: number }[] = JSON.parse(
      localStorage.getItem(RECENT_KEY) || '[]',
    )
    const updated = [
      { query: sql, timestamp: Date.now() },
      ...existing.filter((r) => r.query !== sql),
    ].slice(0, 20)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch {
    // ignore localStorage errors
  }
}

function parseParams(paramsJson: string): TemplateParam[] {
  try {
    const parsed = JSON.parse(paramsJson)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function substituteParams(
  sql: string,
  values: Record<string, string>,
): string {
  let result = sql
  for (const [name, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`:${name}\\b`, 'g'), `'${value}'`)
  }
  return result
}

export default function QueryTab({ collections }: QueryTabProps) {
  const { t } = useTranslation('admin')
  const { user } = useAuth()

  const [mode, setMode] = useState<'sql' | 'visual'>('sql')
  const [query, setQuery] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [rows, setRows] = useState<unknown[][] | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultView, setResultView] = useState<'table' | 'chart'>('table')
  const [selectedTemplate, setSelectedTemplate] =
    useState<QueryTemplate | null>(null)
  const [executionTime, setExecutionTime] = useState<number>(0)
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [saveName, setSaveName] = useState('')

  // Convert rows to Record<string, unknown>[] for ChartView
  const chartData = useMemo<Record<string, unknown>[]>(() => {
    if (!rows || columns.length === 0) return []
    return rows.map((row) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col, i) => {
        obj[col] = row[i]
      })
      return obj
    })
  }, [rows, columns])

  const runQuery = useCallback(
    async (sql: string) => {
      const q = sql.trim()
      if (!q) return
      setIsRunning(true)
      setError(null)
      const start = performance.now()
      try {
        const res = (await pb.send('/api/admin/sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        })) as { success: boolean; columns: string[]; rows: unknown[][]; message?: string }

        if (!res.success) {
          setError(res.message || 'Query failed')
          setRows(null)
          return
        }

        setColumns(res.columns ?? [])
        setRows(res.rows ?? [])
        setExecutionTime(Math.round(performance.now() - start))
        addToRecent(q)
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Query failed'
        setError(msg)
        setRows(null)
      } finally {
        setIsRunning(false)
      }
    },
    [],
  )

  const handleExecute = useCallback(() => {
    runQuery(query)
  }, [query, runQuery])

  const handleSelectQuery = useCallback((sql: string) => {
    setQuery(sql)
    setSelectedTemplate(null)
  }, [])

  const handleSelectTemplate = useCallback((template: QueryTemplate) => {
    setQuery(template.query)
    const params = parseParams(template.params)
    if (params.length > 0) {
      setSelectedTemplate(template)
    } else {
      setSelectedTemplate(null)
    }
  }, [])

  const handleTemplateRun = useCallback(
    (values: Record<string, string>) => {
      if (!selectedTemplate) return
      const sql = substituteParams(selectedTemplate.query, values)
      setQuery(sql)
      runQuery(sql)
    },
    [selectedTemplate, runQuery],
  )

  const handleVisualQueryGenerated = useCallback(
    (sql: string) => {
      setQuery(sql)
      setMode('sql')
      runQuery(sql)
    },
    [runQuery],
  )

  const saveQuery = useCallback(
    async (name: string) => {
      if (!name.trim() || !user?.id) return
      try {
        await pb.collection('query_templates').create({
          name: name.trim(),
          query,
          type: 'saved',
          params: '[]',
          owner: user.id,
        })
        setShowSaveInput(false)
        setSaveName('')
      } catch {
        // save failed silently
      }
    },
    [query, user?.id],
  )

  const templateParams = selectedTemplate
    ? parseParams(selectedTemplate.params)
    : []

  return (
    <div className="space-y-4">
      {/* Query Strip */}
      <QueryStrip
        onSelect={handleSelectQuery}
        onSelectTemplate={handleSelectTemplate}
        currentUserId={user?.id}
      />

      {/* Template Param Form */}
      {selectedTemplate && templateParams.length > 0 && (
        <div className="rounded-lg border border-brand-600/20 bg-brand-600/5 p-3">
          <TemplateParamForm
            params={templateParams}
            onRun={handleTemplateRun}
            isRunning={isRunning}
          />
        </div>
      )}

      {/* Mode toggle + action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-input">
          <button
            type="button"
            onClick={() => setMode('sql')}
            className={`rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'sql'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('sqlMode')}
          </button>
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'visual'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {t('visualMode')}
          </button>
        </div>

        <div className="flex-1" />

        {/* Save button */}
        {mode === 'sql' && (
          <>
            {showSaveInput ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  saveQuery(saveName)
                }}
              >
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Query name..."
                  className="h-8 w-40 text-xs"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={!saveName.trim()}
                >
                  {t('saveQuery')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setShowSaveInput(false)
                    setSaveName('')
                  }}
                >
                  &times;
                </Button>
              </form>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setShowSaveInput(true)}
                disabled={!query.trim()}
              >
                <Star className="h-3.5 w-3.5" />
                {t('saveQuery')}
              </Button>
            )}
          </>
        )}

        {/* Run button */}
        {mode === 'sql' && (
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleExecute}
            disabled={isRunning || !query.trim()}
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {t('runQuery')}
          </Button>
        )}
      </div>

      {/* Editor area */}
      {mode === 'sql' ? (
        <CodeMirrorEditor
          value={query}
          onChange={setQuery}
          onExecute={handleExecute}
          collections={collections}
          placeholder="SELECT * FROM members LIMIT 10"
        />
      ) : (
        <div className="rounded-lg border border-input bg-background p-4">
          <VisualQueryBuilder onQueryGenerated={handleVisualQueryGenerated} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="font-mono text-xs">{error}</span>
        </div>
      )}

      {/* Results section */}
      {rows && (
        <div className="space-y-3">
          {/* Results header */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {t('queryResults', { count: rows.length })}
              {executionTime > 0 && (
                <span className="ml-1.5 text-muted-foreground/60">
                  {executionTime}ms
                </span>
              )}
            </span>

            <div className="flex-1" />

            {/* Table / Chart toggle */}
            <div className="flex rounded-lg border border-input">
              <button
                type="button"
                onClick={() => setResultView('table')}
                className={`rounded-l-lg px-3 py-1 text-xs font-medium transition-colors ${
                  resultView === 'table'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {t('tableView')}
              </button>
              <button
                type="button"
                onClick={() => setResultView('chart')}
                className={`rounded-r-lg px-3 py-1 text-xs font-medium transition-colors ${
                  resultView === 'chart'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {t('chartView')}
              </button>
            </div>
          </div>

          {/* Results content */}
          {resultView === 'table' ? (
            <ResultsTable columns={columns} rows={rows} />
          ) : (
            <ChartView data={chartData} columns={columns} />
          )}

          {/* Export toolbar */}
          {rows.length > 0 && (
            <ExportToolbar columns={columns} rows={rows} />
          )}
        </div>
      )}
    </div>
  )
}
