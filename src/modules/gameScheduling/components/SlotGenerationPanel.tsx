import { useTranslation } from 'react-i18next'

interface Props {
  seasonStatus: 'setup' | 'open' | 'closed'
  generating: boolean
  genResult: { total_created: number } | null
  onGenerate: () => Promise<void>
}

export default function SlotGenerationPanel({ seasonStatus, generating, genResult, onGenerate }: Props) {
  const { t } = useTranslation('gameScheduling')

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t('generateSlots')}</h2>

      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Generiert verfügbare Spieltermine basierend auf dem Hallenplan und den Spielsamstagen.
        Bestehende, noch nicht gebuchte Termine werden überschrieben.
      </p>

      <button
        onClick={onGenerate}
        disabled={generating || seasonStatus === 'closed'}
        className="rounded-md bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {generating ? t('generatingSlots') : t('generateSlots')}
      </button>

      {genResult && (
        <div className="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {t('slotsGenerated', { count: genResult.total_created })}
        </div>
      )}
    </div>
  )
}
