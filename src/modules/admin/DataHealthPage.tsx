import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Wrench, XCircle, RefreshCcw, ScrollText,
} from 'lucide-react'
import {
  runAllChecks, autoFix, autoFixAll,
  type CollectionHealth, type DataIssue,
} from './utils/dataHealthChecks'

function severityIcon(severity: DataIssue['severity']) {
  return severity === 'error'
    ? <XCircle className="h-4 w-4 text-red-500" />
    : <AlertTriangle className="h-4 w-4 text-amber-500" />
}

function severityBadge(severity: DataIssue['severity']) {
  return severity === 'error'
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
}

function CollectionCard({
  health,
  onFixed,
}: {
  health: CollectionHealth
  onFixed: () => void
}) {
  const { t } = useTranslation('admin')
  const [expanded, setExpanded] = useState(health.issues.length > 0)
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [fixingAll, setFixingAll] = useState(false)

  const fixableCount = health.issues.filter((i) => i.autoFixable).length
  const errorCount = health.issues.filter((i) => i.severity === 'error').length
  const warningCount = health.issues.filter((i) => i.severity === 'warning').length

  // Group issues by label
  const grouped = health.issues.reduce<Record<string, DataIssue[]>>((acc, issue) => {
    const key = issue.label
    if (!acc[key]) acc[key] = []
    acc[key].push(issue)
    return acc
  }, {})

  async function handleFixOne(issue: DataIssue) {
    setFixingId(issue.id)
    try {
      await autoFix(issue)
      toast.success(`${t('dhFixed')}: ${issue.detail}`)
      onFixed()
    } catch {
      toast.error(t('dhFixFailed'))
    } finally {
      setFixingId(null)
    }
  }

  async function handleFixAll() {
    setFixingAll(true)
    try {
      const result = await autoFixAll(health.issues)
      toast.success(t('dhFixAllResult', { fixed: result.fixed, failed: result.failed }))
      onFixed()
    } catch {
      toast.error(t('dhFixFailed'))
    } finally {
      setFixingAll(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 text-gray-400" />
          : <ChevronRight className="h-4 w-4 text-gray-400" />
        }
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {health.collection}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          ({health.total} {t('dhRecords')})
        </span>
        <div className="ml-auto flex items-center gap-2">
          {health.issues.length === 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              {t('dhClean')}
            </span>
          ) : (
            <>
              {errorCount > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {errorCount} {errorCount === 1 ? t('dhError') : t('dhErrors')}
                </span>
              )}
              {warningCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {warningCount} {warningCount === 1 ? t('dhWarning') : t('dhWarnings')}
                </span>
              )}
            </>
          )}
        </div>
      </button>

      {/* Issues */}
      {expanded && health.issues.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {/* Fix all button */}
          {fixableCount > 0 && (
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {fixableCount} {t('dhAutoFixable')}
              </span>
              <button
                onClick={handleFixAll}
                disabled={fixingAll}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Wrench className="h-3 w-3" />
                {fixingAll ? t('dhFixing') : t('dhFixAll')}
              </button>
            </div>
          )}

          {Object.entries(grouped).map(([label, issues]) => (
            <div key={label} className="border-b border-gray-50 last:border-b-0 dark:border-gray-700/50">
              <div className="flex items-center gap-2 bg-gray-50/50 px-4 py-1.5 dark:bg-gray-900/20">
                {severityIcon(issues[0].severity)}
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {label}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${severityBadge(issues[0].severity)}`}>
                  {issues.length}
                </span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {issues.map((issue) => (
                  <div
                    key={`${issue.id}-${issue.field}`}
                    className="flex items-center gap-3 px-4 py-2 pl-10"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-gray-600 dark:text-gray-300">
                        {issue.detail}
                      </p>
                      <p className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                        ID: {issue.id} &middot; {t('dhField')}: {issue.field}
                        <Link
                          to={`/admin/audit-log?collection=${health.collection}&record_id=${issue.id}`}
                          className="inline-flex items-center gap-0.5 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          <ScrollText className="h-2.5 w-2.5" />
                          {t('dhViewHistory')}
                        </Link>
                      </p>
                    </div>
                    {issue.autoFixable && (
                      <button
                        onClick={() => handleFixOne(issue)}
                        disabled={fixingId === issue.id}
                        className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium disabled:opacity-50 ${
                          issue.fixAction === 'delete'
                            ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {fixingId === issue.id ? '...' : issue.fixAction === 'delete' ? t('dhDelete') : t('dhFix')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DataHealthPage() {
  const { t } = useTranslation('admin')
  const [results, setResults] = useState<CollectionHealth[]>([])
  const [loading, setLoading] = useState(false)
  const [lastCheck, setLastCheck] = useState('')

  const runChecks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await runAllChecks()
      setResults(data)
      setLastCheck(new Date().toLocaleTimeString())
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('dhTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('dhDescription')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastCheck && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {lastCheck}
            </span>
          )}
          <button
            onClick={runChecks}
            disabled={loading}
            className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                {t('dhScanning')}
              </span>
            ) : results.length > 0 ? (
              <span className="flex items-center gap-1.5">
                <RefreshCcw className="h-3.5 w-3.5" />
                {t('dhRescan')}
              </span>
            ) : (
              t('dhScan')
            )}
          </button>
        </div>
      </div>

      {/* Summary */}
      {results.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/30">
          <div className="flex items-center gap-3">
            {totalIssues === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {t('dhAllClean')}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('dhIssuesFound', { count: totalIssues })}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
            <AlertTriangle className="h-8 w-8 text-gray-400" />
          </div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('dhEmptyTitle')}
          </p>
          <p className="mb-6 text-xs text-gray-500 dark:text-gray-400">
            {t('dhEmptyDescription')}
          </p>
          <button
            onClick={runChecks}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {t('dhScan')}
          </button>
        </div>
      )}

      {/* Collection cards */}
      <div className="space-y-4">
        {results.map((health) => (
          <CollectionCard key={health.collection} health={health} onFixed={runChecks} />
        ))}
      </div>
    </div>
  )
}
