// src/modules/admin/ExplorePage.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useExplorerCache } from './hooks/useExplorerCache'
import { getExplorerScope, type BucketKey } from './components/explorerHelpers'
import ExplorerSearch from './components/ExplorerSearch'
import ExplorerTree from './components/ExplorerTree'
import ExplorerDetail from './components/ExplorerDetail'

type NavItem = { t: BucketKey; id: string }

const VALID_TYPES: readonly BucketKey[] = ['members', 'teams', 'events', 'trainings', 'games']

export default function ExplorePage() {
  const { t } = useTranslation('admin')
  const auth = useAuth()
  const scope = useMemo(
    () => getExplorerScope({
      isGlobalAdmin: auth.isGlobalAdmin,
      isVorstand: auth.isVorstand,
      isVbAdmin: auth.isVbAdmin,
      isBbAdmin: auth.isBbAdmin,
    }),
    [auth.isGlobalAdmin, auth.isVorstand, auth.isVbAdmin, auth.isBbAdmin],
  )
  const { data, isLoading, error, refresh } = useExplorerCache(scope)

  const [params, setParams] = useSearchParams()
  const rawType = params.get('t')
  const rawId = params.get('id')
  const selectedType = (VALID_TYPES as readonly string[]).includes(rawType ?? '')
    ? (rawType as BucketKey)
    : null
  const selectedId = rawId && /^[\w-]+$/.test(rawId) ? rawId : null

  const [navStack, setNavStack] = useState<NavItem[]>([])
  const [query, setQuery] = useState('')

  /** Jump: reset history to a single entry (tree clicks + search). */
  const handleJumpTo = useCallback(
    (type: BucketKey, id: string) => {
      setNavStack([{ t: type, id }])
      setParams({ t: type, id }, { replace: false })
    },
    [setParams],
  )

  /** Navigate: push onto existing history (chip clicks + breadcrumb). */
  const handleNavigate = useCallback(
    (type: BucketKey, id: string) => {
      setNavStack((stack) => {
        const top = stack[stack.length - 1]
        if (top?.t === type && top?.id === id) return stack
        const next = [...stack, { t: type, id }]
        return next.length > 10 ? next.slice(next.length - 10) : next
      })
      setParams({ t: type, id }, { replace: false })
    },
    [setParams],
  )

  const handleBackToTree = useCallback(() => {
    setParams({}, { replace: false })
  }, [setParams])

  // Keep navStack in sync when URL changes via browser back/forward
  useEffect(() => {
    if (!selectedType || !selectedId) return
    setNavStack((stack) => {
      const top = stack[stack.length - 1]
      if (top?.t === selectedType && top?.id === selectedId) return stack
      return [...stack, { t: selectedType, id: selectedId }].slice(-10)
    })
  }, [selectedType, selectedId])

  const handleRefresh = useCallback(() => {
    void refresh()
  }, [refresh])

  const hasSelection = !!selectedType && !!selectedId
  const refreshedAt = data.loadedAt ? new Date(data.loadedAt).toLocaleTimeString() : null

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 md:px-4">
        <h1 className="hidden text-sm font-bold text-primary md:block">{t('explorerTitle')}</h1>
        <div className="max-w-md flex-1">
          <ExplorerSearch value={query} onChange={setQuery} />
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          title={refreshedAt ? t('explorerRefreshedAt', { time: refreshedAt }) : undefined}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('explorerRefresh')}</span>
        </button>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Tree — hidden on mobile when a detail is open */}
        <aside
          className={
            'w-full overflow-hidden border-r border-border bg-card md:w-[280px] md:flex-shrink-0 ' +
            (hasSelection ? 'hidden md:block' : 'block')
          }
        >
          {isLoading && !data.loadedAt ? (
            <div className="p-4 text-sm text-muted-foreground">{t('explorerLoading')}</div>
          ) : error ? (
            <div className="p-4 text-sm text-destructive">{t('explorerError')}</div>
          ) : (
            <ExplorerTree
              cache={data}
              selectedType={selectedType}
              selectedId={selectedId}
              query={query}
              onSelect={handleJumpTo}
            />
          )}
        </aside>

        {/* Detail */}
        <main
          className={
            'min-w-0 flex-1 bg-background ' +
            (hasSelection ? 'block' : 'hidden md:block')
          }
        >
          <ExplorerDetail
            cache={data}
            type={selectedType}
            id={selectedId}
            navStack={navStack}
            onNavigate={handleNavigate}
            onBack={handleBackToTree}
          />
        </main>
      </div>
    </div>
  )
}
