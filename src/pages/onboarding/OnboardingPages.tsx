import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CheckCircle2, Copy, Globe, MailPlus, ShieldCheck } from 'lucide-react';
import { CorivoLogo } from '../../components/ui/CorivoLogo.tsx';
import {
  Button,
  Card,
  DevelopmentModeNotice,
  FieldLabel,
  Input,
  Select,
  StatusText,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import type { DNSRecord, Domain, Mailbox } from '../../shared/types.ts';

function OnboardingShell({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const steps = [
    { num: 1, label: 'Organisation', path: '/onboarding/organisation' },
    { num: 2, label: 'Add Domain', path: '/onboarding/domain' },
    { num: 3, label: 'Verify Domain', path: '/onboarding/domain-verification' },
    { num: 4, label: 'DNS Setup', path: '/onboarding/dns-setup' },
    { num: 5, label: 'Create Mailbox', path: '/onboarding/mailbox' },
    { num: 6, label: 'Complete', path: '/onboarding/complete' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9FC] py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <CorivoLogo />
          <Link to="/app/mail/inbox" className="text-xs font-medium text-[#64748B] hover:text-[#14243A]">
            Skip to Workspace
          </Link>
        </div>

        {/* Stepper */}
        <div className="mb-8 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {steps.map((s) => (
            <Link
              key={s.num}
              to={s.path}
              className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                s.num === step
                  ? 'border-[#2563EB] bg-white text-[#14243A] font-semibold'
                  : s.num < step
                    ? 'border-emerald-200 bg-emerald-50/50 text-[#16A34A]'
                    : 'border-slate-200 bg-white/60 text-[#94A3B8]'
              }`}
            >
              <span className="font-mono mr-1">0{s.num}.</span>
              <span className="truncate">{s.label}</span>
            </Link>
          ))}
        </div>

        <Card className="p-6 sm:p-8">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#14243A]">{title}</h1>
          <p className="text-sm text-[#64748B] mt-1">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  );
}

export function OnboardingOrganisationPage() {
  const { session, refreshSession } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: session?.organisation?.name || '',
    legalName: session?.organisation?.legalName || '',
    businessCategory: session?.organisation?.businessCategory || 'Technology & Software',
    country: session?.organisation?.country || 'India',
    size: session?.organisation?.size || '11-50 employees',
    contactEmail: session?.organisation?.contactEmail || session?.user.email || '',
    timezone: session?.organisation?.timezone || 'Asia/Kolkata',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/onboarding/organisation', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await refreshSession();
      notify('Organisation profile saved.', 'success');
      navigate('/onboarding/domain');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save organisation', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step={1}
      title="Set up your organisation"
      subtitle="Confirm your business details and default regional timezone."
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="ob-name">Organisation Name</FieldLabel>
            <Input id="ob-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <FieldLabel htmlFor="ob-cat">Business Category</FieldLabel>
            <Select id="ob-cat" value={form.businessCategory} onChange={(e) => setForm({ ...form, businessCategory: e.target.value })}>
              <option value="Technology & Software">Technology &amp; Software</option>
              <option value="Education & Schools">Education &amp; Schools</option>
              <option value="Financial Services">Financial Services</option>
              <option value="Retail & E-Commerce">Retail &amp; E-Commerce</option>
              <option value="Professional Services">Professional Services</option>
              <option value="Manufacturing & Logistics">Manufacturing &amp; Logistics</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel htmlFor="ob-country">Country</FieldLabel>
            <Input id="ob-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor="ob-size">Organisation Size</FieldLabel>
            <Select id="ob-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
              <option value="1-10 employees">1-10 employees</option>
              <option value="11-50 employees">11-50 employees</option>
              <option value="51-200 employees">51-200 employees</option>
              <option value="200+ employees">200+ employees</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="ob-tz">Default Time Zone</FieldLabel>
            <Select id="ob-tz" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="UTC">UTC</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
              <option value="Europe/London">Europe/London</option>
            </Select>
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="ob-email">Primary Contact Email</FieldLabel>
          <Input id="ob-email" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
        </div>
        <div className="pt-2 flex justify-end">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save & Continue'}</Button>
        </div>
      </form>
    </OnboardingShell>
  );
}

export function OnboardingDomainPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [domainName, setDomainName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ domain: Domain }>('/api/domains', {
        method: 'POST',
        body: JSON.stringify({ domainName, isPrimary: true }),
      });
      notify(`Domain ${res.domain.domainName} added.`, 'success');
      navigate(`/onboarding/domain-verification?domainId=${res.domain.id}`);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to add domain', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingShell
      step={2}
      title="Connect your business domain"
      subtitle="Enter the domain name your organisation owns or controls DNS for (for example: company.com or company.example)."
    >
      <form onSubmit={handleAdd} className="space-y-5 max-w-lg">
        <div>
          <FieldLabel htmlFor="ob-dom">Domain Name</FieldLabel>
          <Input
            id="ob-dom"
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder="company.example"
          />
          <p className="mt-1.5 text-xs text-[#64748B]">
            You must have access to your DNS provider (Cloudflare, Route53, GoDaddy, BigRock) to add verification records.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            <Globe className="w-4 h-4" />
            {submitting ? 'Registering...' : 'Continue to Verification'}
          </Button>
          <Link to="/onboarding/domain-verification">
            <Button type="button" variant="outline">Use Existing Domain</Button>
          </Link>
        </div>
      </form>
    </OnboardingShell>
  );
}

export function OnboardingDomainVerificationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [domain, setDomain] = useState<(Domain & { dnsRecords: DNSRecord[] }) | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<{ domains: (Domain & { dnsRecords: DNSRecord[] })[] }>('/api/domains').then((res) => {
      const targetId = params.get('domainId');
      const found = targetId ? res.domains.find((d) => d.id === targetId) : res.domains[0];
      if (found) setDomain(found);
    });
  }, [params]);

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    notify('Verification value copied to clipboard.', 'info');
  };

  const handleVerify = async () => {
    if (!domain) return;
    setChecking(true);
    try {
      const res = await apiFetch<{ domain: Domain; check: { status: string; errorMessage: string | null; mode: string } }>(
        `/api/domains/${domain.id}/verify`,
        { method: 'POST' }
      );
      setDomain((prev) => (prev ? { ...prev, ...res.domain } : prev));
      if (res.check.status === 'VERIFIED') {
        notify('Domain verification completed.', 'success');
      } else {
        notify(res.check.errorMessage || 'Verification failed.', 'error');
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Verification error', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <OnboardingShell
      step={3}
      title="Verify domain ownership"
      subtitle="Publish this TXT record in your DNS zone to confirm ownership."
    >
      {!domain ? (
        <div className="space-y-4">
          <p className="text-sm text-[#64748B]">No domain registered yet.</p>
          <Link to="/onboarding/domain"><Button>Add Domain First</Button></Link>
        </div>
      ) : (
        <div className="space-y-5">
          {domain.verificationMode === 'DEVELOPMENT_SIMULATED' && (
            <DevelopmentModeNotice detail="Reserved .example domains and development mode return deterministic simulated DNS verification results." />
          )}

          <div className="rounded-xl border border-slate-200 p-5 space-y-4 bg-[#F7F9FC]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#64748B]">Target Domain</p>
                <p className="text-base font-semibold font-mono text-[#14243A]">{domain.domainName}</p>
              </div>
              <StatusText status={checking ? 'CHECKING' : domain.ownershipStatus} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs bg-white p-4 rounded-lg border border-slate-200">
              <div>
                <span className="text-[#64748B] block">Record Type</span>
                <span className="font-mono font-semibold">TXT</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Host / Name</span>
                <span className="font-mono font-semibold">@</span>
              </div>
              <div>
                <span className="text-[#64748B] block">TTL</span>
                <span className="font-mono font-semibold">3600</span>
              </div>
              <div className="sm:col-span-4">
                <span className="text-[#64748B] block mb-1">TXT Value</span>
                <div className="flex items-center justify-between gap-2 bg-[#F1F5F9] px-3 py-2 rounded-lg">
                  <code className="text-xs break-all text-[#14243A]">{domain.verificationToken}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleCopy(domain.verificationToken)}>
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="secondary" onClick={handleVerify} disabled={checking}>
              <ShieldCheck className="w-4 h-4" />
              {checking ? 'Checking DNS...' : 'Verify TXT Record'}
            </Button>
            <Button type="button" onClick={() => navigate(`/onboarding/dns-setup?domainId=${domain.id}`)}>
              Continue to DNS Setup
            </Button>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}

export function OnboardingDnsSetupPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const [domain, setDomain] = useState<Domain | null>(null);
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    apiFetch<{ domains: (Domain & { dnsRecords: DNSRecord[] })[] }>('/api/domains').then((res) => {
      const targetId = params.get('domainId');
      const found = targetId ? res.domains.find((d) => d.id === targetId) : res.domains[0];
      if (found) {
        setDomain(found);
        setRecords(found.dnsRecords);
      }
    });
  }, [params]);

  const handleCheckAll = async () => {
    if (!domain) return;
    setChecking(true);
    try {
      const res = await apiFetch<{ domain: Domain; dnsRecords: DNSRecord[] }>(`/api/domains/${domain.id}/dns/check`, {
        method: 'POST',
      });
      setDomain(res.domain);
      setRecords(res.dnsRecords);
      notify('DNS health check completed.', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'DNS check failed', 'error');
    } finally {
      setChecking(false);
    }
  };

  const descriptions: Record<string, string> = {
    MX: 'Receives incoming mail for your domain.',
    SPF: 'Identifies authorised Corivo sending servers.',
    DKIM: 'Authenticates outgoing email using cryptographic signatures.',
    DMARC: 'Defines how receiving servers handle messages that fail authentication.',
  };

  return (
    <OnboardingShell
      step={4}
      title="DNS Configuration & Domain Health"
      subtitle="Add MX, SPF, DKIM, and DMARC records so your organisation can send and receive mail reliably."
    >
      {domain && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 p-4 bg-[#F7F9FC] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div><span className="text-[#64748B] block">Ownership</span><StatusText status={domain.ownershipStatus} /></div>
              <div><span className="text-[#64748B] block">MX</span><StatusText status={domain.mxStatus} /></div>
              <div><span className="text-[#64748B] block">SPF</span><StatusText status={domain.spfStatus} /></div>
              <div><span className="text-[#64748B] block">DKIM</span><StatusText status={domain.dkimStatus} /></div>
              <div><span className="text-[#64748B] block">DMARC</span><StatusText status={domain.dmarcStatus} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCheckAll} disabled={checking}>
              {checking ? 'Checking Records...' : 'Check All DNS Records'}
            </Button>
          </div>

          <div className="space-y-3">
            {records
              .filter((r) => r.category !== 'OWNERSHIP')
              .map((rec) => (
                <div key={rec.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-sm font-semibold text-[#14243A]">{rec.category} Record</span>
                      <p className="text-xs text-[#64748B]">{descriptions[rec.category]}</p>
                    </div>
                    <StatusText status={rec.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs bg-[#F7F9FC] p-3 rounded-lg font-mono">
                    <div className="sm:col-span-2"><span className="text-[#94A3B8] block font-sans">Type</span>{rec.type}</div>
                    <div className="sm:col-span-3"><span className="text-[#94A3B8] block font-sans">Host</span>{rec.host}</div>
                    <div className="sm:col-span-5 break-all"><span className="text-[#94A3B8] block font-sans">Value</span>{rec.value}</div>
                    <div className="sm:col-span-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(rec.value);
                          notify(`${rec.category} value copied`, 'info');
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  {rec.errorMessage && <p className="mt-2 text-xs text-[#DC2626]">{rec.errorMessage}</p>}
                </div>
              ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => navigate(`/onboarding/mailbox?domainId=${domain.id}`)}>
              Continue to Mailbox Creation
            </Button>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}

export function OnboardingMailboxPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [createdList, setCreatedList] = useState<Mailbox[]>([]);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    domainId: '',
    password: '',
    roleKey: 'MAILBOX_USER' as 'OWNER' | 'ADMIN' | 'MAILBOX_USER',
    quotaMb: 10240,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ domains: Domain[] }>('/api/domains').then((res) => {
      setDomains(res.domains);
      if (res.domains[0]) setForm((f) => ({ ...f, domainId: res.domains[0].id }));
    });
  }, []);

  const selectedDomain = domains.find((d) => d.id === form.domainId);
  const previewEmail = form.username && selectedDomain ? `${form.username.toLowerCase()}@${selectedDomain.domainName}` : 'user@domain';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ mailbox: Mailbox }>('/api/mailboxes', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setCreatedList((prev) => [...prev, res.mailbox]);
      setForm((f) => ({ ...f, firstName: '', lastName: '', username: '', password: '' }));
      notify(`Mailbox ${res.mailbox.emailAddress} created successfully.`, 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to create mailbox', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingShell
      step={5}
      title="Create your first business mailbox"
      subtitle="Provision accounts like admin@company.com or support@company.com."
    >
      <form onSubmit={handleCreate} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="mb-fn">First Name</FieldLabel>
            <Input id="mb-fn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </div>
          <div>
            <FieldLabel htmlFor="mb-ln">Last Name</FieldLabel>
            <Input id="mb-ln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="mb-user" hint={`Preview: ${previewEmail}`}>Username</FieldLabel>
            <Input id="mb-user" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="admin" required />
          </div>
          <div>
            <FieldLabel htmlFor="mb-dom">Domain</FieldLabel>
            <Select id="mb-dom" value={form.domainId} onChange={(e) => setForm({ ...form, domainId: e.target.value })}>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>{d.domainName}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel htmlFor="mb-pw">Initial Password</FieldLabel>
            <Input id="mb-pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 10 chars + symbol" required />
          </div>
          <div>
            <FieldLabel htmlFor="mb-role">Role</FieldLabel>
            <Select id="mb-role" value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value as 'ADMIN' | 'MAILBOX_USER' })}>
              <option value="MAILBOX_USER">Mailbox User</option>
              <option value="ADMIN">Organisation Admin</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="mb-quota">Storage Quota</FieldLabel>
            <Select id="mb-quota" value={form.quotaMb} onChange={(e) => setForm({ ...form, quotaMb: Number(e.target.value) })}>
              <option value={5120}>5 GB</option>
              <option value={10240}>10 GB</option>
              <option value={25600}>25 GB</option>
              <option value={51200}>50 GB</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button type="submit" variant="secondary" disabled={submitting}>
            <MailPlus className="w-4 h-4" />
            {submitting ? 'Creating...' : 'Create Mailbox'}
          </Button>
          <Button type="button" onClick={() => navigate('/onboarding/complete')}>
            Finish Onboarding
          </Button>
        </div>
      </form>

      {createdList.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-200">
          <h3 className="text-xs font-semibold text-[#64748B] mb-2">Created in this session</h3>
          <div className="space-y-2">
            {createdList.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs bg-[#F7F9FC] px-3 py-2 rounded-lg border border-slate-200">
                <span className="font-mono font-medium text-[#14243A]">{m.emailAddress}</span>
                <StatusText status={m.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}

export function OnboardingCompletePage() {
  const { session, refreshSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    apiFetch('/api/onboarding/complete', { method: 'POST' })
      .then(() => refreshSession())
      .catch(() => {});
  }, [refreshSession]);

  return (
    <OnboardingShell
      step={6}
      title="Your organisation workspace is ready"
      subtitle="You can now open the webmail workspace or manage domains and users in the Admin Console."
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-950">
            <p className="font-semibold">Onboarding checklist completed for {session?.organisation?.name}</p>
            <p className="text-xs mt-1 text-emerald-800">
              Primary domain: {session?.organisation?.primaryDomain || 'Configured in Admin Console'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => navigate('/app/mail/inbox')}>Open Mail</Button>
          <Button variant="outline" onClick={() => navigate('/admin/overview')}>Open Admin Console</Button>
        </div>
      </div>
    </OnboardingShell>
  );
}
