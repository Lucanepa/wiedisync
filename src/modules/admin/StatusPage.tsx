import { useTranslation } from 'react-i18next'
import { usePublicStatus } from '../../hooks/useBugfixes'
import { Loader2 } from 'lucide-react'
import { formatDateCompact } from '../../utils/dateHelpers'

function relativeDate(iso: string): string {
  return formatDateCompact(iso)
}

export default function StatusPage() {
  const { t } = useTranslation('bugfixes')
  const { data, isLoading } = usePublicStatus()

  const items = (data as { data?: { date: string; summary: string; status: string }[] })?.data ?? []
  const resolvedCount = items.filter(i => i.status === 'deployed_dev' || i.status === 'deployed_prod').length

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('statusTitle')}</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('recentFixes')}</p>
      </div>

      {isLoading && (
        <div className="p-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800/50">
          {t('noIssues')}
        </div>
      )}

      {items.length > 0 && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('resolvedThisWeek', { count: resolvedCount })}
          </p>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50"
              >
                <span className="mt-0.5 text-base">
                  {item.status === 'deployed_dev' || item.status === 'deployed_prod' ? '\u2705' : '\uD83D\uDD27'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 dark:text-gray-100">{item.summary}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{relativeDate(item.date)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
