import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNowStrict } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useReports } from '../messaging/hooks/useReports'
import type { ReportRow } from '../messaging/api/types'

type Tab = 'open' | 'resolved' | 'dismissed'

export default function AdminReportsPage() {
  const { t } = useTranslation('messaging')
  const { reports, openCount, resolve, dismiss, resolveWithDelete, resolveWithBan, isLoading } = useReports()
  const [tab, setTab] = useState<Tab>('open')

  const filtered = useMemo(() => reports.filter(r => r.status === tab), [reports, tab])

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold text-foreground mb-4">{t('adminReportsTitle')}</h1>
      <div role="tablist" className="flex gap-2 mb-4 border-b border-border">
        {(['open', 'resolved', 'dismissed'] as Tab[]).map(key => (
          <button
            key={key} role="tab" aria-selected={tab === key}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(key)}
          >
            {t(`adminReportsTab_${key}`)}
            {key === 'open' && openCount > 0 && (
              <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 min-w-[18px]">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {!isLoading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">{t('adminReportsEmpty')}</p>
      )}
      <ul className="space-y-3">
        {filtered.map((r) => (
          <ReportCard
            key={r.id} report={r}
            onResolve={() => resolve(r.id)}
            onDismiss={() => dismiss(r.id)}
            onResolveWithDelete={() => resolveWithDelete(r.id)}
            onResolveWithBan={() => resolveWithBan(r.id)}
          />
        ))}
      </ul>
    </div>
  )
}

function ReportCard(props: {
  report: ReportRow
  onResolve: () => void
  onDismiss: () => void
  onResolveWithDelete: () => void
  onResolveWithBan: () => void
}) {
  const { t } = useTranslation('messaging')
  const r = props.report
  const rel = formatDistanceToNowStrict(new Date(r.created_at), { addSuffix: true })
  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{r.reporter_name ?? '—'}</span>
        <span>→</span>
        <span className="font-medium text-foreground">{r.reported_name ?? '—'}</span>
        <span className="ml-auto">{rel}</span>
      </div>
      <div className="mt-1 text-sm text-foreground">
        <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs mr-2">{t(`reportReason_${r.reason}`)}</span>
        {r.note && <span>{r.note}</span>}
      </div>
      {r.message_snapshot && (
        <blockquote className="mt-2 border-l-2 border-border pl-3 text-xs text-muted-foreground italic">
          {r.message_snapshot}
        </blockquote>
      )}
      {r.status === 'open' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={props.onResolve}>{t('adminResolve')}</Button>
          <Button size="sm" variant="outline" onClick={props.onResolveWithDelete}>{t('adminResolveDelete')}</Button>
          <Button size="sm" variant="destructive" onClick={props.onResolveWithBan}>{t('adminResolveBan')}</Button>
          <Button size="sm" variant="ghost" onClick={props.onDismiss}>{t('adminDismiss')}</Button>
        </div>
      )}
    </li>
  )
}
