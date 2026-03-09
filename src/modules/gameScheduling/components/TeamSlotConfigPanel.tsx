import { useTranslation } from 'react-i18next'
import type { Team, TeamSlotConfig } from '../../../types'

interface Props {
  teams: Team[]
  config: TeamSlotConfig
  onUpdate: (config: TeamSlotConfig) => Promise<void>
}

export default function TeamSlotConfigPanel({ teams, config, onUpdate }: Props) {
  const { t } = useTranslation('gameScheduling')

  const handleSourceChange = (teamId: string, source: 'hall_slot' | 'spielsamstag' | 'manual') => {
    const updated = { ...config }
    updated[teamId] = { ...updated[teamId], source }
    onUpdate(updated)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{t('teamSlotConfig')}</h2>

      <div className="space-y-2">
        {teams.map(team => {
          const teamConfig = config[team.id] || { source: 'hall_slot' }
          return (
            <div
              key={team.id}
              className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {team.name}
                {team.full_name && (
                  <span className="ml-2 text-gray-500 dark:text-gray-400">({team.full_name})</span>
                )}
              </span>

              <div className="flex gap-1">
                {(['hall_slot', 'spielsamstag', 'manual'] as const).map(source => (
                  <button
                    key={source}
                    onClick={() => handleSourceChange(team.id, source)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      teamConfig.source === source
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {source === 'hall_slot' ? t('latestSlot') : source === 'spielsamstag' ? t('spielsamstagMode') : t('sourceManual')}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
