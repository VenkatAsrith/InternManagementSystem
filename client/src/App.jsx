import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider, LoadingBlock } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Guard, HomeRedirect, RequireAuth } from './components/guards';
import { ACCESS } from './lib/access';
import { PublicLayout } from './layouts/PublicLayout';
import { AppShell } from './layouts/AppShell';

import { HomePage } from './pages/public/HomePage';
import { OpeningsPage } from './pages/public/OpeningsPage';
import { OpeningDetailPage } from './pages/public/OpeningDetailPage';
import { ApplicationPage } from './pages/public/ApplicationPage';
import { ApplicationSuccessPage } from './pages/public/ApplicationSuccessPage';
import { ApplicationStatusPage } from './pages/public/ApplicationStatusPage';
import { CertificateVerifyPage } from './pages/public/CertificateVerifyPage';
import { OfferResponsePage } from './pages/public/OfferResponsePage';
import { NotFoundPage } from './pages/public/NotFoundPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { SetPasswordPage } from './pages/auth/SetPasswordPage';
import { AccountPage } from './pages/auth/AccountPage';

import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { BootcampsPage } from './pages/admin/BootcampsPage';
import { BootcampDetailPage } from './pages/admin/BootcampDetailPage';
import { ProgramsPage } from './pages/admin/ProgramsPage';
import { ApplicationsPage } from './pages/admin/ApplicationsPage';
import { ApplicationDetailPage } from './pages/admin/ApplicationDetailPage';
import { InterviewsPage } from './pages/admin/InterviewsPage';
import { OffersPage } from './pages/admin/OffersPage';
import { OnboardingPage } from './pages/admin/OnboardingPage';
import { InternsPage } from './pages/admin/InternsPage';
import { InternDetailPage } from './pages/admin/InternDetailPage';
import { ProjectsPage } from './pages/admin/ProjectsPage';
import { TasksPage } from './pages/admin/TasksPage';
import { JournalsPage } from './pages/admin/JournalsPage';
import { MeetingsPage } from './pages/admin/MeetingsPage';
import { GoogleMeetDashboardPage } from './pages/admin/GoogleMeetDashboardPage';
import { AttendancePage } from './pages/admin/AttendancePage';
import { LeavesPage } from './pages/admin/LeavesPage';
import { LearningPage } from './pages/admin/LearningPage';
import { PerformancePage } from './pages/admin/PerformancePage';
import { AssetsPage } from './pages/admin/AssetsPage';
import { FinancePage } from './pages/admin/FinancePage';
import { DocumentsPage } from './pages/admin/DocumentsPage';
import { TemplatesPage } from './pages/admin/TemplatesPage';
import { CertificatesPage } from './pages/admin/CertificatesPage';
import { EmailTemplatesPage } from './pages/admin/EmailTemplatesPage';
import { ExitsPage } from './pages/admin/ExitsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { RolesPage } from './pages/admin/RolesPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { GlobalAdminPage } from './pages/admin/GlobalAdminPage';
import { MentorDashboardPage } from './pages/mentor/MentorDashboardPage';
import { ChatPage } from './pages/chat/ChatPage';

import { InternDashboardPage } from './pages/intern/InternDashboardPage';
import { InternOnboardingPage } from './pages/intern/InternOnboardingPage';
import { InternTasksPage } from './pages/intern/InternTasksPage';
import { InternJournalPage } from './pages/intern/InternJournalPage';
import { InternAttendancePage } from './pages/intern/InternAttendancePage';
import { InternLeavesPage } from './pages/intern/InternLeavesPage';
import { InternLearningPage } from './pages/intern/InternLearningPage';
import { InternMeetingsPage } from './pages/intern/InternMeetingsPage';
import { InternPerformancePage } from './pages/intern/InternPerformancePage';
import { InternFinancePage } from './pages/intern/InternFinancePage';
import { InternDocumentsPage } from './pages/intern/InternDocumentsPage';
import { InternCertificatesPage } from './pages/intern/InternCertificatesPage';
import { InternExitPage } from './pages/intern/InternExitPage';
import { TraineesPage } from './pages/admin/TraineesPage';
import { TraineeDetailPage } from './pages/admin/TraineeDetailPage';
import { InternTraineePage } from './pages/intern/InternTraineePage';

// Charts pull in a large library: load them only when someone opens Analytics.
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));

const g = (access, element, opts = {}) => <Guard any={access} {...opts}>{element}</Guard>;

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                {/* Public portal: no login */}
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/internships" element={<OpeningsPage />} />
                  <Route path="/internships/:slug" element={<OpeningDetailPage />} />
                  <Route path="/apply/:openingSlug" element={<ApplicationPage />} />
                  <Route path="/application/success" element={<ApplicationSuccessPage />} />
                  <Route path="/application/status" element={<ApplicationStatusPage />} />
                  <Route path="/verify/certificate" element={<CertificateVerifyPage kind="certificate" />} />
                  <Route path="/verify/certificate/:certificateId" element={<CertificateVerifyPage kind="certificate" />} />
                  <Route path="/verify/document" element={<CertificateVerifyPage kind="document" />} />
                  <Route path="/verify/document/:documentId" element={<CertificateVerifyPage kind="document" />} />
                  <Route path="/offer/:token" element={<OfferResponsePage />} />
                </Route>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/set-password" element={<SetPasswordPage />} />

                {/* Signed-in workspace. Every page is gated by the same permission table that builds the menu. */}
                <Route element={<RequireAuth />}>
                  <Route element={<AppShell />}>
                    <Route path="/home" element={<HomeRedirect />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/chat" element={<ChatPage />} />

                    <Route path="/admin" element={<HomeRedirect />} />
                    <Route path="/admin/global-command" element={g(null, <GlobalAdminPage />, { roles: ['SUPER_ADMIN'] })} />
                    <Route path="/admin/dashboard" element={g(ACCESS.analytics, <AdminDashboardPage />)} />
                    <Route path="/admin/analytics" element={g(ACCESS.analytics, <Suspense fallback={<LoadingBlock label="Loading charts..." />}><AnalyticsPage /></Suspense>)} />
                    <Route path="/admin/audit-logs" element={g(ACCESS.audit, <AuditLogsPage />)} />
                    <Route path="/admin/bootcamps" element={g(ACCESS.bootcamps, <BootcampsPage />)} />
                    <Route path="/admin/bootcamps/:id" element={g(ACCESS.bootcamps, <BootcampDetailPage />)} />
                    <Route path="/admin/programs" element={g(ACCESS.programs, <ProgramsPage />)} />
                    <Route path="/admin/applications" element={g(ACCESS.applications, <ApplicationsPage />)} />
                    <Route path="/admin/applications/:id" element={g(ACCESS.applications, <ApplicationDetailPage />)} />
                    <Route path="/admin/interviews" element={g(ACCESS.interviews, <InterviewsPage />)} />
                    <Route path="/admin/offers" element={g(ACCESS.offers, <OffersPage />)} />
                    <Route path="/admin/onboarding" element={g(ACCESS.onboarding, <OnboardingPage />)} />
                    <Route path="/admin/interns" element={g(ACCESS.interns, <InternsPage />)} />
                    <Route path="/admin/interns/:id" element={g(ACCESS.interns, <InternDetailPage />)} />
                    <Route path="/admin/trainees" element={g(ACCESS.trainees, <TraineesPage />)} />
                    <Route path="/admin/training-programs" element={<Navigate to="/admin/trainees?tab=programs" replace />} />
                    <Route path="/admin/trainees/:id" element={g(ACCESS.trainees, <TraineeDetailPage />)} />
                    <Route path="/admin/projects" element={g(ACCESS.projects, <ProjectsPage />)} />
                    <Route path="/admin/tasks" element={g(ACCESS.tasks, <TasksPage />)} />
                    <Route path="/admin/journals" element={g(ACCESS.journals, <JournalsPage />)} />
                    <Route path="/admin/meetings" element={g(ACCESS.meetings, <MeetingsPage />)} />
                    <Route path="/admin/google-meet" element={g(ACCESS.meetings, <GoogleMeetDashboardPage />)} />
                    <Route path="/admin/attendance" element={g(ACCESS.attendance, <AttendancePage />)} />
                    <Route path="/admin/leaves" element={g(ACCESS.leaves, <LeavesPage />)} />
                    <Route path="/admin/learning" element={g(ACCESS.learning, <LearningPage />)} />
                    <Route path="/admin/performance" element={g(ACCESS.performance, <PerformancePage />)} />
                    <Route path="/admin/assets" element={g(ACCESS.assets, <AssetsPage />)} />
                    <Route path="/admin/finance" element={g(ACCESS.finance, <FinancePage />)} />
                    <Route path="/admin/documents" element={g(ACCESS.documents, <DocumentsPage />)} />
                    <Route path="/admin/templates" element={g(ACCESS.templates, <TemplatesPage />)} />
                    <Route path="/admin/email-templates" element={g(ACCESS.templates, <EmailTemplatesPage />)} />
                    <Route path="/admin/certificates" element={g(ACCESS.certificates, <CertificatesPage />)} />
                    <Route path="/admin/exits" element={g(ACCESS.exits, <ExitsPage />)} />
                    <Route path="/admin/users" element={g(ACCESS.users, <UsersPage />)} />
                    <Route path="/admin/roles" element={g(ACCESS.roles, <RolesPage />)} />
                    <Route path="/admin/settings" element={g(ACCESS.settings, <SettingsPage />)} />

                    <Route path="/mentor" element={<Navigate to="/mentor/dashboard" replace />} />
                    <Route path="/mentor/dashboard" element={g(ACCESS.mentor, <MentorDashboardPage />)} />

                    <Route path="/intern" element={<Navigate to="/intern/dashboard" replace />} />
                    <Route path="/intern/dashboard" element={g(ACCESS.internHome, <InternDashboardPage />)} />
                    <Route path="/intern/onboarding" element={g(ACCESS.internOnboarding, <InternOnboardingPage />)} />
                    <Route path="/intern/tasks" element={g(ACCESS.internTasks, <InternTasksPage />)} />
                    <Route path="/intern/journal" element={g(ACCESS.internJournal, <InternJournalPage />)} />
                    <Route path="/intern/attendance" element={g(ACCESS.internAttendance, <InternAttendancePage />)} />
                    <Route path="/intern/leaves" element={g(ACCESS.internLeaves, <InternLeavesPage />)} />
                    <Route path="/intern/learning" element={g(ACCESS.internLearning, <InternLearningPage />)} />
                    <Route path="/intern/trainee" element={g(ACCESS.internTrainee, <InternTraineePage />)} />
                    <Route path="/intern/meetings" element={g(ACCESS.internMeetings, <InternMeetingsPage />)} />
                    <Route path="/intern/performance" element={g(ACCESS.internPerformance, <InternPerformancePage />)} />
                    <Route path="/intern/finance" element={g(ACCESS.internFinance, <InternFinancePage />)} />
                    <Route path="/intern/documents" element={g(ACCESS.internDocuments, <InternDocumentsPage />)} />
                    <Route path="/intern/certificates" element={g(ACCESS.internCertificates, <InternCertificatesPage />)} />
                    <Route path="/intern/exit" element={g(ACCESS.internExit, <InternExitPage />)} />
                  </Route>
                </Route>

                <Route path="*" element={<PublicLayout />}><Route path="*" element={<NotFoundPage />} /></Route>
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
