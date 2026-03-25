import { useTranslation } from 'react-i18next'
import { useInfraHealth } from '../../hooks/useInfraHealth'
import KpiStrip from './components/KpiStrip'
import DashboardSection from './components/DashboardSection'
import MembersTeamsSection from './components/MembersTeamsSection'
import GamesSeasonSection from './components/GamesSeasonSection'
import ActivitySection from './components/ActivitySection'
import InfraSection from './components/InfraSection'

export default function DashboardTab() {
  const { t } = useTranslation('admin')
  const infraHealth = useInfraHealth()

  return (
    <div className="space-y-4">
      <KpiStrip infraHealth={infraHealth} />
      <div className="space-y-2">
        <DashboardSection id="members-teams" title={t('sectionMembersTeams')} icon="👥">
          <MembersTeamsSection />
        </DashboardSection>
        <DashboardSection id="games-season" title={t('sectionGamesSeason')} icon="🏐">
          <GamesSeasonSection />
        </DashboardSection>
        <DashboardSection id="activity" title={t('sectionActivity')} icon="📊">
          <ActivitySection />
        </DashboardSection>
        <DashboardSection id="infra" title={t('sectionInfra')} icon="🔧">
          <InfraSection infraHealth={infraHealth} />
        </DashboardSection>
      </div>
    </div>
  )
}
