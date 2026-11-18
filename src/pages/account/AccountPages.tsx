import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  ShieldCheck,
  Sliders,
  User,
} from 'lucide-react';
import { WorkspaceShell } from '../../components/layout/WorkspaceShell.tsx';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Input,
  SkeletonRows,
  StatusText,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { cn, formatDateTime } from '../../lib/utils.ts';
import type { SecurityEvent, UserNotification } from '../../shared/types.ts';

function AccountLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const links = [
    { to: '/app/account/profile', label: 'Profile Overview', icon: User },
    { to: '/app/account/personal-information', label: 'Personal Information', icon: Camera },
    { to: '/app/account/security', label: 'Account Security', icon: ShieldCheck },
    { to: '/app/account/password', label: 'Change Password', icon: KeyRound },
    { to: '/app/account/sessions', label: 'Active Sessions', icon: Laptop },
    { to: '/app/account/notifications', label: 'User Notifications', icon: Bell },
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
            <div className="flex items-center gap-2">
              {actions}
              <Link to="/app/settings">
                <Button variant="outline" size="sm">Open Settings Centre</Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <aside className="md:col-span-3 space-y-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
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
                  to="/app/settings/general"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#64748B] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                >
                  <Sliders className="w-4 h-4 shrink-0" />
                  <span>Personal Preferences</span>
                </Link>
                <Link
                  to="/app/settings/storage"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#64748B] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                >
                  <HardDrive className="w-4 h-4 shrink-0" />
                  <span>Storage Usage</span>
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

export function AccountProfilePage() {
  const { session } = useAuth();
  if (!session) return null;
  const tz = session.preferences.timezone;

  return (
    <AccountLayout
      title="Profile Overview"
      subtitle="Your identity, organisation membership, and quick account security actions."
    >
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <Avatar name={session.user.displayName} src={session.user.avatarUrl} size="lg" />
              <div>
                <h2 className="text-lg font-bold text-[#14243A] dark:text-white">{session.user.displayName}</h2>
                <p className="text-sm font-mono text-[#64748B]">{session.user.email}</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  {session.organisation?.name || 'Corivo Platform'} · {session.membership?.roleKey.replace(/_/g, ' ') || 'Operator'}
                </p>
              </div>
            </div>
            <Link to="/app/account/personal-information">
              <Button variant="outline">Edit Profile &amp; Photo</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-6 text-sm">
            <div>
              <span className="text-xs text-[#64748B] block">Job Title</span>
              <span className="font-medium">{session.user.jobTitle || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-xs text-[#64748B] block">Department</span>
              <span className="font-medium">{session.user.department || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-xs text-[#64748B] block">Phone Number</span>
              <span className="font-mono tabular-nums">{session.user.phone || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-xs text-[#64748B] block">Account Created</span>
              <span className="font-mono tabular-nums">
                {formatDateTime(session.user.createdAt, tz, 'full', session.preferences)}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/app/account/password">
            <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
              <KeyRound className="w-5 h-5 text-[#2563EB] mb-2" />
              <p className="text-sm font-semibold">Change Password</p>
              <p className="text-xs text-[#64748B] mt-1">Update your login credentials</p>
            </Card>
          </Link>
          <Link to="/app/account/sessions">
            <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
              <Laptop className="w-5 h-5 text-[#2563EB] mb-2" />
              <p className="text-sm font-semibold">Active Sessions</p>
              <p className="text-xs text-[#64748B] mt-1">Review active devices and sign out</p>
            </Card>
          </Link>
          <Link to="/app/account/notifications">
            <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
              <Bell className="w-5 h-5 text-[#2563EB] mb-2" />
              <p className="text-sm font-semibold">User Notifications</p>
              <p className="text-xs text-[#64748B] mt-1">View recent workspace alerts</p>
            </Card>
          </Link>
          <Link to="/app/settings/general">
            <Card className="p-5 hover:border-[#2563EB] transition-colors h-full">
              <Lock className="w-5 h-5 text-[#2563EB] mb-2" />
              <p className="text-sm font-semibold">Personal Preferences</p>
              <p className="text-xs text-[#64748B] mt-1">Language, timezone, theme, density</p>
            </Card>
          </Link>
        </div>
      </div>
    </AccountLayout>
  );
}

const ALLOWED_PHOTO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);

export function PersonalInformationPage() {
  const { session, refreshSession } = useAuth();
  const { notify } = useToast();

  const buildInitial = (u: typeof session) => ({
    firstName: u?.user.firstName || '',
    lastName: u?.user.lastName || '',
    displayName: u?.user.displayName || '',
    jobTitle: u?.user.jobTitle || '',
    department: u?.user.department || '',
    phone: u?.user.phone || '',
    avatarUrl: (u?.user.avatarUrl || null) as string | null,
  });

  const [form, setForm] = useState(() => buildInitial(session));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session) {
      setForm(buildInitial(session));
    }
  }, [session]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      notify('Please upload a PNG, JPG, WebP, or SVG image.', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 250 * 1024) {
      notify('Profile photo must be 250 KB or smaller.', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, avatarUrl: String(reader.result || '') }));
      notify('Photo staged. Click Save Changes to persist.', 'info');
    };
    reader.onerror = () => notify('Unable to read image file.', 'error');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/users/me', { method: 'PATCH', body: JSON.stringify(form) });
      await refreshSession();
      notify('Personal information updated.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountLayout
      title="Personal Information & Photo"
      subtitle="Update your profile photo, display name, job title, department, and contact phone."
    >
      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex flex-wrap items-center gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <Avatar name={form.displayName || 'User'} src={form.avatarUrl} size="lg" />
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-[#14243A] dark:text-white">Profile Photo</p>
              <p className="text-xs text-[#64748B]">PNG, JPG, WebP, or SVG up to 250 KB.</p>
              <div className="flex items-center gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap">
                  <Camera className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
                {form.avatarUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((prev) => ({ ...prev, avatarUrl: null }))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="pi-fn">First Name</FieldLabel>
              <Input id="pi-fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <FieldLabel htmlFor="pi-ln">Last Name</FieldLabel>
              <Input id="pi-ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="pi-dn">Display Name</FieldLabel>
              <Input id="pi-dn" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
            </div>
            <div>
              <FieldLabel htmlFor="pi-email" hint="Managed by Admin">Business Email</FieldLabel>
              <Input id="pi-email" value={session?.user.email || ''} disabled className="bg-slate-100 dark:bg-slate-900 cursor-not-allowed" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel htmlFor="pi-jt">Job Title</FieldLabel>
              <Input id="pi-jt" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="pi-dept">Department</FieldLabel>
              <Input id="pi-dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <FieldLabel htmlFor="pi-ph">Phone Number</FieldLabel>
              <Input id="pi-ph" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9800000000" />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setForm(buildInitial(session))}
            >
              Reset
            </Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Card>
    </AccountLayout>
  );
}

export function AccountSecurityPage() {
  const { session } = useAuth();
  const { notify, confirm } = useToast();
  const [sessionsCount, setSessionsCount] = useState(0);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ sessions: unknown[]; recentEvents: SecurityEvent[] }>('/api/users/me/sessions')
      .then((res) => {
        setSessionsCount(res.sessions.length);
        setEvents(res.recentEvents);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Unable to load account security telemetry');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const signOutOthers = async () => {
    const ok = await confirm({
      title: 'Sign out all other sessions?',
      description: 'Every other browser and device signed into your account will be logged out immediately.',
      confirmLabel: 'Sign Out Others',
      destructive: true,
    });
    if (!ok) return;
    setRevokingOthers(true);
    try {
      await apiFetch('/api/users/me/sessions/others', { method: 'DELETE' });
      notify('Signed out all other sessions.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to sign out other sessions', 'error');
    } finally {
      setRevokingOthers(false);
    }
  };

  return (
    <AccountLayout
      title="Account Security"
      subtitle="Review password status, active sessions, and recent sign-in activity."
    >
      <div className="space-y-6">
        <Card className="p-6 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="pb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Password Status</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                Last updated{' '}
                <span className="font-mono tabular-nums">
                  {formatDateTime(session?.user.passwordUpdatedAt, session?.preferences.timezone, 'full', session?.preferences)}
                </span>
              </p>
            </div>
            <Link to="/app/account/password"><Button variant="outline" size="sm">Change Password</Button></Link>
          </div>

          <div className="py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Active Sessions</p>
              <p className="text-xs text-[#64748B] mt-0.5 font-mono tabular-nums">
                {loading ? 'Checking...' : `${sessionsCount} active session(s)`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {sessionsCount > 1 && (
                <Button variant="outline" size="sm" onClick={signOutOthers} disabled={revokingOthers}>
                  {revokingOthers ? 'Signing out...' : 'Sign Out Other Sessions'}
                </Button>
              )}
              <Link to="/app/account/sessions"><Button variant="ghost" size="sm">Manage Sessions</Button></Link>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Two-Factor Authentication (TOTP 2FA) &amp; Trusted Devices</p>
              <p className="text-xs text-[#64748B] mt-0.5">
                Planned for V1 release — TOTP authenticator enrolment is not yet active on this environment.
              </p>
            </div>
            <StatusText status="PLANNED" label="V1 Planned" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Recent Account Activity</h3>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
          {loading ? (
            <SkeletonRows rows={4} />
          ) : error ? (
            <div className="flex items-center justify-between gap-4 text-xs text-[#DC2626] py-2">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={load}>Retry</Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {events.length === 0 ? (
                <p className="text-[#64748B]">No recent activity logged.</p>
              ) : (
                events.map((ev) => (
                  <div key={ev.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-[#172033] dark:text-slate-100">{ev.summary}</p>
                      <p className="font-mono text-[#94A3B8] mt-0.5 tabular-nums">IP: {ev.ipAddress}</p>
                    </div>
                    <span className="font-mono text-[#64748B] shrink-0 tabular-nums">
                      {formatDateTime(ev.createdAt, session?.preferences.timezone, 'full', session?.preferences)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </AccountLayout>
  );
}

export function ChangePasswordPage() {
  const { notify } = useToast();
  const [minLength, setMinLength] = useState(10);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    invalidateOtherSessions: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ passwordPolicy?: { minPasswordLength: number } }>('/api/users/me/sessions')
      .then((res) => {
        if (res.passwordPolicy?.minPasswordLength) {
          setMinLength(res.passwordPolicy.minPasswordLength);
        }
      })
      .catch(() => {});
  }, []);

  const checks = [
    { label: `At least ${minLength} characters`, ok: form.newPassword.length >= minLength },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(form.newPassword) },
    { label: 'One lowercase letter', ok: /[a-z]/.test(form.newPassword) },
    { label: 'One number', ok: /[0-9]/.test(form.newPassword) },
    { label: 'One special character', ok: /[^A-Za-z0-9]/.test(form.newPassword) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      notify('New passwords do not match.', 'error');
      return;
    }
    if (checks.some((c) => !c.ok)) {
      notify('New password does not meet all security requirements.', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '', invalidateOtherSessions: true });
      notify('Password updated successfully.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to change password', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccountLayout
      title="Change Password"
      subtitle={`Enforces organisation policy: at least ${minLength} characters with mixed case, number, and symbol.`}
    >
      <Card className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="cp-cur">Current Password</FieldLabel>
            <Input
              id="cp-cur"
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="cp-new">New Password</FieldLabel>
            <Input
              id="cp-new"
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="cp-conf">Confirm New Password</FieldLabel>
            <Input
              id="cp-conf"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              error={
                form.confirmPassword && form.confirmPassword !== form.newPassword
                  ? 'Passwords do not match'
                  : undefined
              }
              required
            />
          </div>

          <div className="rounded-lg bg-[#F7F9FC] dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
            <p className="text-xs font-semibold text-[#14243A] dark:text-slate-200 mb-1">Password Requirements</p>
            {checks.map((rule) => (
              <div key={rule.label} className="flex items-center gap-2 text-xs">
                <CheckCircle2
                  className={cn('w-3.5 h-3.5 shrink-0', rule.ok ? 'text-[#16A34A]' : 'text-slate-300 dark:text-slate-600')}
                />
                <span className={rule.ok ? 'text-[#16A34A] font-medium' : 'text-[#64748B]'}>{rule.label}</span>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#64748B] cursor-pointer">
            <input
              type="checkbox"
              checked={form.invalidateOtherSessions}
              onChange={(e) => setForm({ ...form, invalidateOtherSessions: e.target.checked })}
            />
            <span>Sign out all other active sessions after updating password</span>
          </label>
          <Button type="submit" disabled={saving}>{saving ? 'Updating...' : 'Update Password'}</Button>
        </form>
      </Card>
    </AccountLayout>
  );
}

interface SessionView {
  id: string;
  device: string;
  browser: string;
  ipAddress: string;
  location: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

export function ActiveSessionsPage() {
  const { session } = useAuth();
  const { notify, confirm } = useToast();
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ sessions: SessionView[] }>('/api/users/me/sessions')
      .then((res) => setSessions(res.sessions))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load active sessions'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    const isAllOthers = id === 'others';
    const ok = await confirm({
      title: isAllOthers ? 'Sign out all other sessions?' : 'Sign out this session?',
      description: isAllOthers
        ? 'All other active browser sessions will be terminated.'
        : 'This device will need to sign in again to access Corivo Mail.',
      confirmLabel: isAllOthers ? 'Sign Out All Others' : 'Sign Out Session',
      destructive: true,
    });
    if (!ok) return;

    setRevokingId(id);
    try {
      await apiFetch(`/api/users/me/sessions/${id}`, { method: 'DELETE' });
      notify(isAllOthers ? 'All other sessions signed out.' : 'Session signed out.', 'info');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to sign out session', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <AccountLayout
      title="Active Sessions"
      subtitle="Authenticated devices currently signed in to your Corivo Mail account."
    >
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <span className="text-sm font-semibold tabular-nums">Sessions ({sessions.length})</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              Refresh
            </Button>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => revoke('others')}
                disabled={revokingId === 'others'}
              >
                {revokingId === 'others' ? 'Signing out...' : 'Sign Out All Other Sessions'}
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={3} />
        ) : error ? (
          <div className="flex items-center justify-between gap-4 text-xs text-[#DC2626] py-2">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={Laptop} title="No active sessions" description="Only your current session is active." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {sessions.map((s) => (
              <div key={s.id} className="py-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{s.browser} on {s.device}</span>
                    {s.isCurrent && <StatusText status="ACTIVE" label="Current Session" />}
                  </div>
                  <p className="text-[#64748B] font-mono mt-1 tabular-nums">
                    IP: {s.ipAddress} · Location: {s.location || 'Not resolved'} · Last active:{' '}
                    {formatDateTime(s.lastActiveAt, session?.preferences.timezone, 'full', session?.preferences)}
                  </p>
                </div>
                {!s.isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revoke(s.id)}
                    disabled={revokingId === s.id}
                  >
                    {revokingId === s.id ? 'Signing out...' : 'Sign Out'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </AccountLayout>
  );
}

export function UserNotificationsPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<{ notifications: UserNotification[] }>('/api/notifications')
      .then((res) => setNotifications(res.notifications))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Unable to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (id === 'all') {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        notify('All notifications marked as read.', 'success');
      } else {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to update notification status', 'error');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const visible = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <AccountLayout
      title="User Notifications"
      subtitle="Review workspace alerts, security notices, and delivery updates."
      actions={
        <Link to="/app/settings/notifications">
          <Button variant="outline" size="sm">Notification Preferences</Button>
        </Link>
      }
    >
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1 bg-[#F1F5F9] dark:bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'px-3 py-1 rounded-md font-medium cursor-pointer',
                filter === 'all' ? 'bg-white dark:bg-[#111A2E] text-[#14243A] dark:text-white shadow-xs' : 'text-[#64748B]'
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={cn(
                'px-3 py-1 rounded-md font-medium cursor-pointer',
                filter === 'unread' ? 'bg-white dark:bg-[#111A2E] text-[#14243A] dark:text-white shadow-xs' : 'text-[#64748B]'
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>Refresh</Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => markRead('all')}>
                <Check className="w-3.5 h-3.5" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <div className="flex items-center justify-between gap-4 text-xs text-[#DC2626] py-2">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={load}>Retry</Button>
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="Security, mailbox, and workspace alerts for your account will appear here."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'py-4 flex flex-wrap items-start justify-between gap-4',
                  !n.isRead && 'bg-[#2563EB]/[0.03] -mx-3 px-3 rounded-lg'
                )}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusText status={n.severity} label={n.severity} />
                    <span className="text-sm font-semibold text-[#14243A] dark:text-white">{n.title}</span>
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">{n.message}</p>
                  <p className="text-[11px] font-mono text-[#94A3B8] tabular-nums">
                    {formatDateTime(n.createdAt, session?.preferences.timezone, 'full', session?.preferences)}
                  </p>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                    Mark Read
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </AccountLayout>
  );
}
