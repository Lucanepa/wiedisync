import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './hooks/useAuth'
import { ThemeProvider } from './hooks/useTheme'
import { AdminModeProvider } from './hooks/useAdminMode'
import Layout from './components/Layout'
import AdminRoute from './components/AdminRoute'
import SuperAdminRoute from './components/SuperAdminRoute'
import GamesPage from './modules/games/GamesPage'
import SpielplanungPage from './modules/spielplanung/SpielplanungPage'
import TrainingsPage from './modules/trainings/TrainingsPage'
import AbsencesPage from './modules/absences/AbsencesPage'
import ScorerPage from './modules/scorer/ScorerPage'
import CalendarPage from './modules/calendar/CalendarPage'
import HomePage from './modules/home/HomePage'
import TeamsPage from './modules/teams/TeamsPage'
import TeamDetail from './modules/teams/TeamDetail'
import PlayerProfile from './modules/teams/PlayerProfile'
import RosterEditor from './modules/teams/RosterEditor'
import DatabasePage from './modules/admin/DatabasePage'
import InfraHealthPage from './modules/admin/InfraHealthPage'
import DataHealthPage from './modules/admin/DataHealthPage'
import AuditLogPage from './modules/admin/AuditLogPage'
import RefereeExpensesPage from './modules/admin/RefereeExpensesPage'
import HallenplanPage from './modules/hallenplan/HallenplanPage'
import EmbedGamesPage from './modules/games/EmbedGamesPage'
import LoginPage from './modules/auth/LoginPage'
import SignUpPage from './modules/auth/SignUpPage'
import PendingPage from './modules/auth/PendingPage'
import ProfilePage from './modules/auth/ProfilePage'
import EventsPage from './modules/events/EventsPage'
import DatenschutzPage from './modules/legal/DatenschutzPage'
import ImpressumPage from './modules/legal/ImpressumPage'
import AuthRoute from './components/AuthRoute'
import ScorerAssignPage from './modules/scorer/ScorerAssignPage'
import AdminSetupPage from './modules/gameScheduling/pages/AdminSetupPage'
import AdminDashboardPage from './modules/gameScheduling/pages/AdminDashboardPage'

import JoinPage from './modules/auth/JoinPage'
import PublicTerminplanungPage from './modules/gameScheduling/pages/PublicTerminplanungPage'
import OpponentFlowPage from './modules/gameScheduling/pages/OpponentFlowPage'
import FeedbackPage from './modules/feedback/FeedbackPage'
import ChangelogPage from './modules/changelog/ChangelogPage'

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <AdminModeProvider>
      <BrowserRouter>
        <Routes>
          {/* Standalone routes — no layout wrapper */}
          <Route path="embed/games" element={<EmbedGamesPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignUpPage />} />
          <Route path="pending" element={<PendingPage />} />

          <Route path="join/:token" element={<JoinPage />} />
          <Route path="terminplanung" element={<PublicTerminplanungPage />} />
          <Route path="terminplanung/:token" element={<OpponentFlowPage />} />

          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="games" element={<GamesPage />} />
            <Route path="trainings" element={<AuthRoute><TrainingsPage /></AuthRoute>} />
            <Route path="absences" element={<AuthRoute><AbsencesPage /></AuthRoute>} />
            <Route path="scorer" element={<AuthRoute><ScorerPage /></AuthRoute>} />
            <Route path="teams" element={<AuthRoute><TeamsPage /></AuthRoute>} />
            <Route path="teams/:teamSlug" element={<AuthRoute><TeamDetail /></AuthRoute>} />
            <Route path="teams/:teamSlug/roster/edit" element={<AuthRoute><RosterEditor /></AuthRoute>} />
            <Route path="teams/player/:memberId" element={<AuthRoute><PlayerProfile /></AuthRoute>} />
            <Route path="events" element={<EventsPage />} />
            <Route path="datenschutz" element={<DatenschutzPage />} />
            <Route path="impressum" element={<ImpressumPage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="changelog" element={<ChangelogPage />} />
            <Route path="profile" element={<AuthRoute><ProfilePage /></AuthRoute>} />
            <Route path="admin/spielplanung" element={<AdminRoute><SpielplanungPage /></AdminRoute>} />
            <Route path="admin/hallenplan" element={<AdminRoute><HallenplanPage /></AdminRoute>} />
            <Route path="admin/terminplanung" element={<AdminRoute><AdminSetupPage /></AdminRoute>} />
            <Route path="admin/terminplanung/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
            <Route path="admin/scorer-assign" element={<AdminRoute><ScorerAssignPage /></AdminRoute>} />
            <Route path="admin/referee-expenses" element={<AdminRoute><RefereeExpensesPage /></AdminRoute>} />
            <Route path="admin/database" element={<AdminRoute><DatabasePage /></AdminRoute>} />
            <Route path="admin/infra" element={<SuperAdminRoute><InfraHealthPage /></SuperAdminRoute>} />
            <Route path="admin/data-health" element={<SuperAdminRoute><DataHealthPage /></SuperAdminRoute>} />
            <Route path="admin/audit-log" element={<SuperAdminRoute><AuditLogPage /></SuperAdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
      </AdminModeProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}
