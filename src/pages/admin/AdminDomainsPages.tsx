import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Copy, Globe, Plus, RefreshCw, Search, Server, ShieldCheck } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout.tsx';
import {
  Button,
  Card,
  DevelopmentModeNotice,
  EmptyState,
  FieldLabel,
  Input,
  Select,
  SkeletonRows,
  StatusText,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { formatDateTime } from '../../lib/utils.ts';
import type { AuditLog, DNSRecord, Domain, Mailbox } from '../../shared/types.ts';

type EnrichedDomain = Domain & { mailboxCount: number; dnsRecords: DNSRecord[] };

export function AdminDomainsPage() {
  const { hasPermission } = useAuth();
  const { notify, confirm } = useToast();
  const [domains, setDomains] = useState<EnrichedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'FAILED'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ domains: EnrichedDomain[] }>('/api/domains');
      setDomains(res.domains);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load domains';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecheck = async (dom: EnrichedDomain) => {
    try {
      await apiFetch(`/api/domains/${dom.id}/dns/check`, { method: 'POST' });
      notify(`DNS records rechecked for ${dom.domainName}.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'DNS recheck failed', 'error');
    }
  };

  const handleSetPrimary = async (dom: EnrichedDomain) => {
    try {
      await apiFetch(`/api/domains/${dom.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPrimary: true }),
      });
      notify(`${dom.domainName} set as primary domain.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to update primary domain', 'error');
    }
  };

  const handleRemove = async (dom: EnrichedDomain) => {
    const ok = await confirm({
      title: `Remove domain ${dom.domainName}?`,
      description: 'Domains with existing mailboxes cannot be removed until mailboxes are reassigned.',
      confirmLabel: 'Remove Domain',
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/domains/${dom.id}`, { method: 'DELETE' });
      notify(`Domain ${dom.domainName} removed.`, 'info');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to remove domain', 'error');
    }
  };

  const filtered = domains.filter((dom) => {
    const matchesQ = dom.domainName.toLowerCase().includes(q.trim().toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || dom.ownershipStatus === statusFilter;
    return matchesQ && matchesStatus;
  });

  const canManageDomains = hasPermission('domains.manage');

  return (
    <AdminLayout
      title="Domain Management"
      subtitle="Connect business domains, verify ownership, and inspect MX, SPF, DKIM, and DMARC status."
      actions={
        canManageDomains && (
          <Link to="/admin/domains/add">
            <Button size="sm">
              <Plus className="w-4 h-4" />
              Add Domain
            </Button>
          </Link>
        )
      }
    >
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter domains..."
            className="pl-9"
          />
        </div>
        <div className="w-44">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="ALL">All ownership states</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : error ? (
          <div className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
            <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
            <Button size="sm" variant="outline" onClick={load}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Globe}
            title={domains.length === 0 ? 'Connect your business domain to start creating professional email accounts.' : 'No domains match your filter'}
            description={domains.length === 0 ? 'Add a domain you own to receive TXT verification and DNS records.' : 'Adjust the search or status filter.'}
            action={canManageDomains && domains.length === 0 ? <Link to="/admin/domains/add"><Button>Add Domain</Button></Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] text-[#64748B]">
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Ownership</th>
                  <th className="px-4 py-3 font-medium">MX</th>
                  <th className="px-4 py-3 font-medium">SPF</th>
                  <th className="px-4 py-3 font-medium">DKIM</th>
                  <th className="px-4 py-3 font-medium">DMARC</th>
                  <th className="px-4 py-3 font-medium">Mailboxes</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((dom) => (
                  <tr key={dom.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3.5">
                      <Link to={`/admin/domains/${dom.id}`} className="font-mono font-semibold text-[#2563EB] hover:underline">
                        {dom.domainName}
                      </Link>
                      {dom.isPrimary && <span className="ml-2 text-[11px] text-[#64748B]">Primary</span>}
                    </td>
                    <td className="px-4 py-3.5"><StatusText status={dom.ownershipStatus} /></td>
                    <td className="px-4 py-3.5"><StatusText status={dom.mxStatus} /></td>
                    <td className="px-4 py-3.5"><StatusText status={dom.spfStatus} /></td>
                    <td className="px-4 py-3.5"><StatusText status={dom.dkimStatus} /></td>
                    <td className="px-4 py-3.5"><StatusText status={dom.dmarcStatus} /></td>
                    <td className="px-4 py-3.5 font-mono tabular-nums">{dom.mailboxCount}</td>
                    <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                      {canManageDomains && !dom.isPrimary && (
                        <button type="button" onClick={() => handleSetPrimary(dom)} className="text-[#64748B] hover:text-[#2563EB] hover:underline font-medium cursor-pointer">
                          Set Primary
                        </button>
                      )}
                      <Link to={`/admin/domains/${dom.id}/dns`} className="text-[#2563EB] hover:underline font-medium">DNS</Link>
                      {canManageDomains && (
                        <button type="button" onClick={() => handleRecheck(dom)} className="text-[#14243A] dark:text-slate-200 hover:underline font-medium cursor-pointer">
                          Recheck
                        </button>
                      )}
                      {canManageDomains && (
                        <button type="button" onClick={() => handleRemove(dom)} className="text-[#DC2626] hover:underline font-medium cursor-pointer">
                          Remove
                        </button>
                      )}
                    </td>
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

export function AdminAddDomainWizardPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const [step, setStep] = useState(1);
  const [domainName, setDomainName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [createdDomain, setCreatedDomain] = useState<EnrichedDomain | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch<{ domain: EnrichedDomain }>('/api/domains', {
        method: 'POST',
        body: JSON.stringify({ domainName, isPrimary }),
      });
      setCreatedDomain(res.domain);
      setStep(2);
      notify(`Domain ${res.domain.domainName} added.`, 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Invalid domain', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOwnership = async () => {
    if (!createdDomain) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ domain: Domain; check: { status: string; errorMessage: string | null } }>(
        `/api/domains/${createdDomain.id}/verify`,
        { method: 'POST' }
      );
      setCreatedDomain({ ...createdDomain, ...res.domain });
      if (res.check.status === 'VERIFIED') {
        notify('Ownership verified.', 'success');
        setStep(3);
      } else {
        notify(res.check.errorMessage || 'Verification failed.', 'error');
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Verification failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCheckDns = async () => {
    if (!createdDomain) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ domain: Domain; dnsRecords: DNSRecord[] }>(
        `/api/domains/${createdDomain.id}/dns/check`,
        { method: 'POST' }
      );
      setCreatedDomain({ ...createdDomain, ...res.domain, dnsRecords: res.dnsRecords });
      setStep(4);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'DNS check failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Add Domain Wizard" subtitle="Step-by-step domain onboarding and DNS setup.">
      <div className="max-w-3xl space-y-6">
        {!hasPermission('domains.manage') ? (
          <Card className="p-6 text-xs text-[#64748B]">
            Domain management permission is required to add or configure organisation domains.
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2 text-xs">
              {['1. Entry', '2. Ownership', '3. DNS Config', '4. Review', '5. Complete'].map((label, idx) => (
                <div
                  key={label}
                  className={`rounded-lg border px-3 py-2 font-medium ${
                    step === idx + 1
                      ? 'border-[#2563EB] bg-white dark:bg-[#111A2E] text-[#2563EB]'
                      : step > idx + 1
                        ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-[#16A34A]'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] text-[#94A3B8]'
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            <Card className="p-6">
              {step === 1 && (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <FieldLabel htmlFor="wiz-dom">Business Domain</FieldLabel>
                    <Input id="wiz-dom" value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="company.example" required />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
                    <span>Set as primary organisation domain</span>
                  </label>
                  <Button type="submit" disabled={busy}>{busy ? 'Adding...' : 'Continue to Ownership Verification'}</Button>
                </form>
              )}

              {step === 2 && createdDomain && (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold">Step 2: Ownership Verification TXT</h2>
                  <div className="p-4 rounded-lg bg-[#F7F9FC] dark:bg-[#0B1220] border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-2">
                    <p>Host: <strong>@</strong> · Type: <strong>TXT</strong> · TTL: <strong>3600</strong></p>
                    <div className="flex items-center justify-between gap-2 bg-white dark:bg-[#111A2E] p-2.5 rounded border border-slate-200 dark:border-slate-700">
                      <span className="break-all">{createdDomain.verificationToken}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(createdDomain.verificationToken);
                          notify('Verification token copied.', 'info');
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(3)}>Skip for Now</Button>
                    <Button onClick={handleVerifyOwnership} disabled={busy}>{busy ? 'Verifying...' : 'Verify TXT Record'}</Button>
                  </div>
                </div>
              )}

              {step === 3 && createdDomain && (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold">Step 3: Configure MX, SPF, DKIM, and DMARC</h2>
                  <div className="space-y-2">
                    {createdDomain.dnsRecords.filter((r) => r.category !== 'OWNERSHIP').map((r) => (
                      <div key={r.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono">
                        <span className="font-bold text-[#14243A] dark:text-white mr-2">{r.category} ({r.type})</span>
                        <span>Host: {r.host} → {r.value}</span>
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleCheckDns} disabled={busy}>{busy ? 'Checking DNS...' : 'Check DNS Records & Review'}</Button>
                </div>
              )}

              {step === 4 && createdDomain && (
                <div className="space-y-4">
                  <h2 className="text-base font-semibold">Step 4: Verification Review</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div><span className="text-[#64748B] block">Ownership</span><StatusText status={createdDomain.ownershipStatus} /></div>
                    <div><span className="text-[#64748B] block">MX</span><StatusText status={createdDomain.mxStatus} /></div>
                    <div><span className="text-[#64748B] block">SPF</span><StatusText status={createdDomain.spfStatus} /></div>
                    <div><span className="text-[#64748B] block">DKIM</span><StatusText status={createdDomain.dkimStatus} /></div>
                    <div><span className="text-[#64748B] block">DMARC</span><StatusText status={createdDomain.dmarcStatus} /></div>
                  </div>
                  <Button onClick={() => setStep(5)}>Complete Setup</Button>
                </div>
              )}

              {step === 5 && createdDomain && (
                <div className="space-y-4">
                  <StatusText status="VERIFIED" label="Domain added to your organisation" />
                  <p className="text-sm text-[#64748B]">
                    {createdDomain.domainName} is now available for creating employee mailboxes.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => navigate(`/admin/domains/${createdDomain.id}`)}>View Domain Details</Button>
                    <Button variant="outline" onClick={() => navigate('/admin/mailboxes/create')}>Create Mailbox</Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

export function AdminDomainDetailPage({ defaultTab = 'overview' }: { defaultTab?: 'overview' | 'dns' }) {
  const { id: domainId } = useParams();
  const { session, hasPermission } = useAuth();
  const { notify } = useToast();
  const [tab, setTab] = useState<'overview' | 'dns' | 'mailboxes' | 'security' | 'activity'>(defaultTab);
  const [data, setData] = useState<{
    domain: Domain;
    dnsRecords: DNSRecord[];
    mailboxes: Mailbox[];
    activity: AuditLog[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const canManageDomains = hasPermission('domains.manage');

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab, domainId]);

  const load = useCallback(async () => {
    if (!domainId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>(`/api/domains/${domainId}`);
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load domain details';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [domainId, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecheck = async () => {
    if (!domainId) return;
    setChecking(true);
    try {
      await apiFetch(`/api/domains/${domainId}/dns/check`, { method: 'POST' });
      notify('DNS check completed.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'DNS check failed', 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleSetPrimary = async () => {
    if (!domainId || !data) return;
    try {
      await apiFetch(`/api/domains/${domainId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPrimary: true }),
      });
      notify(`${data.domain.domainName} is now your primary domain.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to set primary domain', 'error');
    }
  };

  const handleUpdateTls = async (tlsStatus: 'AVAILABLE' | 'ENFORCED' | 'UNKNOWN') => {
    if (!domainId) return;
    try {
      await apiFetch(`/api/domains/${domainId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tlsStatus }),
      });
      notify('TLS policy updated.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to update TLS policy', 'error');
    }
  };

  return (
    <AdminLayout
      title={data?.domain.domainName || 'Domain Details'}
      subtitle="Domain health, DNS authentication records, associated mailboxes, and audit trail."
      actions={
        <div className="flex items-center gap-2">
          <Link to="/admin/domains">
            <Button size="sm" variant="outline">All Domains</Button>
          </Link>
          {canManageDomains && data && (
            <Button size="sm" onClick={handleRecheck} disabled={checking}>
              <RefreshCw className="w-3.5 h-3.5" />
              {checking ? 'Checking...' : 'Recheck DNS'}
            </Button>
          )}
        </div>
      }
    >
      {loading ? (
        <Card className="p-6"><SkeletonRows rows={5} /></Card>
      ) : error || !data ? (
        <Card className="p-6">
          <EmptyState
            icon={Globe}
            title="Domain not found"
            description={error || 'The requested domain could not be loaded.'}
            action={<Link to="/admin/domains"><Button size="sm">Back to Domains</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {data.domain.verificationMode === 'DEVELOPMENT_SIMULATED' && (
            <DevelopmentModeNotice detail="DNS verification for .example domains is operating in Development Simulator mode." />
          )}

          <div className="flex items-center gap-1 bg-white dark:bg-[#111A2E] p-1 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
            {(['overview', 'dns', 'mailboxes', 'security', 'activity'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
                  tab === t ? 'bg-[#14243A] text-white' : 'text-[#64748B] hover:text-[#172033] dark:hover:text-white'
                }`}
              >
                {t === 'dns' ? 'DNS Records' : t}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <Card className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-xs">
                <div><span className="text-[#64748B] block">Ownership</span><StatusText status={data.domain.ownershipStatus} /></div>
                <div><span className="text-[#64748B] block">MX</span><StatusText status={data.domain.mxStatus} /></div>
                <div><span className="text-[#64748B] block">SPF</span><StatusText status={data.domain.spfStatus} /></div>
                <div><span className="text-[#64748B] block">DKIM</span><StatusText status={data.domain.dkimStatus} /></div>
                <div><span className="text-[#64748B] block">DMARC</span><StatusText status={data.domain.dmarcStatus} /></div>
                <div><span className="text-[#64748B] block">TLS</span><StatusText status={data.domain.tlsStatus} /></div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-[#64748B] flex flex-wrap items-center justify-between gap-2">
                <span>Mailboxes on domain: <strong className="font-mono text-[#172033] dark:text-white tabular-nums">{data.mailboxes.length}</strong></span>
                <span>Last checked: <strong className="font-mono">{formatDateTime(data.domain.lastCheckedAt, session?.preferences.timezone, 'full')}</strong></span>
                {canManageDomains && !data.domain.isPrimary && (
                  <Button size="sm" variant="outline" onClick={handleSetPrimary}>
                    Set as Primary Domain
                  </Button>
                )}
              </div>
            </Card>
          )}

          {tab === 'dns' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] text-[#64748B]">
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Host</th>
                      <th className="px-4 py-3 font-medium">Value</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {data.dnsRecords.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-sans font-semibold">{r.category}</td>
                        <td className="px-4 py-3">{r.type}</td>
                        <td className="px-4 py-3">{r.host}</td>
                        <td className="px-4 py-3 max-w-xs truncate text-[#64748B]" title={r.value}>{r.value}</td>
                        <td className="px-4 py-3 font-sans"><StatusText status={r.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(r.value);
                              notify(`${r.category} value copied`, 'info');
                            }}
                            className="text-[#2563EB] hover:underline font-sans cursor-pointer"
                          >
                            Copy
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === 'mailboxes' && (
            <Card className="p-5">
              {data.mailboxes.length === 0 ? (
                <p className="text-xs text-[#64748B]">No mailboxes on this domain yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {data.mailboxes.map((mb) => (
                    <div key={mb.id} className="py-3 flex items-center justify-between">
                      <Link to={`/admin/mailboxes/${mb.id}`} className="hover:text-[#2563EB]">
                        <p className="font-semibold">{mb.displayName}</p>
                        <p className="font-mono text-[#64748B]">{mb.emailAddress}</p>
                      </Link>
                      <StatusText status={mb.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === 'security' && (
            <Card className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                <span>DKIM Selector &amp; Transport Security</span>
              </div>
              <p className="text-[#64748B]">Selector: <code className="text-[#14243A] dark:text-white">{data.domain.dkimSelector}</code></p>
              <p className="text-[#64748B]">KMS Reference: <code className="text-[#14243A] dark:text-white">{data.domain.dkimKeyRef}</code> (Private keys are never exposed in frontend code.)</p>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <span className="font-medium text-[#172033] dark:text-slate-200 mr-2">TLS Policy:</span>
                {(['AVAILABLE', 'ENFORCED'] as const).map((policy) => (
                  <Button
                    key={policy}
                    size="sm"
                    variant={data.domain.tlsStatus === policy ? 'primary' : 'outline'}
                    disabled={!canManageDomains}
                    onClick={() => handleUpdateTls(policy)}
                  >
                    {policy}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {tab === 'activity' && (
            <Card className="p-5">
              {data.activity.length === 0 ? (
                <p className="text-xs text-[#64748B]">No recorded domain activity yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {data.activity.map((a) => (
                    <div key={a.id} className="py-2.5 flex items-center justify-between">
                      <span>{a.action.replace(/_/g, ' ')} by {a.actorEmail}</span>
                      <span className="font-mono text-[#94A3B8]">{formatDateTime(a.createdAt, session?.preferences.timezone, 'full')}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

// Standalone DNS Records Console (/admin/dns)
export function AdminDnsRecordsPage() {
  const { session, hasPermission } = useAuth();
  const { notify } = useToast();
  const [domains, setDomains] = useState<EnrichedDomain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | DNSRecord['category']>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'PENDING' | 'FAILED'>('ALL');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  const canManageDomains = hasPermission('domains.manage');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ domains: EnrichedDomain[] }>('/api/domains');
      setDomains(res.domains);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load DNS records';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecheck = async (domainId: string, domainName: string) => {
    setRecheckingId(domainId);
    try {
      await apiFetch(`/api/domains/${domainId}/dns/check`, { method: 'POST' });
      notify(`DNS records verified for ${domainName}.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'DNS recheck failed', 'error');
    } finally {
      setRecheckingId(null);
    }
  };

  const rows = domains
    .filter((d) => selectedDomainId === 'ALL' || d.id === selectedDomainId)
    .flatMap((d) =>
      d.dnsRecords.map((rec) => ({
        ...rec,
        domainName: d.domainName,
        verificationMode: d.verificationMode,
      }))
    )
    .filter((r) => {
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        return `${r.domainName} ${r.category} ${r.type} ${r.host} ${r.value}`.toLowerCase().includes(needle);
      }
      return true;
    });

  const activeSingleDomain = domains.find((d) => d.id === selectedDomainId) || domains.find((d) => d.isPrimary) || domains[0] || null;

  return (
    <AdminLayout
      title="DNS Records"
      subtitle="Inspect TXT ownership, MX routing, SPF, DKIM, and DMARC records across organisation domains."
      actions={
        canManageDomains && activeSingleDomain ? (
          <Button
            size="sm"
            onClick={() => handleRecheck(activeSingleDomain.id, activeSingleDomain.domainName)}
            disabled={recheckingId === activeSingleDomain.id}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {recheckingId === activeSingleDomain.id ? 'Checking...' : `Recheck ${activeSingleDomain.domainName}`}
          </Button>
        ) : undefined
      }
    >
      {domains.some((d) => d.verificationMode === 'DEVELOPMENT_SIMULATED') && (
        <DevelopmentModeNotice detail="DNS verification for .example domains runs in Development Simulator mode." />
      )}

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter host, value, domain..." className="pl-9" />
        </div>
        <div className="w-48">
          <Select value={selectedDomainId} onChange={(e) => setSelectedDomainId(e.target.value)}>
            <option value="ALL">All Domains ({domains.length})</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>{d.domainName}</option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}>
            <option value="ALL">All Categories</option>
            <option value="OWNERSHIP">Ownership</option>
            <option value="MX">MX</option>
            <option value="SPF">SPF</option>
            <option value="DKIM">DKIM</option>
            <option value="DMARC">DMARC</option>
          </Select>
        </div>
        <div className="w-36">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
            <option value="ALL">All Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </Select>
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
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No DNS records match your filter"
            description={domains.length === 0 ? 'Add a business domain first to generate DNS records.' : 'Adjust the domain, category, or status filters.'}
            action={domains.length === 0 && canManageDomains ? <Link to="/admin/domains/add"><Button size="sm">Add Domain</Button></Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] text-[#64748B]">
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Host</th>
                  <th className="px-4 py-3 font-medium">Priority / TTL</th>
                  <th className="px-4 py-3 font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Checked</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                    <td className="px-4 py-3 font-mono font-medium">
                      <Link to={`/admin/domains/${r.domainId}/dns`} className="text-[#2563EB] hover:underline">
                        {r.domainName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-semibold">{r.category}</td>
                    <td className="px-4 py-3 font-mono">{r.type}</td>
                    <td className="px-4 py-3 font-mono">{r.host}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[#64748B]">
                      {r.priority !== null ? `Pri ${r.priority} · ` : ''}{r.ttl}s
                    </td>
                    <td className="px-4 py-3 font-mono max-w-[240px] truncate text-[#64748B]" title={r.value}>
                      {r.value}
                    </td>
                    <td className="px-4 py-3"><StatusText status={r.status} /></td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#64748B] tabular-nums">
                      {formatDateTime(r.lastCheckedAt, session?.preferences.timezone, 'short')}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(r.value);
                          notify(`Copied ${r.category} record for ${r.domainName}.`, 'info');
                        }}
                        className="text-[#2563EB] hover:underline font-medium cursor-pointer"
                      >
                        Copy
                      </button>
                      {canManageDomains && (
                        <button
                          type="button"
                          onClick={() => handleRecheck(r.domainId, r.domainName)}
                          className="text-[#14243A] dark:text-slate-200 hover:underline font-medium cursor-pointer"
                        >
                          Verify
                        </button>
                      )}
                    </td>
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

