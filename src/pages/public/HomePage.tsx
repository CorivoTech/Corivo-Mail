import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Globe,
  Inbox,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout.tsx';
import { Button, Card, StatusText } from '../../components/ui/Primitives.tsx';

export function HomePage() {
  const [previewTab, setPreviewTab] = useState<'webmail' | 'dns'>('webmail');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Can our organisation use an existing domain like company.in or company.com?',
      a: 'Yes. During onboarding you add any domain you own, verify ownership with a DNS TXT record, and configure MX, SPF, DKIM, and DMARC records with step-by-step validation.',
    },
    {
      q: 'How is tenant data isolated between organisations?',
      a: 'Every domain, mailbox, folder, message metadata record, contact, and audit entry is scoped to an organisation identifier and verified server-side on every request.',
    },
    {
      q: 'Can Organisation Owners restrict what IT Admins can modify?',
      a: 'Yes. Corivo Mail separates Organisation Owner, Organisation Admin, Mailbox User, and Platform Super Admin roles with a configurable server-enforced permission matrix.',
    },
    {
      q: 'Are the listed INR prices live commercial contracts?',
      a: 'No. Displayed INR plans are illustrative estimates while payment gateway integration remains in sandbox mode.',
    },
  ];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-medium text-[#2563EB] mb-3">
              Corivo Mail by Corivo Tech · Built for India &amp; Global Organisations
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#14243A] text-balance leading-[1.12]">
              Business Email. Built Around Your Domain.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#64748B] leading-relaxed max-w-2xl mx-auto">
              Give your organisation professional email with domain control, secure communication and simple mailbox management.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/features">
                <Button variant="outline" size="lg">
                  Explore Features
                </Button>
              </Link>
            </div>
          </div>

          {/* Interactive Product Preview */}
          <div className="mt-14 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewTab('webmail')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    previewTab === 'webmail'
                      ? 'bg-white text-[#14243A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#14243A]'
                  }`}
                >
                  Webmail Workspace
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('dns')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    previewTab === 'dns'
                      ? 'bg-white text-[#14243A] shadow-xs'
                      : 'text-[#64748B] hover:text-[#14243A]'
                  }`}
                >
                  Domain &amp; DNS Console
                </button>
              </div>
              <span className="text-xs text-[#64748B] hidden sm:inline">
                Interactive product preview · Corivo Technologies
              </span>
            </div>

            <Card className="overflow-hidden shadow-sm">
              {previewTab === 'webmail' ? (
                <div className="grid grid-cols-1 md:grid-cols-12 min-h-[340px]">
                  <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-slate-200 bg-[#F7F9FC] p-4 space-y-1.5">
                    <div className="px-3 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-medium text-center mb-3">
                      Compose Email
                    </div>
                    {[
                      { name: 'Inbox', count: 4, active: true },
                      { name: 'Starred', count: 3, active: false },
                      { name: 'Sent', count: 0, active: false },
                      { name: 'Drafts', count: 1, active: false },
                      { name: 'Client Proposals', count: 1, active: false },
                    ].map((f) => (
                      <div
                        key={f.name}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                          f.active ? 'bg-white font-semibold text-[#14243A] border border-slate-200' : 'text-[#64748B]'
                        }`}
                      >
                        <span>{f.name}</span>
                        {f.count > 0 && <span className="font-mono tabular-nums">{f.count}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 divide-y divide-slate-100">
                    {[
                      { from: 'Neha Deshmukh', subj: 'Enterprise Email Onboarding — 120 Mailboxes', time: '10:42 AM', unread: true },
                      { from: 'Aarav Mehta', subj: 'DMARC enforcement promoted to p=quarantine', time: '09:15 AM', unread: true },
                      { from: 'Ananya Sharma', subj: 'October GST Reconciliation & Storage Review', time: 'Yesterday', unread: false },
                    ].map((m) => (
                      <div key={m.subj} className="p-3.5 hover:bg-slate-50">
                        <div className="flex items-center justify-between text-xs">
                          <span className={m.unread ? 'font-semibold text-[#172033]' : 'text-[#64748B]'}>{m.from}</span>
                          <span className="font-mono text-[11px] text-[#94A3B8]">{m.time}</span>
                        </div>
                        <p className={`text-xs mt-1 truncate ${m.unread ? 'font-medium text-[#172033]' : 'text-[#64748B]'}`}>
                          {m.subj}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="md:col-span-5 p-5 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#172033]">
                          Enterprise Email Onboarding — 120 Mailboxes
                        </h3>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          neha.deshmukh@meridianbank.example · To: razeen@corivotech.example
                        </p>
                      </div>
                      <StatusText status="CLEAN" label="SPF/DKIM Pass" />
                    </div>
                    <p className="text-xs text-[#172033] leading-relaxed mt-4">
                      Hi Razeen, our IT committee reviewed the Corivo Mail domain isolation architecture and would like to proceed with onboarding 120 employee mailboxes across our primary domain.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <h3 className="text-sm font-semibold text-[#14243A]">Domain Health — corivotech.example</h3>
                      <p className="text-xs text-[#64748B] mt-0.5">Primary Domain · Verified MX, SPF, DKIM (2048-bit), DMARC</p>
                    </div>
                    <StatusText status="VERIFIED" label="All DNS Checks Passed" />
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[#64748B]">
                          <th className="py-2 font-medium">Type</th>
                          <th className="py-2 font-medium">Host</th>
                          <th className="py-2 font-medium">Value</th>
                          <th className="py-2 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        <tr>
                          <td className="py-2.5">MX</td>
                          <td className="py-2.5">@</td>
                          <td className="py-2.5 text-[#64748B]">mx1.corivomail.example (Priority 10)</td>
                          <td className="py-2.5 text-right"><StatusText status="VERIFIED" /></td>
                        </tr>
                        <tr>
                          <td className="py-2.5">TXT (SPF)</td>
                          <td className="py-2.5">@</td>
                          <td className="py-2.5 text-[#64748B]">v=spf1 include:_spf.corivomail.example ~all</td>
                          <td className="py-2.5 text-right"><StatusText status="VERIFIED" /></td>
                        </tr>
                        <tr>
                          <td className="py-2.5">TXT (DKIM)</td>
                          <td className="py-2.5">corivo1._domainkey</td>
                          <td className="py-2.5 text-[#64748B]">v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0B...</td>
                          <td className="py-2.5 text-right"><StatusText status="VERIFIED" /></td>
                        </tr>
                        <tr>
                          <td className="py-2.5">TXT (DMARC)</td>
                          <td className="py-2.5">_dmarc</td>
                          <td className="py-2.5 text-[#64748B]">v=DMARC1; p=quarantine; pct=100</td>
                          <td className="py-2.5 text-right"><StatusText status="VERIFIED" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#14243A] text-balance">
            Designed for reliable company email and straightforward IT control
          </h2>
          <p className="mt-3 text-[#64748B]">
            Every organisation receives an isolated webmail workspace for employees alongside a dedicated administrative console.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Mail,
              title: '01. Professional Business Email',
              desc: 'Create admin@, support@, finance@, and employee mailboxes on your own domain with folders, threading, rich compose, signatures, and 25 MB attachments.',
            },
            {
              icon: Globe,
              title: '02. Guided Domain Management',
              desc: 'Add multiple company domains, verify TXT ownership, and inspect MX, SPF, DKIM, and DMARC status with plain-language diagnostics.',
            },
            {
              icon: ShieldCheck,
              title: '03. Security & Spam Protection',
              desc: 'Role-based access control, HTTP-only session management, password complexity enforcement, Rspamd spam scoring, and attachment scanning adapters.',
            },
            {
              icon: Users,
              title: '04. Organisation Administration',
              desc: 'Provision or suspend employee mailboxes, adjust per-user storage quotas, manage aliases and distribution groups, and review activity logs.',
            },
            {
              icon: Inbox,
              title: '05. Deliverability Monitoring',
              desc: 'Track outbound acceptance, deferred retries, and bounce events cleanly separated from domain DNS configuration status.',
            },
            {
              icon: Lock,
              title: '06. Privacy & Tenant Isolation',
              desc: 'Strict server-enforced organisation boundaries ensure internal customer mail stays private and separated across tenants.',
            },
          ].map((item) => (
            <Card key={item.title} className="p-6">
              <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] text-[#2563EB] flex items-center justify-center mb-4">
                <item.icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-[#14243A]">{item.title}</h3>
              <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Why Corivo Mail */}
      <section className="bg-white border-y border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#14243A]">
              Why growing Indian &amp; global teams choose Corivo Mail
            </h2>
            <p className="mt-3 text-[#64748B] leading-relaxed">
              Instead of wrestling with fragmented cPanel mail settings or bloated office suites, Corivo Mail unifies webmail, DNS authentication, and employee mailbox governance in one focused platform.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[#172033]">
              {[
                'Asia/Kolkata default timezone with internationalisation-ready preferences',
                'Clear separation between Employee Workspace, Organisation Admin, and Platform Ops',
                'Honest infrastructure adapters for Postfix, Dovecot, Rspamd, ClamAV, and OpenSearch',
                'Contacts, Calendar, Shared Mailboxes, and IMAP Migration Centre built in',
              ].map((pt) => (
                <li key={pt} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-6">
            <Card className="p-6 bg-[#F7F9FC]">
              <h3 className="text-sm font-semibold text-[#14243A] mb-4">Built-in Role Separation</h3>
              <div className="space-y-3 text-xs">
                {[
                  { role: 'Organisation Owner', scope: 'Legal profile, domains, billing, roles, security policies, mailboxes' },
                  { role: 'Organisation Admin', scope: 'User provisioning, mailbox quotas, DNS verification, usage reports' },
                  { role: 'Mailbox User', scope: 'Personal webmail, custom folders, contacts, calendar, profile & sessions' },
                  { role: 'Platform Super Admin', scope: 'Multi-tenant health, org status, platform policies without reading mail' },
                ].map((r) => (
                  <div key={r.role} className="flex items-start justify-between gap-4 bg-white p-3.5 rounded-lg border border-slate-200">
                    <span className="font-semibold text-[#14243A] shrink-0">{r.role}</span>
                    <span className="text-[#64748B] text-right">{r.scope}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Illustrative Pricing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#14243A]">
            Transparent, Illustrative Plans in INR
          </h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Indicative per-mailbox pricing shown for planning purposes. Billing operates in sandbox mode until commercial payment keys are configured.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'Starter',
              audience: 'For early-stage startups & small teams',
              price: '₹149',
              features: ['10 GB mailbox storage', '1 custom business domain', 'SPF & DKIM authentication', 'Webmail, Contacts & Calendar'],
            },
            {
              name: 'Business',
              audience: 'For growing organisations & schools',
              price: '₹299',
              featured: true,
              features: ['30 GB mailbox storage', 'Up to 10 custom domains', 'Aliases, groups & shared mailboxes', 'Deliverability & queue monitoring'],
            },
            {
              name: 'Enterprise',
              audience: 'For multi-department enterprises',
              price: '₹549',
              features: ['100 GB mailbox storage', 'Unlimited domains & sub-domains', 'Compliance audit logs & retention', 'Dedicated migration & security policies'],
            },
          ].map((plan) => (
            <Card
              key={plan.name}
              className={`p-6 flex flex-col justify-between ${plan.featured ? 'border-[#2563EB]' : ''}`}
            >
              <div>
                <h3 className="text-lg font-bold text-[#14243A]">{plan.name}</h3>
                <p className="text-xs text-[#64748B] mt-1">{plan.audience}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold text-[#14243A] tabular-nums">{plan.price}</span>
                  <span className="text-xs text-[#64748B]">/ mailbox / month (illustrative)</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm text-[#172033]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/signup" className="mt-8 block">
                <Button variant={plan.featured ? 'primary' : 'outline'} className="w-full">
                  Start With {plan.name}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-slate-200 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-[#14243A] text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
            {faqs.map((faq, idx) => (
              <div key={faq.q} className="p-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between text-left gap-4 cursor-pointer"
                >
                  <span className="text-sm font-semibold text-[#172033]">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#64748B] shrink-0 transition-transform ${
                      openFaq === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <p className="mt-3 text-sm text-[#64748B] leading-relaxed">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
