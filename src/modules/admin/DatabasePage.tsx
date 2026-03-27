import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import DashboardTab from './DashboardTab'
import QueryTab from './QueryTab'
import TableBrowser from './components/TableBrowser'
import type { CollectionInfo, SchemaField } from './components/TableBrowser'
import { API_URL, kscwApi } from '../../lib/api'

const PB_ADMIN_URL = `${API_URL}/admin/`

export default function DatabasePage() {
  const { t } = useTranslation('admin')
  const { isSuperAdmin } = useAuth()
  const [collections, setCollections] = useState<CollectionInfo[]>([])
  const [loadingCollections, setLoadingCollections] = useState(true)

  // Fetch all collection schemas (shared by QueryTab autocomplete + TableBrowser)
  useEffect(() => {
    if (!isSuperAdmin) return
    setLoadingCollections(true)
    kscwApi<{ success: boolean; columns: string[]; rows: unknown[][] }>('/admin/sql', {
      method: 'POST',
      body: {
        query: 'SELECT id, name, type, fields FROM _collections ORDER BY name',
      },
    })
      .then((res) => {
        if (!res.success) return
        const idIdx = res.columns.indexOf('id')
        const nameIdx = res.columns.indexOf('name')
        const typeIdx = res.columns.indexOf('type')
        const fieldsIdx = res.columns.indexOf('fields')
        const infos: CollectionInfo[] = res.rows.map((row) => {
          let fields: SchemaField[] = []
          try {
            const parsed = JSON.parse(String(row[fieldsIdx] || '[]'))
            fields = parsed
              .filter((f: Record<string, unknown>) => !f.system && f.name !== 'id')
              .map((f: Record<string, unknown>) => ({
                id: f.id || '',
                name: f.name || '',
                type: f.type || 'text',
                required: !!f.required,
                options: (f.options || {}) as Record<string, unknown>,
              }))
          } catch {
            // ignore parse errors
          }
          return {
            id: String(row[idIdx]),
            name: String(row[nameIdx]),
            type: String(row[typeIdx]),
            schema: fields,
          }
        })
        infos.sort((a, b) => a.name.localeCompare(b.name))
        setCollections(infos)
      })
      .catch(() => {})
      .finally(() => setLoadingCollections(false))
  }, [isSuperAdmin])

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
          {t('database')}
        </h1>
        <a
          href={PB_ADMIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {t('tab_pbadmin')} ↗
        </a>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="flex flex-1 flex-col overflow-hidden">
        <TabsList variant="line">
          <TabsTrigger value="dashboard">{t('dashboardTab')}</TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="query">{t('queryTab')}</TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="tables">{t('tablesTab')}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 flex-1 overflow-auto">
          <DashboardTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="query" className="mt-4 flex-1 overflow-auto">
            <QueryTab collections={collections} />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="tables" className="mt-4 flex-1 overflow-auto">
            <TableBrowser
              collections={collections}
              loadingCollections={loadingCollections}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
