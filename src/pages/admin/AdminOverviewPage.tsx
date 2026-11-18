import { useCallback, useEffect, useState } from 'react';
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
import { AlertTriangle, Globe, MailPlus, RefreshCw, ShieldAlert, UserPlus } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout.tsx';
import { Button, Card, SkeletonRows, StatusText } from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { formatDateTime, formatStorageMb } from '../../lib/utils.ts';
import type { AuditLog, Domain, SecurityEvent } from '../../shared/types.ts';

interface OverviewResponse {
  kpis: {
    totalMailboxes: number;
    activeMailboxes: number;
    connectedDomains: number;
    verifiedDomains: number;
    totalUsedMb: number;
    totalQuotaMb: number;
    securityAlerts: number;
  };
  mailboxGrowthSeries: { month: string; mailboxes: number; storageGb: number }[];
  domains: Domain[];
  recentActivity: AuditLog[];
  recentSecurity: SecurityEvent[];
}

export function AdminOverviewPage() {
  const { session, hasPermission } = useAuth();
  const { notify } = useToast();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<OverviewResponse>('/api/admin/overview');
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load organisation overview';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const tz = session?.preferences.timezone || 'Asia/Kolkata';

  return (
    <AdminLayout
      title="Organisation Overview"
      subtitle={`Operational summary for ${session?.organisation?.name || 'your organisation'}.`}
      actions={
        <>
          {hasPermission('domains.manage') && (
            <Link to="/admin/domains/add">
              <Button variant="outline" size="sm">
                <Globe className="w-3.5 h-3.5" />
                Add Domain
              </Button>
            </Link>
          )}
          {hasPermission('mailboxes.create') && (
            <Link to="/admin/mailboxes/create">
              <Button size="sm">
                <MailPlus className="w-3.5 h-3.5" />
                Create Mailbox
              </Button>
            </Link>
          )}
        </>
      }
    >
      {loading ? (
        <Card className="p-6"><SkeletonRows rows={6} /></Card>
      ) : error || !data ? (
        <Card className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-[#DC2626]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error || 'Overview telemetry unavailable.'}</span>
          </div>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {/* 6 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Mailboxes', val: String(data.kpis.totalMailboxes) },
              { label: 'Active Mailboxes', val: String(data.kpis.activeMailboxes) },
              { label: 'Connected Domains', val: String(data.kpis.connectedDomains) },
              { label: 'Domain Health', val: `${data.kpis.verifiedDomains}/${data.kpis.connectedDomains} Verified` },
              { label: 'Storage Used', val: formatStorageMb(data.kpis.totalUsedMb) },
              { label: 'Security Alerts', val: String(data.kpis.securityAlerts) },
            ].map((k) => (
              <Card key={k.label} className="p-4">
                <p className="text-xs text-[#64748B]">{k.label}</p>
                <p className="font-mono text-xl font-bold text-[#14243A] dark:text-white mt-1.5 tabular-nums">
                  {k.val}
                </p>
              </Card>
            ))}
          </div>

          {/* Charts & Domain Health */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-7 p-5">
              <h2 className="text-sm font-semibold text-[#14243A] dark:text-white mb-4">
                Mailbox Provisioning &amp; Storage Growth
              </h2>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.mailboxGrowthSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="mailboxes" name="Mailboxes" fill="#2563EB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="storageGb" name="Storage (GB)" fill="#14243A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="lg:col-span-5 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[#14243A] dark:text-white">Domain Health</h2>
                  <Link to="/admin/domains" className="text-xs text-[#2563EB] hover:underline">Manage all</Link>
                </div>
                <div className="space-y-3">
                  {data.domains.map((dom) => (
                    <Link
                      key={dom.id}
                      to={`/admin/domains/${dom.id}`}
                      className="block p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#2563EB]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold">{dom.domainName}</span>
                        <StatusText status={dom.ownershipStatus} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#64748B]">
                        <span>MX: {dom.mxStatus}</span>
                        <span>SPF: {dom.spfStatus}</span>
                        <span>DKIM: {dom.dkimStatus}</span>
                        <span>DMARC: {dom.dmarcStatus}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[#64748B]">Org Storage Allocation</span>
                <span className="font-mono font-semibold">
                  {formatStorageMb(data.kpis.totalUsedMb)} / {formatStorageMb(data.kpis.totalQuotaMb)}
                </span>
              </div>
            </Card>
          </div>

          {/* Activity & Security Events */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Recent Administrative Activity</h2>
                <Link to="/admin/audit-logs" className="text-xs text-[#2563EB] hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.recentActivity.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{act.action.replace(/_/g, ' ')} — {act.resource}</p>
                      <p className="text-[#64748B] font-mono truncate">{act.actorEmail}</p>
                    </div>
                    <StatusText status={act.result} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Recent Security Events</h2>
                <Link to="/admin/security" className="text-xs text-[#2563EB] hover:underline">Security dashboard</Link>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.recentSecurity.map((ev) => (
                  <div key={ev.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{ev.summary}</p>
                      <p className="text-[#64748B] font-mono truncate">{ev.actorEmail} · {ev.ipAddress}</p>
                    </div>
                    <span className="font-mono text-[11px] text-[#94A3B8] shrink-0">
                      {formatDateTime(ev.createdAt, tz, 'short')}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-[#64748B]">
              Quick administrative actions for <strong className="text-[#172033] dark:text-white">{session?.organisation?.name}</strong>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/users"><Button variant="outline" size="sm"><UserPlus className="w-3.5 h-3.5" />Manage Users</Button></Link>
              <Link to="/admin/deliverability"><Button variant="outline" size="sm">Deliverability Health</Button></Link>
              <Link to="/admin/security"><Button variant="outline" size="sm"><ShieldAlert className="w-3.5 h-3.5" />Security Policies</Button></Link>
            </div>
          </Card>
        </>
      )}
    </AdminLayout>
  );
}
