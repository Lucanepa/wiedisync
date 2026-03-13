import { useEffect, useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import TeamChip from './TeamChip'
import SwitchToggle from './SwitchToggle'
import { getFileUrl } from '../utils/pbFile'
import AdminToggle from './AdminToggle'
import { useAdminMode } from '../hooks/useAdminMode'
import { Bell, UserX, PenSquare, CalendarDays, ClipboardList, Building2, CalendarClock, Database, RefreshCcw, LogIn, User } from 'lucide-react'
import type { MemberTeam, Team } from '../types'

type ExpandedMemberTeam = MemberTeam & { expand?: { team?: Team } }

/** Animated close: plays exit animation, then calls onClose after it finishes */
function useAnimatedClose(onClose: () => void) {
  const [closing, setClosing] = useState(false)
  const startClose = useCallback(() => {
    setClosing(true)
  }, [])
  const onAnimEnd = useCallback(() => {
    if (closing) onClose()
  }, [closing, onClose])
  return { closing, startClose, onAnimEnd }
}

const iconClass = 'h-5 w-5'

const secondaryItems = [
  { to: '/absences', labelKey: 'absences', icon: <UserX className={iconClass} /> },
  { to: '/scorer', labelKey: 'scorer', icon: <PenSquare className={iconClass} /> },
  { to: '/events', labelKey: 'events', icon: <CalendarDays className={iconClass} /> },
]

const adminItems = [
  { to: '/admin/spielplanung', labelKey: 'gameplan', icon: <ClipboardList className={iconClass} /> },
  { to: '/admin/hallenplan', labelKey: 'hallenplan', icon: <Building2 className={iconClass} /> },
  { to: '/admin/terminplanung', labelKey: 'terminplanung', icon: <CalendarClock className={iconClass} /> },
]

interface MoreSheetProps {
  onClose: () => void
  unreadNotifications?: number
  onOpenNotifications?: () => void
  memberTeams?: ExpandedMemberTeam[]
}

export default function MoreSheet({ onClose, unreadNotifications = 0, onOpenNotifications, memberTeams = [] }: MoreSheetProps) {
  const { user, isApproved, isSuperAdmin, logout } = useAuth()
  const { isAdminMode } = useAdminMode()
  const { theme, toggleTheme } = useTheme()
  const { t, i18n } = useTranslation('nav')
  const { closing, startClose, onAnimEnd } = useAnimatedClose(onClose)

  // Prevent body scroll when sheet is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50" onClick={startClose}>
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-black/50 ${closing ? 'animate-fade-out' : 'animate-fade-in'}`} />

      {/* Sheet */}
      <div
        className={`pb-safe absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white dark:bg-gray-800 ${closing ? 'animate-sheet-down' : 'animate-sheet-up'}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={onAnimEnd}
      >
        {/* Handle — sticky so it's always visible */}
        <div className="sticky top-0 z-10 flex justify-center rounded-t-2xl bg-white pb-2 pt-3 dark:bg-gray-800">
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Nav items */}
        <nav className="px-4 pb-2">
          {/* Notifications row */}
          {user && isApproved && onOpenNotifications && (
            <>
              <button
                onClick={onOpenNotifications}
                className="flex min-h-[48px] w-full items-center gap-4 rounded-lg px-4 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <div className="relative">
                  <Bell className={iconClass} />
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </div>
                {t('notifications')}
              </button>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
            </>
          )}
          {(!user || !isApproved) ? null : secondaryItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={startClose}
              className={({ isActive }) =>
                `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`
              }
            >
              {item.icon}
              {t(item.labelKey)}
            </NavLink>
          ))}

          {isAdminMode && (
            <>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t('admin')}
              </p>
              {adminItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={startClose}
                  className={({ isActive }) =>
                    `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {item.icon}
                  {t(item.labelKey)}
                </NavLink>
              ))}
            </>
          )}

          {isAdminMode && isSuperAdmin && (
            <>
              <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
              <p className="mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t('superadmin')}
              </p>
              <NavLink
                to="/admin/database"
                onClick={startClose}
                className={({ isActive }) =>
                  `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`
                }
              >
                <Database className={iconClass} />
                {t('manageDb')}
              </NavLink>
              <NavLink
                to="/admin/clubdesk-sync"
                onClick={startClose}
                className={({ isActive }) =>
                  `flex min-h-[48px] items-center gap-4 rounded-lg px-4 py-3 text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-gold-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`
                }
              >
                <RefreshCcw className={iconClass} />
                {t('clubdeskSync')}
              </NavLink>
            </>
          )}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />

        {/* Language toggle (only if user hasn't set language preference) */}
        {(!user || !user.language) && (
          <>
            <div className="flex items-center justify-center px-8 py-3">
              <SwitchToggle
                enabled={i18n.language === 'de'}
                onChange={() => {
                  const next = i18n.language === 'de' ? 'en' : 'de'
                  i18n.changeLanguage(next)
                  localStorage.setItem('kscw-lang', next)
                }}
                size="md"
                ariaLabel="Toggle language"
                iconOff={
                  <svg viewBox="0 0 60 60">
                    <g transform="translate(0,12)">
                      <rect width="60" height="36" fill="#012169"/>
                      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#fff" strokeWidth="7"/>
                      <path d="M0,0 L60,36 M60,0 L0,36" stroke="#C8102E" strokeWidth="4.5"/>
                      <path d="M30,0 V36 M0,18 H60" stroke="#fff" strokeWidth="12"/>
                      <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="7"/>
                    </g>
                  </svg>
                }
                iconOn={
                  <svg viewBox="0 0 32 32" className="rounded-sm">
                    <rect width="32" height="32" fill="#D52B1E" rx="2"/>
                    <rect x="13" y="6" width="6" height="20" fill="#fff"/>
                    <rect x="6" y="13" width="20" height="6" fill="#fff"/>
                  </svg>
                }
              />
            </div>
            <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />
          </>
        )}

        {/* User section */}
        {user ? (
          <>
            <div className="px-4 py-3">
              {/* Profile link + name + teams */}
              <div className="flex items-center gap-3">
                <NavLink
                  to="/profile"
                  onClick={startClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 overflow-hidden"
                  aria-label={t('myProfile')}
                >
                  {user.photo ? (
                    <img
                      src={getFileUrl('members', user.id, user.photo)}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <User className={iconClass} />
                  )}
                </NavLink>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user.first_name} {user.last_name}
                  </span>
                  {memberTeams.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {memberTeams.map((mt) => (
                        <TeamChip key={mt.id} team={mt.expand?.team?.name ?? '?'} size="sm" />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    logout()
                    startClose()
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {t('logout')}
                </button>
              </div>
            </div>

            {/* Options section */}
            <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />
            <div className="px-4 py-3">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {t('options', 'Options')}
              </span>
              <div className="flex items-center gap-4">
                <AdminToggle size="sm" />
                <SwitchToggle
                  enabled={theme === 'dark'}
                  onChange={toggleTheme}
                  size="sm"
                  ariaLabel="Toggle dark mode"
                  iconOff={
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                  }
                  iconOn={
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                    </svg>
                  }
                />
                {(!user.language) && (
                  <SwitchToggle
                    enabled={i18n.language === 'de'}
                    onChange={() => {
                      const next = i18n.language === 'de' ? 'en' : 'de'
                      i18n.changeLanguage(next)
                      localStorage.setItem('kscw-lang', next)
                    }}
                    size="sm"
                    ariaLabel="Toggle language"
                    iconOff={
                      <svg viewBox="0 0 60 60">
                        <g transform="translate(0,12)">
                          <rect width="60" height="36" fill="#012169"/>
                          <path d="M0,0 L60,36 M60,0 L0,36" stroke="#fff" strokeWidth="7"/>
                          <path d="M0,0 L60,36 M60,0 L0,36" stroke="#C8102E" strokeWidth="4.5"/>
                          <path d="M30,0 V36 M0,18 H60" stroke="#fff" strokeWidth="12"/>
                          <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" strokeWidth="7"/>
                        </g>
                      </svg>
                    }
                    iconOn={
                      <svg viewBox="0 0 32 32" className="rounded-sm">
                        <rect width="32" height="32" fill="#D52B1E" rx="2"/>
                        <rect x="13" y="6" width="6" height="20" fill="#fff"/>
                        <rect x="6" y="13" width="20" height="6" fill="#fff"/>
                      </svg>
                    }
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <NavLink
                  to="/login"
                  onClick={startClose}
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-brand-600 transition-colors hover:bg-gray-100 dark:text-gold-400 dark:hover:bg-gray-700"
                >
                  <LogIn className={iconClass} />
                  {t('signIn')}
                </NavLink>
                <SwitchToggle
                  enabled={theme === 'dark'}
                  onChange={toggleTheme}
                  size="md"
                  ariaLabel="Toggle dark mode"
                  iconOff={
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    </svg>
                  }
                  iconOn={
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                    </svg>
                  }
                />
              </div>
            </div>
          </>
        )}

        {/* Legal links */}
        <div className="mx-4 border-t border-gray-200 dark:border-gray-700" />
        <div className="flex items-center justify-center gap-3 px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
          <NavLink to="/datenschutz" onClick={startClose} className="hover:text-gray-600 dark:hover:text-gray-300">
            {t('privacy')}
          </NavLink>
          <span>·</span>
          <NavLink to="/impressum" onClick={startClose} className="hover:text-gray-600 dark:hover:text-gray-300">
            {t('impressum')}
          </NavLink>
        </div>
      </div>
    </div>
  )
}
