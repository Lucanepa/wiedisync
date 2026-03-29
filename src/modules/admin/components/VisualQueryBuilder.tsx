import { useState, useEffect, useMemo, useId } from 'react'
import { kscwApi } from '../../../lib/api'
import { useTranslation } from 'react-i18next'
import { X, Plus } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SchemaField {
  id: string
  name: string
  type: string
  required: boolean
  options: Record<string, unknown>
}

type Operator = '=' | '!=' | '>' | '<' | '>=' | '<=' | '~' | '!~'

interface FilterRow {
  id: string
  field: string
  operator: Operator
  value: string
}

export interface VisualQueryBuilderProps {
  onQueryGenerated: (sql: string) => void
  collections?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATORS: { value: Operator; label: string }[] = [
  { value: '=',  label: '=' },
  { value: '!=', label: '≠' },
  { value: '>',  label: '>' },
  { value: '<',  label: '<' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: '~',  label: 'LIKE' },
  { value: '!~', label: 'NOT LIKE' },
]

const SYSTEM_FIELDS: SchemaField[] = [
  { id: 'id',      name: 'id',      type: 'text',     required: true,  options: {} },
  { id: 'created', name: 'created', type: 'autodate', required: false, options: {} },
  { id: 'updated', name: 'updated', type: 'autodate', required: false, options: {} },
]

// ─── SQL generation ──────────────────────────────────────────────────────────

function buildSql({
  collection,
  selectedFields,
  allFields,
  filters,
  sortField,
  sortDir,
  limit,
}: {
  collection: string
  selectedFields: string[]
  allFields: SchemaField[]
  filters: FilterRow[]
  sortField: string
  sortDir: 'ASC' | 'DESC'
  limit: number
}): string {
  if (!collection) return ''

  const allFieldNames = allFields.map((f) => f.name)
  const fields =
    selectedFields.length === 0 || selectedFields.length === allFieldNames.length
      ? '*'
      : selectedFields.join(', ')

  const parts: string[] = [`SELECT ${fields} FROM ${collection}`]

  const activeFilters = filters.filter((f) => f.field && f.value !== '')
  if (activeFilters.length > 0) {
    const clauses = activeFilters.map((f) => {
      if (f.operator === '~')  return `${f.field} LIKE '%${f.value}%'`
      if (f.operator === '!~') return `${f.field} NOT LIKE '%${f.value}%'`
      return `${f.field} ${f.operator} '${f.value}'`
    })
    parts.push(`WHERE ${clauses.join(' AND ')}`)
  }

  if (sortField) {
    parts.push(`ORDER BY ${sortField} ${sortDir}`)
  }

  parts.push(`LIMIT ${limit}`)

  return parts.join(' ')
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VisualQueryBuilder({
  onQueryGenerated,
  collections: propCollections,
}: VisualQueryBuilderProps) {
  const { t } = useTranslation('admin')
  const uid = useId()

  const [collectionNames, setCollectionNames] = useState<string[]>(propCollections ?? [])
  const [loadingCollections, setLoadingCollections] = useState(!propCollections)
  const [collection, setCollection] = useState('')
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [loadingSchema, setLoadingSchema] = useState(false)

  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [filters, setFilters] = useState<FilterRow[]>([])
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC')
  const [limit, setLimit] = useState(100)

  // ── Fetch collection list ──────────────────────────────────────────────────

  useEffect(() => {
    if (propCollections) return
    let cancelled = false
    setLoadingCollections(true)
    kscwApi<{ rows?: unknown[][] }>('/admin/sql', {
      method: 'POST',
      body: {
        query: "SELECT name FROM _collections WHERE type != 'view' ORDER BY name",
      },
    })
      .then((res) => {
        if (cancelled) return
        const names = (res?.rows ?? []).map((r: unknown[]) => String(r[0]))
        setCollectionNames(names)
      })
      .catch(() => {/* silently ignore — user can still type */})
      .finally(() => { if (!cancelled) setLoadingCollections(false) })
    return () => { cancelled = true }
  }, [propCollections])

  // ── Fetch schema when collection changes ──────────────────────────────────

  useEffect(() => {
    if (!collection) {
      setSchema([])
      setSelectedFields([])
      setFilters([])
      setSortField('')
      return
    }
    let cancelled = false
    setLoadingSchema(true)
    kscwApi<{ rows?: unknown[][] }>('/admin/sql', {
      method: 'POST',
      body: {
        query: `SELECT fields FROM _collections WHERE name = '${collection}' LIMIT 1`,
      },
    })
      .then((res) => {
        if (cancelled) return
        const raw = res?.rows?.[0]?.[0]
        let parsed: SchemaField[] = []
        if (raw) {
          try { parsed = JSON.parse(String(raw)) as SchemaField[] } catch { /* ignore */ }
        }
        setSchema(parsed)
        const allNames = [...SYSTEM_FIELDS, ...parsed].map((f) => f.name)
        setSelectedFields(allNames)
        setSortField('')
        setFilters([])
      })
      .catch(() => {
        if (!cancelled) setSchema([])
      })
      .finally(() => { if (!cancelled) setLoadingSchema(false) })
    return () => { cancelled = true }
  }, [collection])

  const allFields: SchemaField[] = useMemo(
    () => [...SYSTEM_FIELDS, ...schema],
    [schema],
  )
  const fieldNames = useMemo(() => allFields.map((f) => f.name), [allFields])

  // ── SQL preview ────────────────────────────────────────────────────────────

  const sql = useMemo(
    () => buildSql({ collection, selectedFields, allFields, filters, sortField, sortDir, limit }),
    [collection, selectedFields, allFields, filters, sortField, sortDir, limit],
  )

  // ── Field multi-select helpers ─────────────────────────────────────────────

  function toggleField(name: string) {
    setSelectedFields((prev) =>
      prev.includes(name) ? prev.filter((f) => f !== name) : [...prev, name],
    )
  }

  function toggleAll() {
    if (selectedFields.length === fieldNames.length) {
      setSelectedFields([])
    } else {
      setSelectedFields(fieldNames)
    }
  }

  // ── Filter helpers ─────────────────────────────────────────────────────────

  function addFilter() {
    setFilters((prev) => [
      ...prev,
      { id: `${uid}-${Date.now()}`, field: fieldNames[0] ?? '', operator: '=', value: '' },
    ])
  }

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  function updateFilter<K extends keyof FilterRow>(id: string, key: K, val: FilterRow[K]) {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, [key]: val } : f)))
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const sectionLabel = 'block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5'
  const sectionWrap = 'space-y-1.5'

  return (
    <div className="space-y-5 text-sm">

      {/* Collection */}
      <div className={sectionWrap}>
        <label className={sectionLabel}>{t('selectCollection')}</label>
        {loadingCollections ? (
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        ) : (
          <Select value={collection} onValueChange={setCollection}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('selectCollection')} />
            </SelectTrigger>
            <SelectContent>
              {collectionNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Fields */}
      {collection && (
        <div className={sectionWrap}>
          <label className={sectionLabel}>{t('selectFields')}</label>
          {loadingSchema ? (
            <div className="h-16 animate-pulse rounded-md bg-muted" />
          ) : (
            <div className="rounded-md border border-input bg-background p-2">
              {/* Toggle all */}
              <label className="mb-1.5 flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-muted">
                <input
                  type="checkbox"
                  checked={selectedFields.length === fieldNames.length}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-input accent-primary"
                />
                <span className="font-medium text-foreground">*</span>
              </label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                {allFields.map((f) => (
                  <label
                    key={f.name}
                    className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(f.name)}
                      onChange={() => toggleField(f.name)}
                      className="h-3.5 w-3.5 rounded border-input accent-primary"
                    />
                    <span className="truncate font-mono text-xs text-foreground">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {collection && (
        <div className={sectionWrap}>
          <label className={sectionLabel}>{t('addFilter')}</label>
          <div className="space-y-2">
            {filters.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2">
                {/* Field */}
                <Select
                  value={row.field}
                  onValueChange={(v) => updateFilter(row.id, 'field', v)}
                >
                  <SelectTrigger className="h-8 w-36 min-w-0 flex-shrink-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldNames.map((fn) => (
                      <SelectItem key={fn} value={fn} className="text-xs font-mono">
                        {fn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator */}
                <Select
                  value={row.operator}
                  onValueChange={(v) => updateFilter(row.id, 'operator', v as Operator)}
                >
                  <SelectTrigger className="h-8 w-24 flex-shrink-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value} className="text-xs">
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value */}
                <Input
                  className="h-8 min-w-0 flex-1 text-xs"
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => updateFilter(row.id, 'value', e.target.value)}
                />

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFilter(row.id)}
                  aria-label="Remove filter"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-7 gap-1 text-xs"
            onClick={addFilter}
            disabled={!collection || fieldNames.length === 0}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('addFilter')}
          </Button>
        </div>
      )}

      {/* Sort */}
      {collection && (
        <div className={sectionWrap}>
          <label className={sectionLabel}>{t('sortBy')}</label>
          <div className="flex gap-2">
            <Select value={sortField} onValueChange={setSortField}>
              <SelectTrigger className="h-8 flex-1 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">—</SelectItem>
                {fieldNames.map((fn) => (
                  <SelectItem key={fn} value={fn} className="text-xs font-mono">
                    {fn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-20 flex-shrink-0 text-xs"
              onClick={() => setSortDir((d) => (d === 'ASC' ? 'DESC' : 'ASC'))}
            >
              {sortDir}
            </Button>
          </div>
        </div>
      )}

      {/* Limit */}
      {collection && (
        <div className={sectionWrap}>
          <label className={sectionLabel}>{t('limitResults')}</label>
          <Input
            type="number"
            min={1}
            max={10000}
            className="h-8 w-28 text-xs"
            value={limit}
            onChange={(e) => setLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
          />
        </div>
      )}

      {/* SQL Preview */}
      {sql && (
        <div className={sectionWrap}>
          <label className={sectionLabel}>{t('generatedSql')}</label>
          <textarea
            readOnly
            value={sql}
            rows={3}
            className="w-full resize-none rounded-md border border-input bg-muted px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
          />
          <Button
            size="sm"
            className="mt-1 h-7 text-xs"
            onClick={() => onQueryGenerated(sql)}
          >
            {t('runQuery')}
          </Button>
        </div>
      )}
    </div>
  )
}
