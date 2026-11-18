import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Building2,
  FileCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Input,
  Modal,
  Select,
  SkeletonRows,
  StatusText,
} from '../../components/ui/Primitives.tsx';
import { CorivoLogo } from '../../components/ui/CorivoLogo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { cn, formatDateTime } from '../../lib/utils.ts';
import type {
  AuditLog,
  Domain,
  Organisation,
  PlatformOperator,
  PlatformSetting,
} from '../../shared/types.ts';

interface HealthService {
  service: string;
  adapter: string;
  mode: string;
  healthy: boolean;
  detail: string;
  checkedAt: string;
}

export function PlatformLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { to: '/platform', label: 'Platform Overview', icon: LayoutDashboard, end: true },
    { to: '/platform/organisations', label: 'Organisations', icon: Building2 },
    { to: '/platform/users', label: 'Platform Operators', icon: Users },
    { to: '/platform/health', label: 'Platform Health', icon: Activity },
    { to: '/platform/settings', label: 'Platform Settings', icon: Settings },
    { to: '/platform/audit-logs', label: 'Platform Audit Logs', icon: FileCheck },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-200 border-r border-slate-800">
      <div className="px-4 h-14 border-b border-slate-800 flex items-center justify-between">
        <Link to="/platform">
          <CorivoLogo inverse />
        </Link>
        <button type="button" onClick={() => setDrawerOpen(false)} className="lg:hidden p-1 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-800/80 bg-amber-950/20">
        <p className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Platform Super Admin
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Tenant metadata only · Email bodies isolated
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setDrawerOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                isActive ? 'bg-[#D97706] text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              )
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-white/5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out Operator</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] dark:bg-[#0B1220] text-[#172033] dark:text-slate-100">
      <aside className="hidden lg:block w-60 shrink-0">{sidebar}</aside>
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 h-full">{sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white dark:bg-[#111A2E] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDrawerOpen(true)} className="lg:hidden p-1.5 text-[#64748B]">
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-[#64748B]">
              <span>Platform Console</span>
              <span className="mx-1.5">/</span>
              <span className="font-semibold text-[#14243A] dark:text-white">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-xs">
            <Avatar name={session?.user.displayName || 'Operator'} src={session?.user.avatarUrl} size="sm" />
            <span className="hidden sm:inline font-medium">{session?.user.email}</span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#14243A] dark:text-white">{title}</h1>
              {subtitle && <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

// Screen 61: Platform Overview
export function PlatformOverviewPage() {
  const { notify } = useToast();
  const [data, setData] = useState<{
    kpis: {
      totalOrganisations: number;
      activeOrganisations: number;
      suspendedOrganisations: number;
      totalMailboxes: number;
      totalDomains: number;
      infrastructureAlerts: number;
    };
    healthSummary: HealthService[];
    recentOrganisations: { id: string; name: string; primaryDomain: string | null; status: string; mailboxCount: number; createdAt: string }[];
  } | null>(null);

  useEffect(() => {
    apiFetch<NonNullable<typeof data>>('/api/platform/overview')
      .then(setData)
      .catch((err) => notify(err instanceof ApiError ? err.message : 'Unable to load platform overview', 'error'));
  }, [notify]);

  return (
    <PlatformLayout
      title="Platform Overview"
      subtitle="Multi-tenant health, infrastructure adapter telemetry, and organisation directory summary."
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-xs text-[#64748B]">Organisations</p>
          <p className="font-mono text-2xl font-bold mt-1">{data?.kpis.totalOrganisations ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#64748B]">Active Tenants</p>
          <p className="font-mono text-2xl font-bold text-[#16A34A] mt-1">{data?.kpis.activeOrganisations ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#64748B]">Suspended Tenants</p>
          <p className="font-mono text-2xl font-bold text-[#DC2626] mt-1">{data?.kpis.suspendedOrganisations ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#64748B]">Total Mailboxes</p>
          <p className="font-mono text-2xl font-bold mt-1">{data?.kpis.totalMailboxes ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#64748B]">Connected Domains</p>
          <p className="font-mono text-2xl font-bold mt-1">{data?.kpis.totalDomains ?? '—'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Tenant Directory</h2>
            <Link to="/platform/organisations" className="text-xs text-[#2563EB] hover:underline">
              View all
            </Link>
          </div>
          {!data ? (
            <SkeletonRows rows={4} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {data.recentOrganisations.map((org) => (
                <Link
                  key={org.id}
                  to={`/platform/organisations/${org.id}`}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-900/30"
                >
                  <div>
                    <p className="font-semibold text-[#14243A] dark:text-white">{org.name}</p>
                    <p className="font-mono text-[#64748B]">{org.primaryDomain || 'No domain yet'}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <StatusText status={org.status} />
                    <p className="font-mono text-[11px] text-[#64748B]">{org.mailboxCount} mailboxes</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Infrastructure Adapters</h2>
            <Link to="/platform/health" className="text-xs text-[#2563EB] hover:underline">
              Full report
            </Link>
          </div>
          {!data ? (
            <SkeletonRows rows={4} />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {data.healthSummary.map((svc) => (
                <div key={svc.service} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{svc.service}</p>
                    <p className="text-[#64748B]">{svc.detail}</p>
                  </div>
                  <StatusText status={svc.mode} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </PlatformLayout>
  );
}

// Screen 62: Organisation Directory
export function PlatformOrganisationsPage() {
  const { notify, confirm } = useToast();
  const [orgs, setOrgs] = useState<(Organisation & { ownerName: string; ownerEmail: string; mailboxCount: number; domainCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ organisations: typeof orgs }>('/api/platform/organisations');
      setOrgs(res.organisations);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to load organisations', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleSuspend = async (org: Organisation) => {
    const isSuspended = org.status === 'SUSPENDED';
    const ok = await confirm({
      title: isSuspended ? `Reactivate ${org.name}?` : `Suspend ${org.name}?`,
      description: isSuspended
        ? 'Restores tenant access for all active organisation members.'
        : 'Blocks new sign-ins and administrative actions for this organisation.',
      confirmLabel: isSuspended ? 'Reactivate Tenant' : 'Suspend Tenant',
      destructive: !isSuspended,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/platform/organisations/${org.id}/${isSuspended ? 'reactivate' : 'suspend'}`, {
        method: 'POST',
      });
      notify(`${org.name} ${isSuspended ? 'reactivated' : 'suspended'}.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Action failed', 'error');
    }
  };

  const filtered = orgs.filter((o) =>
    `${o.name} ${o.primaryDomain || ''} ${o.ownerEmail}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <PlatformLayout
      title="Organisation Directory"
      subtitle="Tenant metadata, domain counts, and tenant suspension controls."
    >
      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search organisations or domains..." className="pl-9" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Building2} title="No organisations found" description="No tenants match your search filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Organisation</th>
                  <th className="py-3 px-4 font-semibold">Primary Domain</th>
                  <th className="py-3 px-4 font-semibold">Owner</th>
                  <th className="py-3 px-4 font-semibold">Mailboxes</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                    <td className="py-3.5 px-4">
                      <Link to={`/platform/organisations/${o.id}`} className="font-semibold text-[#14243A] dark:text-white hover:text-[#2563EB]">
                        {o.name}
                      </Link>
                      <p className="text-[11px] text-[#64748B]">{o.legalName}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono">{o.primaryDomain || '—'}</td>
                    <td className="py-3.5 px-4">
                      <p>{o.ownerName}</p>
                      <p className="font-mono text-[11px] text-[#64748B]">{o.ownerEmail}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono">{o.mailboxCount} ({o.domainCount} domains)</td>
                    <td className="py-3.5 px-4"><StatusText status={o.status} /></td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link to={`/platform/organisations/${o.id}`}>
                          <Button size="sm" variant="outline">Inspect</Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => handleToggleSuspend(o)}>
                          {o.status === 'SUSPENDED' ? (
                            <UserCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                          ) : (
                            <UserX className="w-3.5 h-3.5 text-[#DC2626]" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PlatformLayout>
  );
}

// Screen 63: Organisation Details (Metadata only, zero email body exposure)
export function PlatformOrgDetailPage() {
  const { id } = useParams();
  const { notify } = useToast();
  const [data, setData] = useState<{
    organisation: Organisation;
    domains: Domain[];
    mailboxCount: number;
    subscriptionStatus: string;
    recentAuditEvents: AuditLog[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<NonNullable<typeof data>>(`/api/platform/organisations/${id}`)
      .then(setData)
      .catch((err) => notify(err instanceof ApiError ? err.message : 'Unable to load organisation', 'error'));
  }, [id, notify]);

  return (
    <PlatformLayout
      title={data?.organisation.name || 'Organisation Inspection'}
      subtitle="Strict tenant isolation enforced: customer email bodies and private mailbox contents are never exposed here."
      actions={
        <Link to="/platform/organisations">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4" />
            All Organisations
          </Button>
        </Link>
      }
    >
      {!data ? (
        <Card className="p-6"><SkeletonRows rows={5} /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Tenant Status</p>
              <div className="mt-2"><StatusText status={data.organisation.status} /></div>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Provisioned Mailboxes</p>
              <p className="font-mono text-2xl font-bold mt-1">{data.mailboxCount}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Connected Domains</p>
              <p className="font-mono text-2xl font-bold mt-1">{data.domains.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-[#64748B]">Subscription Mode</p>
              <div className="mt-2"><StatusText status="SANDBOX" label={data.subscriptionStatus} /></div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-semibold">Domains</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.domains.map((dom) => (
                  <div key={dom.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-semibold">{dom.domainName}</p>
                      <p className="text-[#64748B]">Mode: {dom.verificationMode}</p>
                    </div>
                    <StatusText status={dom.ownershipStatus} />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-semibold">Recent Tenant Audit Events</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {data.recentAuditEvents.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-medium truncate">{a.action}</p>
                      <p className="text-[#64748B] truncate">{a.actorEmail} · {a.resource}</p>
                    </div>
                    <StatusText status={a.result} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </PlatformLayout>
  );
}

// Screen 64: Platform Users / Operators
export function PlatformUsersPage() {
  const { notify } = useToast();
  const [operators, setOperators] = useState<PlatformOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [scope, setScope] = useState<PlatformOperator['scope']>('ORG_SUPPORT');
  const [editOp, setEditOp] = useState<PlatformOperator | null>(null);
  const [editScope, setEditScope] = useState<PlatformOperator['scope']>('ORG_SUPPORT');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ operators: PlatformOperator[] }>('/api/platform/users');
      setOperators(res.operators);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to load platform operators', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/platform/users', {
        method: 'POST',
        body: JSON.stringify({ displayName, email, password, scope }),
      });
      notify('Platform operator created.', 'success');
      setModalOpen(false);
      setDisplayName('');
      setEmail('');
      setPassword('');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to create operator', 'error');
    }
  };

  const handleToggleStatus = async (op: PlatformOperator) => {
    const nextStatus = op.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiFetch(`/api/platform/users/${op.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      notify(`Operator ${op.email} ${nextStatus.toLowerCase()}.`, 'info');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Action failed', 'error');
    }
  };

  const handleUpdateScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOp) return;
    try {
      await apiFetch(`/api/platform/users/${editOp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scope: editScope }),
      });
      notify(`Updated operator scope for ${editOp.email}.`, 'success');
      setEditOp(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to update operator scope', 'error');
    }
  };

  return (
    <PlatformLayout
      title="Platform Operators"
      subtitle="Internal Corivo operations staff with platform console access."
      actions={
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Operator
        </Button>
      }
    >
      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Operator</th>
                  <th className="py-3 px-4 font-semibold">Scope</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {operators.map((op) => (
                  <tr key={op.id}>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold">{op.displayName}</p>
                      <p className="font-mono text-[#64748B]">{op.email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-mono">{op.scope}</td>
                    <td className="py-3.5 px-4"><StatusText status={op.status} /></td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditOp(op);
                            setEditScope(op.scope);
                          }}
                        >
                          Edit Scope
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleToggleStatus(op)}>
                          {op.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Platform Operator">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <FieldLabel>Full Name</FieldLabel>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Aarav Mehta" />
          </div>
          <div>
            <FieldLabel>Operator Email</FieldLabel>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="ops@corivomail.example" />
          </div>
          <div>
            <FieldLabel hint="Minimum 10 characters">Password</FieldLabel>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required />
          </div>
          <div>
            <FieldLabel>Operator Scope</FieldLabel>
            <Select value={scope} onChange={(e) => setScope(e.target.value as PlatformOperator['scope'])}>
              <option value="FULL_OPERATOR">FULL_OPERATOR</option>
              <option value="ORG_SUPPORT">ORG_SUPPORT</option>
              <option value="HEALTH_READONLY">HEALTH_READONLY</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create Operator</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editOp)} onClose={() => setEditOp(null)} title="Edit Operator Scope">
        <form onSubmit={handleUpdateScope} className="space-y-4">
          <div className="text-xs text-[#64748B]">
            Updating permissions scope for <span className="font-mono font-semibold text-[#14243A] dark:text-white">{editOp?.email}</span>
          </div>
          <div>
            <FieldLabel>Operator Scope</FieldLabel>
            <Select value={editScope} onChange={(e) => setEditScope(e.target.value as PlatformOperator['scope'])}>
              <option value="FULL_OPERATOR">FULL_OPERATOR</option>
              <option value="ORG_SUPPORT">ORG_SUPPORT</option>
              <option value="HEALTH_READONLY">HEALTH_READONLY</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOp(null)}>Cancel</Button>
            <Button type="submit">Save Scope</Button>
          </div>
        </form>
      </Modal>
    </PlatformLayout>
  );
}

// Screen 65: Platform Health & Infrastructure
export function PlatformHealthPage() {
  const { notify } = useToast();
  const [services, setServices] = useState<HealthService[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ services: HealthService[] }>('/api/platform/health');
      setServices(res.services);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to probe platform health', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PlatformLayout
      title="Platform Health & Adapters"
      subtitle="Live connectivity status for storage, mail transport, DNS, spam filtering, and search engines."
      actions={
        <Button variant="outline" onClick={load}>
          <Activity className="w-4 h-4" />
          Re-check Adapters
        </Button>
      }
    >
      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Service / Subsystem</th>
                  <th className="py-3 px-4 font-semibold">Adapter</th>
                  <th className="py-3 px-4 font-semibold">Mode</th>
                  <th className="py-3 px-4 font-semibold">Diagnostic Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {services.map((svc) => (
                  <tr key={svc.service}>
                    <td className="py-3.5 px-4 font-semibold text-[#14243A] dark:text-white">{svc.service}</td>
                    <td className="py-3.5 px-4 font-mono text-[#64748B]">{svc.adapter}</td>
                    <td className="py-3.5 px-4"><StatusText status={svc.mode} /></td>
                    <td className="py-3.5 px-4 text-[#64748B]">{svc.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PlatformLayout>
  );
}

// Screen 66: Platform Settings
export function PlatformSettingsPage() {
  const { notify } = useToast();
  const [settings, setSettings] = useState<PlatformSetting | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ settings: PlatformSetting }>('/api/platform/settings')
      .then((res) => setSettings(res.settings))
      .catch(() => {});
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      await apiFetch('/api/platform/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          platformName: settings.platformName,
          defaultQuotaMb: settings.defaultQuotaMb,
          maxAttachmentMb: settings.maxAttachmentMb,
          maintenanceNotice: settings.maintenanceNotice,
          allowPublicSignup: settings.allowPublicSignup,
          supportedDomainPolicy: settings.supportedDomainPolicy,
        }),
      });
      notify('Platform settings saved.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save platform settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformLayout
      title="Platform Settings"
      subtitle="Global defaults, maintenance banner, and tenant signup controls."
    >
      {!settings ? (
        <Card className="p-6"><SkeletonRows rows={5} /></Card>
      ) : (
        <Card className="p-6 max-w-2xl">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <FieldLabel>Platform Display Name</FieldLabel>
              <Input
                value={settings.platformName}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Default Mailbox Quota (MB)</FieldLabel>
                <Input
                  type="number"
                  min={1024}
                  step={1024}
                  value={settings.defaultQuotaMb}
                  onChange={(e) => setSettings({ ...settings, defaultQuotaMb: Number(e.target.value) })}
                />
              </div>
              <div>
                <FieldLabel>Max Attachment Size (MB)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.maxAttachmentMb}
                  onChange={(e) => setSettings({ ...settings, maxAttachmentMb: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Maintenance Notice Banner</FieldLabel>
              <Input
                value={settings.maintenanceNotice}
                onChange={(e) => setSettings({ ...settings, maintenanceNotice: e.target.value })}
                placeholder="Optional platform-wide maintenance message"
              />
            </div>
            <div>
              <FieldLabel>Supported Domain Policy</FieldLabel>
              <Input
                value={settings.supportedDomainPolicy}
                onChange={(e) => setSettings({ ...settings, supportedDomainPolicy: e.target.value })}
              />
            </div>
            <label className="flex items-center justify-between py-2 cursor-pointer">
              <div>
                <p className="text-sm font-medium">Allow Public Organisation Signup</p>
                <p className="text-xs text-[#64748B]">When disabled, new organisations can only be provisioned by operators.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowPublicSignup}
                onChange={(e) => setSettings({ ...settings, allowPublicSignup: e.target.checked })}
                className="w-4 h-4 accent-[#D97706]"
              />
            </label>
            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Platform Settings'}</Button>
            </div>
          </form>
        </Card>
      )}
    </PlatformLayout>
  );
}

// Screen 67: Platform Audit Logs (Append-only)
export function PlatformAuditLogsPage() {
  const { notify } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ logs: AuditLog[] }>('/api/platform/audit-logs')
      .then((res) => setLogs(res.logs))
      .catch((err) => notify(err instanceof ApiError ? err.message : 'Unable to load platform audit logs', 'error'))
      .finally(() => setLoading(false));
  }, [notify]);

  return (
    <PlatformLayout
      title="Platform Audit Logs"
      subtitle="Append-only platform and administrative action log across all tenants."
    >
      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} />
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
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#64748B]">
                      {formatDateTime(log.createdAt, 'Asia/Kolkata', 'full')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">{log.category}</td>
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
    </PlatformLayout>
  );
}
