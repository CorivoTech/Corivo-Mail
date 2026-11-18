import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { HomePage } from './pages/public/HomePage.tsx';
import {
  FeaturesPage,
  PricingPage,
  SecurityPage,
  SupportPage,
} from './pages/public/MarketingPages.tsx';
import {
  ForgotPasswordPage,
  LoginPage,
  ResetPasswordPage,
  SignupPage,
} from './pages/auth/AuthPages.tsx';
import {
  OnboardingCompletePage,
  OnboardingDnsSetupPage,
  OnboardingDomainPage,
  OnboardingDomainVerificationPage,
  OnboardingMailboxPage,
  OnboardingOrganisationPage,
} from './pages/onboarding/OnboardingPages.tsx';
import { MailWorkspacePage } from './pages/workspace/MailWorkspacePage.tsx';
import { SearchPage } from './pages/workspace/SearchPage.tsx';
import {
  CalendarPage,
  ContactsPage,
  MigrationPage,
  NotesPage,
  SharedMailboxesPage,
  TasksPage,
} from './pages/workspace/WorkspaceModulesPages.tsx';
import {
  AccountProfilePage,
  AccountSecurityPage,
  ActiveSessionsPage,
  ChangePasswordPage,
  PersonalInformationPage,
  UserNotificationsPage,
} from './pages/account/AccountPages.tsx';
import {
  GeneralSettingsPage,
  MailSettingsPage,
  NotificationSettingsPage,
  SettingsOverviewPage,
  SignatureSettingsPage,
  UserStoragePage,
} from './pages/settings/SettingsPages.tsx';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.tsx';
import {
  AdminAddDomainWizardPage,
  AdminDnsRecordsPage,
  AdminDomainDetailPage,
  AdminDomainsPage,
} from './pages/admin/AdminDomainsPages.tsx';
import {
  AdminCreateMailboxPage,
  AdminGroupsAliasesPage,
  AdminMailboxDetailPage,
  AdminMailboxesPage,
  AdminRolesPage,
  AdminUserDetailPage,
  AdminUsersPage,
} from './pages/admin/AdminMailboxesUsersPages.tsx';
import {
  AdminAuditLogsPage,
  AdminBillingPage,
  AdminDeliverabilityPage,
  AdminIntegrationsPage,
  AdminOrganisationPage,
  AdminSecurityPage,
  AdminUsageStoragePage,
} from './pages/admin/AdminOperationsPages.tsx';
import {
  PlatformAuditLogsPage,
  PlatformHealthPage,
  PlatformOrgDetailPage,
  PlatformOrganisationsPage,
  PlatformOverviewPage,
  PlatformSettingsPage,
  PlatformUsersPage,
} from './pages/platform/PlatformPages.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC] dark:bg-[#0B1220] text-sm text-[#64748B]">
      Loading Corivo Mail workspace...
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOrgAdmin({ children }: { children: React.ReactNode }) {
  const { session, loading, isOrgAdminOrOwner } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isOrgAdminOrOwner) return <Navigate to="/app/mail/inbox" replace />;
  return <>{children}</>;
}

function RequirePlatformAdmin({ children }: { children: React.ReactNode }) {
  const { session, loading, isPlatformAdmin } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/app/mail/inbox" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Marketing Website */}
              <Route path="/" element={<HomePage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/support" element={<SupportPage />} />

              {/* Authentication */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Guided Onboarding */}
              <Route path="/onboarding" element={<Navigate to="/onboarding/organisation" replace />} />
              <Route path="/onboarding/organisation" element={<RequireAuth><OnboardingOrganisationPage /></RequireAuth>} />
              <Route path="/onboarding/domain" element={<RequireAuth><OnboardingDomainPage /></RequireAuth>} />
              <Route path="/onboarding/domain-verification" element={<RequireAuth><OnboardingDomainVerificationPage /></RequireAuth>} />
              <Route path="/onboarding/dns-setup" element={<RequireAuth><OnboardingDnsSetupPage /></RequireAuth>} />
              <Route path="/onboarding/mailbox" element={<RequireAuth><OnboardingMailboxPage /></RequireAuth>} />
              <Route path="/onboarding/complete" element={<RequireAuth><OnboardingCompletePage /></RequireAuth>} />

              {/* User Email Workspace */}
              <Route path="/app" element={<Navigate to="/app/mail/inbox" replace />} />
              <Route path="/app/mail" element={<Navigate to="/app/mail/inbox" replace />} />
              <Route path="/app/mail/inbox" element={<RequireAuth><MailWorkspacePage defaultFolder="inbox" /></RequireAuth>} />
              <Route path="/app/mail/sent" element={<RequireAuth><MailWorkspacePage defaultFolder="sent" /></RequireAuth>} />
              <Route path="/app/mail/drafts" element={<RequireAuth><MailWorkspacePage defaultFolder="drafts" /></RequireAuth>} />
              <Route path="/app/mail/starred" element={<RequireAuth><MailWorkspacePage defaultFolder="starred" /></RequireAuth>} />
              <Route path="/app/mail/snoozed" element={<RequireAuth><MailWorkspacePage defaultFolder="snoozed" /></RequireAuth>} />
              <Route path="/app/mail/archive" element={<RequireAuth><MailWorkspacePage defaultFolder="archive" /></RequireAuth>} />
              <Route path="/app/mail/spam" element={<RequireAuth><MailWorkspacePage defaultFolder="spam" /></RequireAuth>} />
              <Route path="/app/mail/trash" element={<RequireAuth><MailWorkspacePage defaultFolder="trash" /></RequireAuth>} />
              <Route path="/app/mail/folders/:folderId" element={<RequireAuth><MailWorkspacePage /></RequireAuth>} />
              <Route path="/app/mail/:folderId" element={<RequireAuth><MailWorkspacePage /></RequireAuth>} />
              <Route path="/app/search" element={<RequireAuth><SearchPage /></RequireAuth>} />

              {/* Workspace V1/V2 Modules */}
              <Route path="/app/contacts" element={<RequireAuth><ContactsPage /></RequireAuth>} />
              <Route path="/app/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
              <Route path="/app/migration" element={<RequireAuth><MigrationPage /></RequireAuth>} />
              <Route path="/app/shared-mailboxes" element={<RequireAuth><SharedMailboxesPage /></RequireAuth>} />
              <Route path="/app/tasks" element={<RequireAuth><TasksPage /></RequireAuth>} />
              <Route path="/app/notes" element={<RequireAuth><NotesPage /></RequireAuth>} />

              {/* User Account & Security */}
              <Route path="/app/account" element={<Navigate to="/app/account/profile" replace />} />
              <Route path="/app/account/profile" element={<RequireAuth><AccountProfilePage /></RequireAuth>} />
              <Route path="/app/account/personal-information" element={<RequireAuth><PersonalInformationPage /></RequireAuth>} />
              <Route path="/app/account/security" element={<RequireAuth><AccountSecurityPage /></RequireAuth>} />
              <Route path="/app/account/password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
              <Route path="/app/account/sessions" element={<RequireAuth><ActiveSessionsPage /></RequireAuth>} />
              <Route path="/app/account/notifications" element={<RequireAuth><UserNotificationsPage /></RequireAuth>} />

              {/* User Settings Centre */}
              <Route path="/app/settings" element={<RequireAuth><SettingsOverviewPage /></RequireAuth>} />
              <Route path="/app/settings/general" element={<RequireAuth><GeneralSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/display" element={<RequireAuth><GeneralSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/preferences" element={<RequireAuth><GeneralSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/email" element={<RequireAuth><MailSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/mail" element={<RequireAuth><MailSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/threading" element={<RequireAuth><MailSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/signature" element={<RequireAuth><SignatureSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/notifications" element={<RequireAuth><NotificationSettingsPage /></RequireAuth>} />
              <Route path="/app/settings/storage" element={<RequireAuth><UserStoragePage /></RequireAuth>} />

              {/* Organisation Admin Console */}
              <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
              <Route path="/admin/overview" element={<RequireOrgAdmin><AdminOverviewPage /></RequireOrgAdmin>} />
              <Route path="/admin/domains" element={<RequireOrgAdmin><AdminDomainsPage /></RequireOrgAdmin>} />
              <Route path="/admin/domains/add" element={<RequireOrgAdmin><AdminAddDomainWizardPage /></RequireOrgAdmin>} />
              <Route path="/admin/domains/:id" element={<RequireOrgAdmin><AdminDomainDetailPage defaultTab="overview" /></RequireOrgAdmin>} />
              <Route path="/admin/domains/:id/dns" element={<RequireOrgAdmin><AdminDomainDetailPage defaultTab="dns" /></RequireOrgAdmin>} />
              <Route path="/admin/dns" element={<RequireOrgAdmin><AdminDnsRecordsPage /></RequireOrgAdmin>} />
              <Route path="/admin/dns-records" element={<RequireOrgAdmin><AdminDnsRecordsPage /></RequireOrgAdmin>} />
              <Route path="/admin/mailboxes" element={<RequireOrgAdmin><AdminMailboxesPage /></RequireOrgAdmin>} />
              <Route path="/admin/mailboxes/new" element={<RequireOrgAdmin><AdminCreateMailboxPage /></RequireOrgAdmin>} />
              <Route path="/admin/mailboxes/create" element={<RequireOrgAdmin><AdminCreateMailboxPage /></RequireOrgAdmin>} />
              <Route path="/admin/mailboxes/:id" element={<RequireOrgAdmin><AdminMailboxDetailPage /></RequireOrgAdmin>} />
              <Route path="/admin/users" element={<RequireOrgAdmin><AdminUsersPage /></RequireOrgAdmin>} />
              <Route path="/admin/users/:id" element={<RequireOrgAdmin><AdminUserDetailPage /></RequireOrgAdmin>} />
              <Route path="/admin/groups" element={<RequireOrgAdmin><AdminGroupsAliasesPage /></RequireOrgAdmin>} />
              <Route path="/admin/roles" element={<RequireOrgAdmin><AdminRolesPage /></RequireOrgAdmin>} />
              <Route path="/admin/security" element={<RequireOrgAdmin><AdminSecurityPage defaultTab="dashboard" /></RequireOrgAdmin>} />
              <Route path="/admin/security/activity" element={<RequireOrgAdmin><AdminSecurityPage defaultTab="activity" /></RequireOrgAdmin>} />
              <Route path="/admin/security/settings" element={<RequireOrgAdmin><AdminSecurityPage defaultTab="settings" /></RequireOrgAdmin>} />
              <Route path="/admin/deliverability" element={<RequireOrgAdmin><AdminDeliverabilityPage defaultTab="overview" /></RequireOrgAdmin>} />
              <Route path="/admin/deliverability/queue" element={<RequireOrgAdmin><AdminDeliverabilityPage defaultTab="queue" /></RequireOrgAdmin>} />
              <Route path="/admin/deliverability/queues" element={<RequireOrgAdmin><AdminDeliverabilityPage defaultTab="queue" /></RequireOrgAdmin>} />
              <Route path="/admin/usage" element={<RequireOrgAdmin><AdminUsageStoragePage defaultTab="usage" /></RequireOrgAdmin>} />
              <Route path="/admin/storage" element={<RequireOrgAdmin><AdminUsageStoragePage defaultTab="storage" /></RequireOrgAdmin>} />
              <Route path="/admin/organisation" element={<RequireOrgAdmin><AdminOrganisationPage defaultTab="profile" /></RequireOrgAdmin>} />
              <Route path="/admin/organisation/profile" element={<RequireOrgAdmin><AdminOrganisationPage defaultTab="profile" /></RequireOrgAdmin>} />
              <Route path="/admin/organisation/preferences" element={<RequireOrgAdmin><AdminOrganisationPage defaultTab="preferences" /></RequireOrgAdmin>} />
              <Route path="/admin/organisation/security" element={<RequireOrgAdmin><AdminOrganisationPage defaultTab="security" /></RequireOrgAdmin>} />
              <Route path="/admin/organisation/notifications" element={<RequireOrgAdmin><AdminOrganisationPage defaultTab="notifications" /></RequireOrgAdmin>} />
              <Route path="/admin/activity" element={<RequireOrgAdmin><AdminAuditLogsPage defaultCategory="ADMIN_ACTIVITY" /></RequireOrgAdmin>} />
              <Route path="/admin/audit-logs" element={<RequireOrgAdmin><AdminAuditLogsPage defaultCategory="ALL" /></RequireOrgAdmin>} />
              <Route path="/admin/billing" element={<RequireOrgAdmin><AdminBillingPage defaultTab="overview" /></RequireOrgAdmin>} />
              <Route path="/admin/subscription" element={<RequireOrgAdmin><AdminBillingPage defaultTab="subscription" /></RequireOrgAdmin>} />
              <Route path="/admin/integrations" element={<RequireOrgAdmin><AdminIntegrationsPage /></RequireOrgAdmin>} />

              {/* Platform Super Admin Console */}
              <Route path="/platform" element={<RequirePlatformAdmin><PlatformOverviewPage /></RequirePlatformAdmin>} />
              <Route path="/platform/organisations" element={<RequirePlatformAdmin><PlatformOrganisationsPage /></RequirePlatformAdmin>} />
              <Route path="/platform/organisations/:id" element={<RequirePlatformAdmin><PlatformOrgDetailPage /></RequirePlatformAdmin>} />
              <Route path="/platform/users" element={<RequirePlatformAdmin><PlatformUsersPage /></RequirePlatformAdmin>} />
              <Route path="/platform/health" element={<RequirePlatformAdmin><PlatformHealthPage /></RequirePlatformAdmin>} />
              <Route path="/platform/settings" element={<RequirePlatformAdmin><PlatformSettingsPage /></RequirePlatformAdmin>} />
              <Route path="/platform/audit-logs" element={<RequirePlatformAdmin><PlatformAuditLogsPage /></RequirePlatformAdmin>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
