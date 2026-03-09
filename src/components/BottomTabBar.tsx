import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { Home, Calendar, Trophy, CheckCircle, Users, Menu } from 'lucide-react'

interface TabItem {
  to: string
  labelKey: string
  icon: React.ReactNode
  requiresAuth?: boolean
}

const iconClass = 'h-6 w-6'

const primaryTabs: TabItem[] = [
  { to: '/', labelKey: 'home', icon: <Home className={iconClass} /> },
  { to: '/calendar', labelKey: 'calendar', icon: <Calendar className={iconClass} /> },
  { to: '/games', labelKey: 'gamesShort', icon: <Trophy className={iconClass} /> },
  { to: '/trainings', labelKey: 'trainings', requiresAuth: true, icon: <CheckCircle className={iconClass} /> },
  { to: '/teams', labelKey: 'teams', requiresAuth: true, icon: <Users className={iconClass} /> },
]

interface BottomTabBarProps {
  onMoreTap: () => void
  moreActive: boolean
  unreadNotifications?: number
}

export default function BottomTabBar({ onMoreTap, moreActive, unreadNotifications = 0 }: BottomTabBarProps) {
  const { t } = useTranslation('nav')
  const { user, isApproved } = useAuth()
  const visibleTabs = primaryTabs.filter((tab) => !tab.requiresAuth || (user && isApproved))
  return (
    <nav className="pb-safe fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex h-16 items-stretch">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-gold-500 dark:text-gold-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`
            }
          >
            {tab.icon}
            {t(tab.labelKey)}
          </NavLink>
        ))}

        {/* More tab */}
        <button
          onClick={onMoreTap}
          className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
            moreActive
              ? 'text-gold-500 dark:text-gold-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          <Menu className={iconClass} />
          {unreadNotifications > 0 && (
            <span className="absolute right-2.5 top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
          {t('more')}
        </button>
      </div>
    </nav>
  )
}
