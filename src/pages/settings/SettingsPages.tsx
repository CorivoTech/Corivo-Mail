import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  FileSignature,
  HardDrive,
  LayoutGrid,
  Mail,
  Sliders,
  User,
} from 'lucide-react';
import { WorkspaceShell } from '../../components/layout/WorkspaceShell.tsx';
import {
  Button,
  Card,
  FieldLabel,
  Select,
  SkeletonRows,
  Textarea,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { cn, formatBytes, formatDateTime, formatStorageMb, sanitizeHtml } from '../../lib/utils.ts';
import type { UserNotification, UserPreference } from '../../shared/types.ts';

function SettingsLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const links = [
    { to: '/app/settings', label: 'Overview', icon: LayoutGrid, end: true },
    { to: '/app/settings/general', label: 'General & Preferences', icon: Sliders },
    { to: '/app/settings/email', label: 'Mail & Threading', icon: Mail },
    { to: '/app/settings/signature', label: 'Email Signature', icon: FileSignature },
    { to: '/app/settings/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings/storage', label: 'Storage Usage', icon: HardDrive },
  ];

  return (
    <WorkspaceShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                to="/app/mail/inbox"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline mb-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Mail Workspace
              </Link>
              <h1 className="font-display text-2xl font-bold text-[#14243A] dark:text-white">{title}</h1>
              <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">{subtitle}</p>
            </div>
            <Link to="/app/account/profile">
              <Button variant="outline" size="sm">Account &amp; Security</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <aside className="md:col-span-3 space-y-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-800 text-[#2563EB] font-semibold'
                        : 'text-[#64748B] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white'
                    )
                  }
                >
                  <l.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{l.label}</span>
                </NavLink>
              ))}
              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <Link
                  to="/app/account/profile"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#64748B] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>My Profile &amp; Security</span>
                </Link>
              </div>
            </aside>
            <div className="md:col-span-9">{children}</div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export function SettingsOverviewPage() {
  const { session } = useAuth();
  const prefs = session?.preferences;

  return (
    <SettingsLayout
      title="Settings Centre"
      subtitle="Personalise your webmail behaviour, regional preferences, signature, notifications, and storage."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/app/settings/general">
          <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
            <Sliders className="w-5 h-5 text-[#2563EB] mb-2" />
            <h3 className="text-sm font-semibold">General &amp; Personal Preferences</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Language: {prefs?.language || 'en-IN'} · Time Zone: {prefs?.timezone || 'Asia/Kolkata'} · Theme: {prefs?.theme || 'light'} · Density: {prefs?.density || 'comfortable'}
            </p>
          </Card>
        </Link>
        <Link to="/app/settings/email">
          <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
            <Mail className="w-5 h-5 text-[#2563EB] mb-2" />
            <h3 className="text-sm font-semibold">Mail Preferences &amp; Threading</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Threading: {prefs?.threadingEnabled ? 'Enabled' : 'Disabled'} · Reply mode: {prefs?.defaultReplyMode === 'reply_all' ? 'Reply All' : 'Reply'} · Font: {prefs?.defaultFont || 'DM Sans'}
            </p>
          </Card>
        </Link>
        <Link to="/app/settings/signature">
          <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
            <FileSignature className="w-5 h-5 text-[#2563EB] mb-2" />
            <h3 className="text-sm font-semibold">Email Signature</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Default signature: {prefs?.signatureEnabled ? 'Active' : 'Disabled'}
            </p>
          </Card>
        </Link>
        <Link to="/app/settings/notifications">
          <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
            <Bell className="w-5 h-5 text-[#2563EB] mb-2" />
            <h3 className="text-sm font-semibold">Notification Preferences</h3>
            <p className="text-xs text-[#64748B] mt-1">
              New email alerts: {prefs?.newEmailAlerts ? 'On' : 'Off'} · Security alerts: {prefs?.securityAlerts ? 'On' : 'Off'}
            </p>
          </Card>
        </Link>
        <Link to="/app/settings/storage" className="sm:col-span-2">
          <Card className="p-5 hover:border-[#2563EB] transition-colors">
            <HardDrive className="w-5 h-5 text-[#2563EB] mb-2" />
            <h3 className="text-sm font-semibold">Storage Usage</h3>
            <p className="text-xs text-[#64748B] mt-1">
              Inspect your allocated mailbox quota, folder sizes, and attachment consumption
            </p>
          </Card>
        </Link>
      </div>
    </SettingsLayout>
  );
}

export function GeneralSettingsPage() {
  const { session, refreshSession, setThemeLocal } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({
    language: session?.preferences.language || 'en-IN',
    timezone: session?.preferences.timezone || 'Asia/Kolkata',
    dateFormat: (session?.preferences.dateFormat || 'DD/MM/YYYY') as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD',
    timeFormat: (session?.preferences.timeFormat || '12h') as '12h' | '24h',
    theme: (session?.preferences.theme || 'light') as 'light' | 'dark',
    density: (session?.preferences.density || 'comfortable') as 'comfortable' | 'compact',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.preferences) return;
    setForm({
      language: session.preferences.language || 'en-IN',
      timezone: session.preferences.timezone || 'Asia/Kolkata',
      dateFormat: session.preferences.dateFormat || 'DD/MM/YYYY',
      timeFormat: session.preferences.timeFormat || '12h',
      theme: session.preferences.theme || 'light',
      density: session.preferences.density || 'comfortable',
    });
  }, [session?.preferences]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch<{ preferences: UserPreference }>('/api/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setThemeLocal(form.theme);
      await refreshSession();
      notify('Personal preferences saved.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const previewSample = formatDateTime(new Date().toISOString(), form.timezone, 'full', {
    dateFormat: form.dateFormat,
    timeFormat: form.timeFormat,
    language: form.language,
  });

  return (
    <SettingsLayout
      title="General & Personal Preferences"
      subtitle="Configure language, time zone, date/time format, theme, and display density."
    >
      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="gs-lang">Language</FieldLabel>
              <Select id="gs-lang" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="en-IN">English (India)</option>
                <option value="en-US">English (United States)</option>
                <option value="en-GB">English (United Kingdom)</option>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="gs-tz">Time Zone</FieldLabel>
              <Select id="gs-tz" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                <option value="UTC">UTC</option>
                <option value="Asia/Singapore">Asia/Singapore (+08:00)</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="gs-df">Date Format</FieldLabel>
              <Select
                id="gs-df"
                value={form.dateFormat}
                onChange={(e) => setForm({ ...form, dateFormat: e.target.value as 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' })}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="gs-tf">Time Format</FieldLabel>
              <Select
                id="gs-tf"
                value={form.timeFormat}
                onChange={(e) => setForm({ ...form, timeFormat: e.target.value as '12h' | '24h' })}
              >
                <option value="12h">12-hour (AM/PM)</option>
                <option value="24h">24-hour</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="gs-theme">Theme</FieldLabel>
              <Select
                id="gs-theme"
                value={form.theme}
                onChange={(e) => {
                  const next = e.target.value as 'light' | 'dark';
                  setForm({ ...form, theme: next });
                  setThemeLocal(next);
                }}
              >
                <option value="light">Light (Enterprise Default)</option>
                <option value="dark">Dark Slate</option>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="gs-den">Display Density</FieldLabel>
              <Select
                id="gs-den"
                value={form.density}
                onChange={(e) => setForm({ ...form, density: e.target.value as 'comfortable' | 'compact' })}
              >
                <option value="comfortable">Comfortable (Standard spacing)</option>
                <option value="compact">Compact (High-density inbox rows)</option>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#64748B]">Live Timestamp Preview</span>
            <span className="font-mono font-semibold text-[#14243A] dark:text-white tabular-nums">{previewSample}</span>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!session?.preferences) return;
                const prevTheme = session.preferences.theme || 'light';
                setForm({
                  language: session.preferences.language || 'en-IN',
                  timezone: session.preferences.timezone || 'Asia/Kolkata',
                  dateFormat: session.preferences.dateFormat || 'DD/MM/YYYY',
                  timeFormat: session.preferences.timeFormat || '12h',
                  theme: prevTheme,
                  density: session.preferences.density || 'comfortable',
                });
                setThemeLocal(prevTheme);
              }}
            >
              Discard Unsaved
            </Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save General Settings'}</Button>
          </div>
        </form>
      </Card>
    </SettingsLayout>
  );
}

export function MailSettingsPage() {
  const { session, refreshSession } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({
    defaultReplyMode: (session?.preferences.defaultReplyMode || 'reply') as 'reply' | 'reply_all',
    threadingEnabled: session?.preferences.threadingEnabled ?? true,
    readingPane: (session?.preferences.readingPane || 'right') as 'right' | 'bottom' | 'off',
    defaultFont: session?.preferences.defaultFont || 'DM Sans',
    confirmBeforeSend: session?.preferences.confirmBeforeSend ?? false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.preferences) return;
    setForm({
      defaultReplyMode: session.preferences.defaultReplyMode || 'reply',
      threadingEnabled: session.preferences.threadingEnabled ?? true,
      readingPane: session.preferences.readingPane || 'right',
      defaultFont: session.preferences.defaultFont || 'DM Sans',
      confirmBeforeSend: session.preferences.confirmBeforeSend ?? false,
    });
  }, [session?.preferences]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/users/me/preferences', { method: 'PATCH', body: JSON.stringify(form) });
      await refreshSession();
      notify('Mail preferences saved.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save mail preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout
      title="Mail Preferences & Conversation Threading"
      subtitle="Configure conversation threading, default reply mode, reading pane layout, and compose defaults."
    >
      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel htmlFor="ms-rep">Default Reply Behaviour</FieldLabel>
              <Select
                id="ms-rep"
                value={form.defaultReplyMode}
                onChange={(e) => setForm({ ...form, defaultReplyMode: e.target.value as 'reply' | 'reply_all' })}
              >
                <option value="reply">Reply</option>
                <option value="reply_all">Reply All</option>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="ms-rp">Reading Pane</FieldLabel>
              <Select
                id="ms-rp"
                value={form.readingPane}
                onChange={(e) => setForm({ ...form, readingPane: e.target.value as 'right' | 'bottom' | 'off' })}
              >
                <option value="right">Right Side</option>
                <option value="bottom">Bottom Split</option>
                <option value="off">Full Screen</option>
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="ms-font">Default Font</FieldLabel>
              <Select id="ms-font" value={form.defaultFont} onChange={(e) => setForm({ ...form, defaultFont: e.target.value })}>
                <option value="DM Sans">DM Sans</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Sans-Serif">System Sans</option>
              </Select>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={form.threadingEnabled}
                onChange={(e) => setForm({ ...form, threadingEnabled: e.target.checked })}
                className="mt-1"
              />
              <div>
                <span className="font-medium block">Conversation Threading</span>
                <span className="text-xs text-[#64748B]">
                  Group replies with matching thread IDs into a unified conversation view when opening an email.
                </span>
              </div>
            </label>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.confirmBeforeSend}
                onChange={(e) => setForm({ ...form, confirmBeforeSend: e.target.checked })}
                className="mt-1"
              />
              <div>
                <span className="font-medium block">Confirm Before Sending</span>
                <span className="text-xs text-[#64748B]">
                  Prompt for explicit confirmation before submitting an email to the delivery queue.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Mail Preferences'}</Button>
          </div>
        </form>
      </Card>
    </SettingsLayout>
  );
}

export function SignatureSettingsPage() {
  const { session, refreshSession } = useAuth();
  const { notify } = useToast();
  const [signatureEnabled, setSignatureEnabled] = useState(session?.preferences.signatureEnabled ?? true);
  const [signatureHtml, setSignatureHtml] = useState(session?.preferences.signatureHtml || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.preferences) return;
    setSignatureEnabled(session.preferences.signatureEnabled ?? true);
    setSignatureHtml(session.preferences.signatureHtml || '');
  }, [session?.preferences]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ signatureEnabled, signatureHtml }),
      });
      await refreshSession();
      notify('Email signature saved.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save signature', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout title="Email Signature" subtitle="Create and preview the signature appended to new emails.">
      <Card className="p-6 space-y-5">
        <form onSubmit={handleSave} className="space-y-4">
          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={signatureEnabled} onChange={(e) => setSignatureEnabled(e.target.checked)} />
            <span>Automatically append default signature in new messages</span>
          </label>
          <div>
            <FieldLabel htmlFor="sig-html" hint="Sanitized HTML supported">Signature HTML</FieldLabel>
            <Textarea
              id="sig-html"
              rows={5}
              value={signatureHtml}
              onChange={(e) => setSignatureHtml(e.target.value)}
              className="font-mono text-xs"
              placeholder="<p><strong>Your Name</strong><br/>Title · Company</p>"
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#64748B] mb-2">Live Preview</p>
            <div
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F7F9FC] dark:bg-[#0B1220] p-4 text-sm"
              dangerouslySetInnerHTML={{
                __html: signatureHtml ? sanitizeHtml(signatureHtml) : '<span class="text-slate-400">No signature configured</span>',
              }}
            />
          </div>
          <div className="flex justify-end gap-3">
            {signatureHtml && (
              <Button type="button" variant="outline" onClick={() => setSignatureHtml('')}>
                Clear Signature
              </Button>
            )}
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Signature'}</Button>
          </div>
        </form>
      </Card>
    </SettingsLayout>
  );
}

export function NotificationSettingsPage() {
  const { session, refreshSession } = useAuth();
  const { notify } = useToast();
  const [form, setForm] = useState({
    newEmailAlerts: session?.preferences.newEmailAlerts ?? true,
    browserNotifications: session?.preferences.browserNotifications ?? false,
    securityAlerts: session?.preferences.securityAlerts ?? true,
    productAnnouncements: session?.preferences.productAnnouncements ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!session?.preferences) return;
    setForm({
      newEmailAlerts: session.preferences.newEmailAlerts ?? true,
      browserNotifications: session.preferences.browserNotifications ?? false,
      securityAlerts: session.preferences.securityAlerts ?? true,
      productAnnouncements: session.preferences.productAnnouncements ?? false,
    });
  }, [session?.preferences]);

  useEffect(() => {
    apiFetch<{ notifications: UserNotification[] }>('/api/notifications')
      .then((res) => setUnreadCount(res.notifications.filter((n) => !n.isRead).length))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/users/me/preferences', { method: 'PATCH', body: JSON.stringify(form) });
      await refreshSession();
      notify('Notification preferences saved.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save notification preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout
      title="Notification Preferences"
      subtitle="Control workspace alerts, security notices, and browser notifications."
    >
      <div className="space-y-6">
        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            {[
              { key: 'newEmailAlerts', title: 'New Email Notifications', desc: 'Show in-app alerts when new messages arrive in Inbox.' },
              { key: 'browserNotifications', title: 'Browser Notifications', desc: 'Request desktop alerts while the workspace tab is open.' },
              { key: 'securityAlerts', title: 'Security Alerts', desc: 'Alert on sign-ins, password changes, and session revocations.' },
              { key: 'productAnnouncements', title: 'Product Announcements', desc: 'Receive occasional updates on Corivo Mail releases.' },
            ].map((item) => (
              <label key={item.key} className="flex items-start justify-between gap-4 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-[#64748B]">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={form[item.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                  className="mt-1"
                />
              </label>
            ))}
            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Notifications'}</Button>
            </div>
          </form>
        </Card>

        <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">User Notifications Inbox</p>
            <p className="text-xs text-[#64748B] mt-0.5 tabular-nums">
              {unreadCount > 0 ? `${unreadCount} unread notification(s) waiting in your inbox.` : 'All user notifications are caught up.'}
            </p>
          </div>
          <Link to="/app/account/notifications">
            <Button variant="outline" size="sm">View All Notifications</Button>
          </Link>
        </Card>
      </div>
    </SettingsLayout>
  );
}

interface StoragePayload {
  hasMailbox: boolean;
  emailAddress?: string;
  allocatedMb: number;
  usedMb: number;
  availableMb: number;
  percentUsed: number;
  breakdown?: {
    messageCount: number;
    attachmentCount: number;
    attachmentsBytes: number;
    inboxBytes: number;
    sentBytes: number;
    archiveBytes: number;
    trashBytes: number;
    spamBytes: number;
    otherBytes: number;
  };
}

export function UserStoragePage() {
  const [storage, setStorage] = useState<StoragePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<StoragePayload>('/api/users/me/storage')
      .then(setStorage)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load storage metrics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SettingsLayout title="Storage Usage" subtitle="Allocated mailbox quota, folder breakdown, and attachment usage.">
      <Card className="p-6">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <div className="flex items-center justify-between gap-4 text-xs text-[#DC2626] py-2">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : !storage || !storage.hasMailbox ? (
          <p className="text-sm text-[#64748B]">No mailbox is currently assigned to this operator account.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-[#64748B]">Mailbox Address</p>
                <p className="text-sm font-mono font-semibold">{storage.emailAddress}</p>
              </div>
              <span className="font-mono text-sm font-bold text-[#14243A] dark:text-white tabular-nums">
                {storage.percentUsed}% used
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  storage.percentUsed >= 80 ? 'bg-[#D97706]' : 'bg-[#2563EB]'
                )}
                style={{ width: `${Math.max(2, storage.percentUsed)}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
              <div className="p-3.5 rounded-lg bg-[#F7F9FC] dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800">
                <span className="text-[#64748B] block">Allocated Quota</span>
                <span className="text-base font-mono font-bold mt-1 block tabular-nums">{formatStorageMb(storage.allocatedMb)}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F7F9FC] dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800">
                <span className="text-[#64748B] block">Used Storage</span>
                <span className="text-base font-mono font-bold mt-1 block tabular-nums">{formatStorageMb(storage.usedMb)}</span>
              </div>
              <div className="p-3.5 rounded-lg bg-[#F7F9FC] dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800">
                <span className="text-[#64748B] block">Available</span>
                <span className="text-base font-mono font-bold mt-1 block tabular-nums">{formatStorageMb(storage.availableMb)}</span>
              </div>
            </div>

            {storage.breakdown && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#14243A] dark:text-white">Storage Breakdown</h3>
                  <span className="text-xs font-mono text-[#64748B] tabular-nums">
                    {storage.breakdown.messageCount} messages · {storage.breakdown.attachmentCount} attachments
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {[
                    { label: 'Inbox Messages', bytes: storage.breakdown.inboxBytes, link: '/app/mail/inbox' },
                    { label: 'Sent Messages', bytes: storage.breakdown.sentBytes, link: '/app/mail/sent' },
                    { label: 'Archive', bytes: storage.breakdown.archiveBytes, link: '/app/mail/archive' },
                    { label: 'Trash (Clean up to reclaim space)', bytes: storage.breakdown.trashBytes, link: '/app/mail/trash' },
                    { label: 'Spam', bytes: storage.breakdown.spamBytes, link: '/app/mail/spam' },
                    { label: 'Uploaded Attachments', bytes: storage.breakdown.attachmentsBytes },
                  ].map((row) => (
                    <div key={row.label} className="py-2.5 flex items-center justify-between gap-4">
                      {row.link ? (
                        <Link to={row.link} className="text-[#172033] dark:text-slate-200 hover:text-[#2563EB] hover:underline">
                          {row.label}
                        </Link>
                      ) : (
                        <span className="text-[#172033] dark:text-slate-200">{row.label}</span>
                      )}
                      <span className="font-mono text-[#64748B] tabular-nums">{formatBytes(row.bytes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </SettingsLayout>
  );
}
