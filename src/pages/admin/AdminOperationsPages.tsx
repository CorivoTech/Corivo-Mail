import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Building2,
  CreditCard,
  Download,
  FileCheck,
  HardDrive,
  Puzzle,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout.tsx';
import {
  Button,
  Card,
  DevelopmentModeNotice,
  EmptyState,
  FieldLabel,
  Input,
  Modal,
  Select,
  SkeletonRows,
  StatusText,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { formatDateTime, formatStorageMb } from '../../lib/utils.ts';
import type {
  AuditLog,
  DeliveryEvent,
  Domain,
  Organisation,
  OrganisationSetting,
  SecurityEvent,
} from '../../shared/types.ts';

// Screens 49 & 50: Security Dashboard, Activity & Security Settings
export function AdminSecurityPage({
  defaultTab = 'dashboard',
}: {
  defaultTab?: 'dashboard' | 'activity' | 'settings';
}) {
  const { session, hasPermission } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<'dashboard' | 'activity' | 'settings'>(defaultTab);
  const [data, setData] = useState<{
    summary: { failedLogins: number; blockedSpam: number; malwareAlerts: number; rateLimitTriggers: number };
    events: SecurityEvent[];
    settings: OrganisationSetting | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventQ, setEventQ] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL');
  const [minLen, setMinLen] = useState(10);
  const [requireComplexity, setRequireComplexity] = useState(true);
  const [sessionHours, setSessionHours] = useState(24);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>('/api/admin/security');
      setData(res);
      if (res.settings) {
        setMinLen(res.settings.minPasswordLength);
        setRequireComplexity(res.settings.requireComplexity);
        setSessionHours(res.settings.sessionTimeoutHours);
        setMaxAttempts(res.settings.maxLoginAttempts);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load security center';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const canManageSecurity = hasPermission('security.manage') && hasPermission('organisation.settings');

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSecurity) return;
    setSaving(true);
    try {
      await apiFetch('/api/organisations/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          minPasswordLength: minLen,
          requireComplexity,
          sessionTimeoutHours: sessionHours,
          maxLoginAttempts: maxAttempts,
        }),
      });
      notify('Organisation security policy updated.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to update policy', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredEvents = (data?.events || []).filter((ev) => {
    const matchesSev = severityFilter === 'ALL' || ev.severity === severityFilter;
    const matchesQ = !eventQ.trim() || `${ev.eventType} ${ev.summary} ${ev.actorEmail} ${ev.ipAddress}`.toLowerCase().includes(eventQ.trim().toLowerCase());
    return matchesSev && matchesQ;
  });

  const title = tab === 'settings' ? 'Security Settings' : tab === 'activity' ? 'Security Activity' : 'Security Dashboard';
  const subtitle =
    tab === 'settings'
      ? 'Password policies, session lifetimes, lockout thresholds, and 2FA readiness.'
      : 'Authentication telemetry, spam/malware protection events, and organisation password policies.';

  return (
    <AdminLayout
      title={title}
      subtitle={subtitle}
      actions={
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'dashboard', label: 'Security Dashboard' },
          { key: 'activity', label: 'Security Activity' },
          { key: 'settings', label: 'Security Settings' },
        ].map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={tab === item.key ? 'primary' : 'outline'}
            onClick={() => setTab(item.key as typeof tab)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <Card className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </Card>
      ) : (
        <>
          {tab !== 'settings' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs text-[#64748B]">Failed Logins</p>
                <p className="font-mono text-2xl font-bold text-[#14243A] dark:text-white mt-1 tabular-nums">
                  {data?.summary.failedLogins ?? '—'}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[#64748B]">Spam Blocked</p>
                <p className="font-mono text-2xl font-bold text-[#14243A] dark:text-white mt-1 tabular-nums">
                  {data?.summary.blockedSpam ?? '—'}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[#64748B]">Malware Quarantined</p>
                <p className="font-mono text-2xl font-bold text-[#DC2626] mt-1 tabular-nums">
                  {data?.summary.malwareAlerts ?? '—'}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-[#64748B]">Rate-Limit Events</p>
                <p className="font-mono text-2xl font-bold text-[#D97706] mt-1 tabular-nums">
                  {data?.summary.rateLimitTriggers ?? '—'}
                </p>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {tab !== 'settings' && (
              <Card className={`${tab === 'activity' ? 'lg:col-span-3' : 'lg:col-span-2'} overflow-hidden`}>
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold">Security Events</h2>
                    <StatusText status="ACTIVE" label="Real-time Auth Audit" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-52">
                      <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5 pointer-events-none" />
                      <Input
                        value={eventQ}
                        onChange={(e) => setEventQ(e.target.value)}
                        placeholder="Search actor, IP, event..."
                        className="pl-8 h-8 text-xs"
                      />
                    </div>
                    <div className="w-36">
                      <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}>
                        <option value="ALL">All Severities</option>
                        <option value="INFO">Info</option>
                        <option value="WARNING">Warning</option>
                        <option value="CRITICAL">Critical</option>
                      </Select>
                    </div>
                  </div>
                </div>
                {loading || !data ? (
                  <SkeletonRows rows={5} />
                ) : filteredEvents.length === 0 ? (
                  <EmptyState icon={Shield} title="No security incidents" description="No security events match the active filter." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                        <tr>
                          <th className="py-2.5 px-4 font-semibold">Event</th>
                          <th className="py-2.5 px-4 font-semibold">Actor</th>
                          <th className="py-2.5 px-4 font-semibold">IP</th>
                          <th className="py-2.5 px-4 font-semibold">Severity</th>
                          <th className="py-2.5 px-4 font-semibold">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredEvents.map((ev) => (
                          <tr key={ev.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                            <td className="py-3 px-4">
                              <p className="font-semibold">{ev.eventType.replace(/_/g, ' ')}</p>
                              <p className="text-[#64748B]">{ev.summary}</p>
                            </td>
                            <td className="py-3 px-4 font-mono">{ev.actorEmail}</td>
                            <td className="py-3 px-4 font-mono text-[#64748B]">{ev.ipAddress}</td>
                            <td className="py-3 px-4"><StatusText status={ev.severity} /></td>
                            <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] tabular-nums">
                              {formatDateTime(ev.createdAt, session?.organisation?.timezone, 'short')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {tab !== 'activity' && (
              <Card className={`${tab === 'settings' ? 'lg:col-span-2' : ''} p-6 space-y-4`}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#2563EB]" />
                  <h2 className="text-sm font-semibold">Security Policies</h2>
                </div>
                {loading || !data ? (
                  <SkeletonRows rows={4} />
                ) : (
                  <form onSubmit={handleSavePolicy} className="space-y-4">
                    <div>
                      <FieldLabel>Minimum Password Length</FieldLabel>
                      <Input
                        type="number"
                        min={8}
                        max={32}
                        value={minLen}
                        onChange={(e) => setMinLen(Number(e.target.value))}
                        disabled={!canManageSecurity}
                      />
                    </div>
                    <div>
                      <FieldLabel>Session Timeout (hours)</FieldLabel>
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        value={sessionHours}
                        onChange={(e) => setSessionHours(Number(e.target.value))}
                        disabled={!canManageSecurity}
                      />
                    </div>
                    <div>
                      <FieldLabel>Max Login Attempts Before Lockout</FieldLabel>
                      <Input
                        type="number"
                        min={3}
                        max={20}
                        value={maxAttempts}
                        onChange={(e) => setMaxAttempts(Number(e.target.value))}
                        disabled={!canManageSecurity}
                      />
                    </div>
                    <label className="flex items-start justify-between gap-4 py-2 border-y border-slate-100 dark:border-slate-800 cursor-pointer">
                      <div>
                        <p className="text-xs font-medium">Require Password Complexity</p>
                        <p className="text-[11px] text-[#64748B]">Enforce mixed-case, digit, and symbol rules on password updates.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={requireComplexity}
                        onChange={(e) => setRequireComplexity(e.target.checked)}
                        disabled={!canManageSecurity}
                        className="w-4 h-4 accent-[#2563EB] mt-0.5"
                      />
                    </label>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Mandatory 2FA (TOTP)</span>
                        <StatusText status="PLANNED" label="V1 Planned" />
                      </div>
                      <p className="text-[#64748B]">Hardware key &amp; authenticator enforcement is scheduled for V1 release.</p>
                    </div>
                    {canManageSecurity ? (
                      <Button type="submit" disabled={saving} className="w-full">
                        {saving ? 'Saving Policy...' : 'Save Security Policy'}
                      </Button>
                    ) : (
                      <p className="text-xs text-[#64748B]">Security management permission is required to modify organisation policies.</p>
                    )}
                  </form>
                )}
              </Card>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}

// Screens 51 & 52: Deliverability & Delivery Queue
export function AdminDeliverabilityPage({
  defaultTab = 'overview',
}: {
  defaultTab?: 'overview' | 'queue';
}) {
  const { session } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<'overview' | 'queue'>(defaultTab);
  const [data, setData] = useState<{
    metrics: { outboundVolume: number; accepted: number; bounced: number; deferred: number; queueSize: number; spamComplaints: number };
    trends: { day: string; accepted: number; bounced: number; deferred: number }[];
    domains: Domain[];
    queue: DeliveryEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueQ, setQueueQ] = useState('');
  const [queueStatus, setQueueStatus] = useState<'ALL' | DeliveryEvent['status']>('ALL');

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>('/api/admin/deliverability');
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load deliverability';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredQueue = (data?.queue || []).filter((ev) => {
    const matchesStatus = queueStatus === 'ALL' || ev.status === queueStatus;
    const matchesQ = !queueQ.trim() || `${ev.senderDomain} ${ev.recipientDomain} ${ev.failureReason || ''}`.toLowerCase().includes(queueQ.trim().toLowerCase());
    return matchesStatus && matchesQ;
  });

  return (
    <AdminLayout
      title={tab === 'queue' ? 'Delivery Queue' : 'Deliverability & Outbound Queue'}
      subtitle="DNS authentication alignment vs simulated/live SMTP delivery state."
      actions={
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      }
    >
      {session?.runtimeMode !== 'PRODUCTION' && (
        <DevelopmentModeNotice
          label="Development Transport Mode"
          detail="Outbound SMTP delivery states are recorded by the development MailTransportProvider. Sending to any address containing 'bounce' demonstrates a 550 bounce."
        />
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'overview', label: 'Deliverability Overview' },
          { key: 'queue', label: 'Delivery Queue' },
        ].map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={tab === item.key ? 'primary' : 'outline'}
            onClick={() => setTab(item.key as typeof tab)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <Card className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Outbound Volume</p>
              <p className="font-mono text-2xl font-bold mt-1 tabular-nums">{data?.metrics.outboundVolume ?? '—'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Accepted by Receiver</p>
              <p className="font-mono text-2xl font-bold text-[#16A34A] mt-1 tabular-nums">{data?.metrics.accepted ?? '—'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Bounced</p>
              <p className="font-mono text-2xl font-bold text-[#DC2626] mt-1 tabular-nums">{data?.metrics.bounced ?? '—'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Deferred</p>
              <p className="font-mono text-2xl font-bold text-[#D97706] mt-1 tabular-nums">{data?.metrics.deferred ?? '—'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Active Queue</p>
              <p className="font-mono text-2xl font-bold mt-1 tabular-nums">{data?.metrics.queueSize ?? '—'}</p>
            </Card>
          </div>

          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-5 lg:col-span-2">
                <h2 className="text-sm font-semibold mb-4">Outbound Delivery Volume</h2>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.trends || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="accepted" name="Accepted" fill="#2563EB" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="deferred" name="Deferred" fill="#D97706" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bounced" name="Bounced" fill="#DC2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Domain Authentication Status</h2>
                  <Link to="/admin/dns" className="text-xs text-[#2563EB] hover:underline">DNS Console</Link>
                </div>
                <p className="text-xs text-[#64748B]">
                  DNS alignment configuration is checked independently from outbound delivery logs.
                </p>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {data?.domains.map((dom) => (
                    <div key={dom.id} className="py-3 space-y-1.5">
                      <Link to={`/admin/domains/${dom.id}/dns`} className="font-mono font-semibold text-[#14243A] dark:text-white hover:text-[#2563EB]">
                        {dom.domainName}
                      </Link>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>SPF: <StatusText status={dom.spfStatus} /></div>
                        <div>DKIM: <StatusText status={dom.dkimStatus} /></div>
                        <div>DMARC: <StatusText status={dom.dmarcStatus} /></div>
                        <div>MX: <StatusText status={dom.mxStatus} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-[#2563EB]" />
                Delivery Event Log &amp; Queue
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-52">
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5 pointer-events-none" />
                  <Input
                    value={queueQ}
                    onChange={(e) => setQueueQ(e.target.value)}
                    placeholder="Filter domain or diagnostic..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <div className="w-44">
                  <Select value={queueStatus} onChange={(e) => setQueueStatus(e.target.value as typeof queueStatus)}>
                    <option value="ALL">All Queue States</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="SENT_TO_RECEIVING_SERVER">Sent to Receiver</option>
                    <option value="QUEUED">Queued</option>
                    <option value="DEFERRED">Deferred</option>
                    <option value="BOUNCED">Bounced</option>
                    <option value="FAILED">Failed</option>
                  </Select>
                </div>
              </div>
            </div>
            {loading || !data ? (
              <SkeletonRows rows={4} />
            ) : filteredQueue.length === 0 ? (
              <EmptyState icon={Send} title="No outbound events match" description="Send an email from the workspace or clear your queue filter to inspect delivery states." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Sender Domain</th>
                      <th className="py-2.5 px-4 font-semibold">Recipient Domain</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Retries</th>
                      <th className="py-2.5 px-4 font-semibold">Diagnostic</th>
                      <th className="py-2.5 px-4 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredQueue.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                        <td className="py-3 px-4 font-mono">{ev.senderDomain}</td>
                        <td className="py-3 px-4 font-mono">{ev.recipientDomain}</td>
                        <td className="py-3 px-4"><StatusText status={ev.status} /></td>
                        <td className="py-3 px-4 font-mono tabular-nums">{ev.retryCount}</td>
                        <td className="py-3 px-4 text-[#64748B]">{ev.failureReason || 'Accepted cleanly'}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] tabular-nums">
                          {formatDateTime(ev.createdAt, session?.organisation?.timezone, 'short')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </AdminLayout>
  );
}

// Screen 53: Usage & Storage
export function AdminUsageStoragePage({
  defaultTab = 'usage',
}: {
  defaultTab?: 'usage' | 'storage';
}) {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<'usage' | 'storage'>(defaultTab);
  const [data, setData] = useState<{
    allocatedMb: number;
    usedMb: number;
    availableMb: number;
    storageTrends?: { month: string; usedGb: number; quotaGb: number }[];
    mailboxes: { id: string; emailAddress: string; displayName: string; quotaMb: number; usedMb: number; percentUsed: number; status: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [quotaTarget, setQuotaTarget] = useState<{ id: string; emailAddress: string; quotaMb: number } | null>(null);
  const [quotaGbInput, setQuotaGbInput] = useState(10);
  const [savingQuota, setSavingQuota] = useState(false);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>('/api/admin/usage');
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load usage & storage';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleIncreaseQuota = async (id: string, currentMb: number) => {
    try {
      await apiFetch(`/api/mailboxes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quotaMb: currentMb + 5120 }),
      });
      notify('Increased mailbox quota by +5 GB.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Quota update failed', 'error');
    }
  };

  const handleSaveCustomQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaTarget) return;
    setSavingQuota(true);
    try {
      await apiFetch(`/api/mailboxes/${quotaTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quotaMb: quotaGbInput * 1024 }),
      });
      notify(`Updated quota for ${quotaTarget.emailAddress} to ${quotaGbInput} GB.`, 'success');
      setQuotaTarget(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Quota update failed', 'error');
    } finally {
      setSavingQuota(false);
    }
  };

  const filteredMailboxes = (data?.mailboxes || []).filter(
    (mb) => !q.trim() || `${mb.displayName} ${mb.emailAddress}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <AdminLayout
      title={tab === 'storage' ? 'Storage & Quotas' : 'Usage & Storage'}
      subtitle="Organisation storage pool, monthly growth trends, and per-mailbox quota utilisation."
      actions={
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'usage', label: 'Usage Overview' },
          { key: 'storage', label: 'Storage & Quotas' },
        ].map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={tab === item.key ? 'primary' : 'outline'}
            onClick={() => setTab(item.key as typeof tab)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <Card className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5">
              <p className="text-xs text-[#64748B]">Organisation Pool</p>
              <p className="font-mono text-2xl font-bold mt-1 tabular-nums">{data ? formatStorageMb(data.allocatedMb) : '—'}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-[#64748B]">Storage Used</p>
              <p className="font-mono text-2xl font-bold text-[#2563EB] mt-1 tabular-nums">{data ? formatStorageMb(data.usedMb) : '—'}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-[#64748B]">Available Headroom</p>
              <p className="font-mono text-2xl font-bold text-[#16A34A] mt-1 tabular-nums">{data ? formatStorageMb(data.availableMb) : '—'}</p>
            </Card>
          </div>

          {tab === 'usage' && data?.storageTrends && data.storageTrends.length > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                  Storage Growth Trend (GB)
                </h2>
                <span className="text-xs text-[#64748B] font-mono tabular-nums">
                  Current pool: {formatStorageMb(data.allocatedMb)}
                </span>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.storageTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="usedGb" name="Used (GB)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold">Mailbox Storage Breakdown</h2>
              </div>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5 pointer-events-none" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filter mailbox address..."
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
            {loading || !data ? (
              <SkeletonRows rows={5} />
            ) : filteredMailboxes.length === 0 ? (
              <EmptyState icon={HardDrive} title="No mailboxes match" description="Adjust your mailbox filter to inspect storage quotas." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Mailbox</th>
                      <th className="py-3 px-4 font-semibold">Used</th>
                      <th className="py-3 px-4 font-semibold">Quota</th>
                      <th className="py-3 px-4 font-semibold">Utilisation</th>
                      <th className="py-3 px-4 font-semibold text-right">Adjust</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredMailboxes.map((mb) => (
                      <tr key={mb.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                        <td className="py-3 px-4">
                          <Link to={`/admin/mailboxes/${mb.id}`} className="group">
                            <p className="font-semibold group-hover:text-[#2563EB]">{mb.displayName}</p>
                            <p className="font-mono text-[11px] text-[#64748B]">{mb.emailAddress}</p>
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">{formatStorageMb(mb.usedMb)}</td>
                        <td className="py-3 px-4 font-mono tabular-nums">{formatStorageMb(mb.quotaMb)}</td>
                        <td className="py-3 px-4 w-52">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${mb.percentUsed > 85 ? 'bg-[#DC2626]' : 'bg-[#2563EB]'}`}
                                style={{ width: `${mb.percentUsed}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] w-10 text-right tabular-nums">{mb.percentUsed}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {hasPermission('quotas.change') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setQuotaTarget(mb);
                                  setQuotaGbInput(Math.max(1, Math.round(mb.quotaMb / 1024)));
                                }}
                              >
                                Edit Quota
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleIncreaseQuota(mb.id, mb.quotaMb)}>
                                +5 GB
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal
        open={Boolean(quotaTarget)}
        onClose={() => setQuotaTarget(null)}
        title="Set Mailbox Storage Quota"
        description={quotaTarget?.emailAddress}
      >
        <form onSubmit={handleSaveCustomQuota} className="space-y-4">
          <div>
            <FieldLabel hint="Between 1 GB and 1000 GB">Storage Quota (GB)</FieldLabel>
            <Input
              type="number"
              min={1}
              max={1000}
              value={quotaGbInput}
              onChange={(e) => setQuotaGbInput(Number(e.target.value))}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setQuotaTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={savingQuota}>{savingQuota ? 'Saving...' : 'Save Quota'}</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}

// Screens 54-57: Organisation Profile, Preferences, Security Policy & Notifications
export function AdminOrganisationPage({
  defaultTab = 'profile',
}: {
  defaultTab?: 'profile' | 'preferences' | 'security' | 'notifications';
}) {
  const { session, refreshSession, hasPermission } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<'profile' | 'preferences' | 'security' | 'notifications'>(defaultTab);
  const [org, setOrg] = useState<Organisation | null>(null);
  const [settings, setSettings] = useState<OrganisationSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isOwner = session?.membership?.roleKey === 'OWNER';
  const canEditOrg = hasPermission('organisation.settings');

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ organisation: Organisation; settings: OrganisationSetting }>('/api/organisations/current');
      setOrg(res.organisation);
      setSettings(res.settings);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load organisation settings';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org) return;
    if (!file.type.startsWith('image/')) {
      notify('Select a PNG, JPG, SVG, or WebP logo file.', 'error');
      return;
    }
    if (file.size > 250 * 1024) {
      notify('Company logo must be 250 KB or smaller.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOrg({ ...org, logoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !canEditOrg) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: org.name,
        businessCategory: org.businessCategory,
        country: org.country,
        size: org.size,
        website: org.website,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        address: org.address,
        timezone: org.timezone,
        logoUrl: org.logoUrl,
      };
      if (isOwner) {
        payload.legalName = org.legalName;
        payload.primaryDomain = org.primaryDomain;
      }
      await apiFetch('/api/organisations/current', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refreshSession();
      notify('Organisation profile updated.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !canEditOrg) return;
    setSaving(true);
    try {
      await apiFetch('/api/organisations/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          defaultLanguage: settings.defaultLanguage,
          defaultTimezone: settings.defaultTimezone,
          dateFormat: settings.dateFormat,
          defaultQuotaMb: settings.defaultQuotaMb,
          defaultRoleKey: settings.defaultRoleKey,
          notifyDomainAlerts: settings.notifyDomainAlerts,
          notifyQuotaWarnings: settings.notifyQuotaWarnings,
          notifySecurity: settings.notifySecurity,
          notifyDelivery: settings.notifyDelivery,
        }),
      });
      notify('Organisation defaults updated.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSecurityPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch('/api/organisations/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          minPasswordLength: settings.minPasswordLength,
          requireComplexity: settings.requireComplexity,
          sessionTimeoutHours: settings.sessionTimeoutHours,
          maxLoginAttempts: settings.maxLoginAttempts,
        }),
      });
      notify('Organisation security policy updated.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save security policy', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Organisation Settings"
      subtitle="Company identity, regional defaults, security policies, and administrative notification rules."
    >
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'profile', label: 'Company Profile' },
          { key: 'preferences', label: 'Regional & Quota Defaults' },
          { key: 'security', label: 'Security Policy' },
          { key: 'notifications', label: 'Admin Notifications' },
        ].map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={tab === item.key ? 'primary' : 'outline'}
            onClick={() => setTab(item.key as typeof tab)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="p-6"><SkeletonRows rows={5} /></Card>
      ) : error || !org || !settings ? (
        <Card className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error || 'Organisation data unavailable'}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </Card>
      ) : tab === 'profile' ? (
        <Card className="p-6 max-w-3xl">
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                {org.logoUrl ? (
                  <img src={org.logoUrl} alt={`${org.name} logo`} className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="w-7 h-7 text-[#64748B]" />
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#14243A] dark:text-white">Organisation Logo</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoFile} disabled={!canEditOrg} />
                  </label>
                  {org.logoUrl && canEditOrg && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setOrg({ ...org, logoUrl: null })}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-[#64748B]">PNG, SVG, JPG, or WebP up to 250 KB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Display Name</FieldLabel>
                <Input value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} required disabled={!canEditOrg} />
              </div>
              <div>
                <FieldLabel hint={isOwner ? 'Owner only' : 'Locked (Owner only)'}>Legal Entity Name</FieldLabel>
                <Input
                  value={org.legalName}
                  onChange={(e) => setOrg({ ...org, legalName: e.target.value })}
                  disabled={!isOwner}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Website</FieldLabel>
                <Input value={org.website} onChange={(e) => setOrg({ ...org, website: e.target.value })} disabled={!canEditOrg} />
              </div>
              <div>
                <FieldLabel>Primary Contact Email</FieldLabel>
                <Input type="email" value={org.contactEmail} onChange={(e) => setOrg({ ...org, contactEmail: e.target.value })} disabled={!canEditOrg} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Contact Phone</FieldLabel>
                <Input value={org.contactPhone} onChange={(e) => setOrg({ ...org, contactPhone: e.target.value })} disabled={!canEditOrg} />
              </div>
              <div>
                <FieldLabel>Country</FieldLabel>
                <Input value={org.country} onChange={(e) => setOrg({ ...org, country: e.target.value })} disabled={!canEditOrg} />
              </div>
              <div>
                <FieldLabel>Timezone</FieldLabel>
                <Input value={org.timezone} onChange={(e) => setOrg({ ...org, timezone: e.target.value })} disabled={!canEditOrg} />
              </div>
            </div>
            <div>
              <FieldLabel>Registered Address</FieldLabel>
              <Input value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} disabled={!canEditOrg} />
            </div>
            {canEditOrg ? (
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Building2 className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Company Profile'}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[#64748B]">Organisation settings permission is required to modify profile fields.</p>
            )}
          </form>
        </Card>
      ) : tab === 'preferences' ? (
        <Card className="p-6 max-w-2xl">
          <form onSubmit={saveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Default Language</FieldLabel>
                <Select value={settings.defaultLanguage} onChange={(e) => setSettings({ ...settings, defaultLanguage: e.target.value })} disabled={!canEditOrg}>
                  <option value="en-IN">English (India)</option>
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Date Format</FieldLabel>
                <Select value={settings.dateFormat} onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })} disabled={!canEditOrg}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Default Timezone</FieldLabel>
                <Select value={settings.defaultTimezone} onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })} disabled={!canEditOrg}>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Asia/Singapore">Asia/Singapore</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Default New User Role</FieldLabel>
                <Select value={settings.defaultRoleKey} onChange={(e) => setSettings({ ...settings, defaultRoleKey: e.target.value as 'ADMIN' | 'MAILBOX_USER' })} disabled={!canEditOrg}>
                  <option value="MAILBOX_USER">Mailbox User</option>
                  <option value="ADMIN">Organisation Admin</option>
                </Select>
              </div>
            </div>
            <div>
              <FieldLabel>Default New Mailbox Quota (MB)</FieldLabel>
              <Input
                type="number"
                min={1024}
                step={1024}
                value={settings.defaultQuotaMb}
                onChange={(e) => setSettings({ ...settings, defaultQuotaMb: Number(e.target.value) })}
                disabled={!canEditOrg}
              />
            </div>
            {canEditOrg && (
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Defaults'}</Button>
              </div>
            )}
          </form>
        </Card>
      ) : tab === 'security' ? (
        <Card className="p-6 max-w-2xl">
          <form onSubmit={saveSecurityPolicy} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Minimum Password Length</FieldLabel>
                <Input
                  type="number"
                  min={8}
                  max={32}
                  value={settings.minPasswordLength}
                  onChange={(e) => setSettings({ ...settings, minPasswordLength: Number(e.target.value) })}
                />
              </div>
              <div>
                <FieldLabel>Session Timeout (hours)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={settings.sessionTimeoutHours}
                  onChange={(e) => setSettings({ ...settings, sessionTimeoutHours: Number(e.target.value) })}
                />
              </div>
              <div>
                <FieldLabel>Max Login Attempts</FieldLabel>
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={settings.maxLoginAttempts}
                  onChange={(e) => setSettings({ ...settings, maxLoginAttempts: Number(e.target.value) })}
                />
              </div>
            </div>
            <label className="flex items-start justify-between gap-4 py-2 border-y border-slate-100 dark:border-slate-800 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Require Password Complexity</p>
                <p className="text-xs text-[#64748B]">Enforce uppercase, lowercase, number, and symbol characters across mailboxes.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.requireComplexity}
                onChange={(e) => setSettings({ ...settings, requireComplexity: e.target.checked })}
                className="w-4 h-4 accent-[#2563EB] mt-1"
              />
            </label>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">Organisation-wide 2FA Enforcement</span>
                <StatusText status="PLANNED" label="V1 Planned" />
              </div>
              <p className="text-[#64748B]">Mandatory TOTP &amp; WebAuthn enrollment for all members is scheduled for V1 release.</p>
            </div>
            <div className="pt-2 flex justify-end">
              {hasPermission('security.manage') && canEditOrg ? (
                <Button type="submit" disabled={saving}>
                  <ShieldAlert className="w-4 h-4" />
                  {saving ? 'Saving Policy...' : 'Save Security Policy'}
                </Button>
              ) : (
                <p className="text-xs text-[#64748B]">Security management permission is required to modify organisation policies.</p>
              )}
            </div>
          </form>
        </Card>
      ) : (
        <Card className="p-6 max-w-2xl">
          <form onSubmit={saveSettings} className="space-y-4">
            {[
              { key: 'notifyDomainAlerts', label: 'Domain & DNS Verification Alerts', desc: 'Notify admins when MX, SPF, DKIM, or DMARC status changes.' },
              { key: 'notifyQuotaWarnings', label: 'Mailbox Quota Threshold Warnings', desc: 'Alert admins when any mailbox exceeds 85% storage capacity.' },
              { key: 'notifySecurity', label: 'Security & Sign-in Alerts', desc: 'Immediate alerts on suspicious login attempts or quarantines.' },
              { key: 'notifyDelivery', label: 'Outbound Delivery Alerts', desc: 'Digest when outbound messages bounce or defer.' },
            ].map((item) => (
              <label key={item.key} className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-[#64748B]">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings[item.key as keyof OrganisationSetting])}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  disabled={!canEditOrg}
                  className="w-4 h-4 accent-[#2563EB] mt-1"
                />
              </label>
            ))}
            {canEditOrg && (
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Notification Rules'}</Button>
              </div>
            )}
          </form>
        </Card>
      )}
    </AdminLayout>
  );
}

// Screen 58: Admin Activity & Compliance Audit Logs
export function AdminAuditLogsPage({
  defaultCategory = 'ALL',
}: {
  defaultCategory?: 'ALL' | 'ADMIN_ACTIVITY' | 'COMPLIANCE_AUDIT';
}) {
  const { session } = useAuth();
  const { notify } = useToast();
  const [category, setCategory] = useState<'ALL' | 'ADMIN_ACTIVITY' | 'COMPLIANCE_AUDIT'>(defaultCategory);
  const [resultFilter, setResultFilter] = useState<'ALL' | 'SUCCESS' | 'DENIED' | 'FAILED'>('ALL');
  const [q, setQ] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ logs: AuditLog[] }>(`/api/admin/audit-logs?category=${category}`);
      setLogs(res.logs);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Access denied or failed to load audit logs';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [category, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = logs.filter((log) => {
    const matchesResult = resultFilter === 'ALL' || log.result === resultFilter;
    const matchesQ = !q.trim() || `${log.actorEmail} ${log.action} ${log.resource}`.toLowerCase().includes(q.trim().toLowerCase());
    return matchesResult && matchesQ;
  });

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Category', 'Actor', 'Action', 'Resource', 'Result'];
    const rows = filtered.map((l) => [l.createdAt, l.category, l.actorEmail, l.action, l.resource, l.result]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corivo-audit-${category.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${filtered.length} audit entries.`, 'info');
  };

  return (
    <AdminLayout
      title={category === 'ADMIN_ACTIVITY' ? 'Admin Activity' : 'Audit Logs (V2)'}
      subtitle="Distinguishes operational Admin Activity from formal Compliance Audit records."
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      }
    >
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by actor, action, resource..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
              <option value="ALL">All Categories</option>
              <option value="ADMIN_ACTIVITY">Admin Activity</option>
              <option value="COMPLIANCE_AUDIT">Compliance Audit</option>
            </Select>
          </div>
          <div className="w-36">
            <Select value={resultFilter} onChange={(e) => setResultFilter(e.target.value as typeof resultFilter)}>
              <option value="ALL">All Results</option>
              <option value="SUCCESS">Success</option>
              <option value="DENIED">Denied</option>
              <option value="FAILED">Failed</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <div className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
            <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
            <Button size="sm" variant="outline" onClick={load}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileCheck} title="No audit events match" description="Administrative actions are recorded automatically." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Category</th>
                  <th className="py-3 px-4 font-semibold">Actor</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Resource</th>
                  <th className="py-3 px-4 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                    <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] tabular-nums">
                      {formatDateTime(log.createdAt, session?.organisation?.timezone, 'full')}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {log.category === 'COMPLIANCE_AUDIT' ? 'Compliance Audit' : 'Admin Activity'}
                    </td>
                    <td className="py-3 px-4 font-mono">{log.actorEmail}</td>
                    <td className="py-3 px-4 font-mono">{log.action}</td>
                    <td className="py-3 px-4 text-[#64748B]">{log.resource}</td>
                    <td className="py-3 px-4"><StatusText status={log.result} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}

// Screens 59, 60, 72: Billing, Subscription & Invoices (V1 Sandbox)
export function AdminBillingPage({
  defaultTab = 'overview',
}: {
  defaultTab?: 'overview' | 'subscription' | 'invoices';
}) {
  const { notify } = useToast();
  const [tab, setTab] = useState<'overview' | 'subscription' | 'invoices'>(defaultTab);
  const [data, setData] = useState<{
    billingMode: string;
    currentPlan: { name: string; pricePerSeatInr: number; seatsAllocated: number; seatsUsed: number; status: string; renewalDate: string };
    plans: { code: string; name: string; priceInr: number; quotaPerMailboxGb: number; description: string }[];
    invoices: { invoiceNumber: string; issuedAt: string; amountInr: number; gstInr: number; status: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>('/api/admin/billing');
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load billing workspace';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminLayout
      title={tab === 'subscription' ? 'Subscription Plans & Seats (V1)' : 'Billing & Subscription (V1)'}
      subtitle="Illustrative INR seat pricing and GST invoice preview. Live Razorpay checkout requires production keys."
    >
      <DevelopmentModeNotice
        label="Billing Gateway Unconfigured (Sandbox)"
        detail="RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured in this workspace. Plan upgrades and invoices shown here are illustrative only; no payment is processed."
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'overview', label: 'Billing Overview' },
          { key: 'subscription', label: 'Subscription Plans' },
          { key: 'invoices', label: 'Illustrative Invoices' },
        ].map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={tab === item.key ? 'primary' : 'outline'}
            onClick={() => setTab(item.key as typeof tab)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card className="p-6"><SkeletonRows rows={5} /></Card>
      ) : error || !data ? (
        <Card className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error || 'Billing data unavailable'}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </Card>
      ) : (
        <>
          {(tab === 'overview' || tab === 'subscription') && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6 lg:col-span-2 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[#64748B]">Current Workspace Tier</p>
                    <h2 className="font-display text-xl font-bold text-[#14243A] dark:text-white mt-0.5">
                      {data.currentPlan.name}
                    </h2>
                  </div>
                  <StatusText status="SANDBOX" label="Illustrative Plan" />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[#64748B] block">Indicative Rate</span>
                    <span className="font-mono text-base font-bold mt-0.5 block">₹{data.currentPlan.pricePerSeatInr}/seat/mo</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Active Seats</span>
                    <span className="font-mono text-base font-bold mt-0.5 block tabular-nums">
                      {data.currentPlan.seatsUsed} / {data.currentPlan.seatsAllocated}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Payment Gateway</span>
                    <span className="font-medium mt-0.5 block">Razorpay (Unavailable)</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#2563EB]" />
                  <h3 className="text-sm font-semibold">GST &amp; Payment Method</h3>
                </div>
                <p className="text-xs text-[#64748B]">
                  Live Indian GST billing and corporate card mandates become active when Razorpay credentials are connected.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => notify('Billing is in illustrative sandbox mode. Configure Razorpay credentials for live checkout.', 'info')}
                >
                  Configure Payment Method (Unavailable)
                </Button>
              </Card>
            </div>
          )}

          {(tab === 'overview' || tab === 'subscription') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {data.plans.map((p) => (
                <Card key={p.code} className="p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold">{p.name}</h3>
                    <p className="text-xs text-[#64748B] mt-1">{p.description}</p>
                    <p className="font-mono text-2xl font-bold text-[#14243A] dark:text-white mt-4 tabular-nums">
                      ₹{p.priceInr}
                      <span className="text-xs font-normal text-[#64748B]"> / mailbox / mo</span>
                    </p>
                    <p className="text-xs text-[#64748B] mt-1">{p.quotaPerMailboxGb} GB mailbox quota</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-5 w-full"
                    onClick={() => notify(`Plan selection (${p.name}) is disabled while payment gateway is in sandbox mode.`, 'warning')}
                  >
                    Select Plan (Sandbox)
                  </Button>
                </Card>
              ))}
            </div>
          )}

          {(tab === 'overview' || tab === 'invoices') && (
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold">Illustrative Invoice History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Invoice #</th>
                      <th className="py-2.5 px-4 font-semibold">Date</th>
                      <th className="py-2.5 px-4 font-semibold">Amount (INR)</th>
                      <th className="py-2.5 px-4 font-semibold">GST (18%)</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.invoices.map((inv) => (
                      <tr key={inv.invoiceNumber}>
                        <td className="py-3 px-4 font-mono font-semibold">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 font-mono text-[#64748B] tabular-nums">{formatDateTime(inv.issuedAt, 'Asia/Kolkata', 'short')}</td>
                        <td className="py-3 px-4 font-mono tabular-nums">₹{inv.amountInr}</td>
                        <td className="py-3 px-4 font-mono tabular-nums">₹{inv.gstInr}</td>
                        <td className="py-3 px-4"><StatusText status="ILLUSTRATIVE" label="Illustrative" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </AdminLayout>
  );
}

// Screen 77: Integrations & API Catalog (V2 Planned Preview)
export function AdminIntegrationsPage() {
  const { notify } = useToast();
  const [catalog, setCatalog] = useState<{ id: string; name: string; category: string; status: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ catalog: typeof catalog }>('/api/integrations');
      setCatalog(res.catalog);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load integrations catalog';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminLayout
      title="Integrations & Developer API (V2)"
      subtitle="Planned API keys, delivery webhooks, and enterprise SSO integrations."
    >
      <Card className="p-4 flex items-center gap-3 text-xs text-[#64748B]">
        <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
        <span>This catalog previews V2 enterprise integrations. Live webhook signing and OIDC SSO are planned for the next milestone.</span>
      </Card>

      {loading ? (
        <Card className="p-6"><SkeletonRows rows={4} /></Card>
      ) : error ? (
        <Card className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <Button size="sm" variant="outline" onClick={load}>Retry</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {catalog.map((item) => (
            <Card key={item.id} className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-[#2563EB]" />
                    <h3 className="text-sm font-semibold">{item.name}</h3>
                  </div>
                  <StatusText status={item.status} />
                </div>
                <p className="text-xs text-[#64748B] mt-2">{item.description}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-mono text-[#94A3B8]">{item.category}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => notify(`${item.name} is currently ${item.status.toLowerCase()} for V2 release.`, 'info')}
                >
                  Preview Spec
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
