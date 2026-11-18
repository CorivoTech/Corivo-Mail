import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Globe, Lock, Mail, Server, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout.tsx';
import { Button, Card, FieldLabel, Input, Textarea } from '../../components/ui/Primitives.tsx';
import { useToast } from '../../context/ToastContext.tsx';

export function FeaturesPage() {
  const sections = [
    {
      icon: Mail,
      title: 'Unified Webmail Workspace',
      items: ['Three-column desktop layout & responsive mobile view', 'Rich-text compose with 25 MB attachment policy', 'Custom folders, snooze scheduling, spam quarantine, and search'],
    },
    {
      icon: Globe,
      title: 'Domain & DNS Verification',
      items: ['Guided TXT ownership verification', 'MX, SPF, DKIM (2048-bit), and DMARC diagnostic cards', 'Multi-domain mailbox routing under one organisation'],
    },
    {
      icon: Server,
      title: 'Infrastructure Integration Architecture',
      items: ['Postfix SMTP transport & bounce event tracking', 'Dovecot IMAP mailbox synchronisation interface', 'Rspamd spam scoring, ClamAV scanning, and OpenSearch adapters'],
    },
  ];

  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#14243A]">
            Everything Needed to Run Business Email
          </h1>
          <p className="mt-3 text-[#64748B]">
            From domain onboarding and employee provisioning to daily webmail collaboration, Contacts, and Calendar.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {sections.map((s) => (
            <Card key={s.title} className="p-6">
              <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] text-[#2563EB] flex items-center justify-center mb-4">
                <s.icon className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold text-[#14243A]">{s.title}</h2>
              <ul className="mt-4 space-y-2.5 text-sm text-[#64748B]">
                {s.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="mt-12">
          <Link to="/signup">
            <Button size="lg">Create Your Organisation</Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}

export function SecurityPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center gap-2 text-sm font-medium text-[#2563EB] mb-3">
          <ShieldCheck className="w-4 h-4" />
          <span>Security &amp; Governance</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#14243A]">
          Multi-Tenant Isolation and Email Authentication
        </h1>
        <p className="mt-3 text-[#64748B] max-w-2xl">
          Security controls are enforced at the API and database boundary, not merely hidden in the interface.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: Lock,
              title: 'Authentication & Session Security',
              desc: 'Salted cryptographic password hashing, HTTP-only SameSite cookies, per-IP login rate limiting, password reset expiration, and individual session revocation.',
            },
            {
              icon: ShieldCheck,
              title: 'Tenant & Role Boundaries',
              desc: 'Strict organisationId scoping across all queries. Platform Super Admins manage tenant health without default access to customer email content.',
            },
            {
              icon: Globe,
              title: 'Email Transport Authentication',
              desc: 'Built around SPF, 2048-bit DKIM signing keys, DMARC policies, TLS transport checks, and quarantine workflows.',
            },
            {
              icon: Server,
              title: 'India DPDP Act 2023 Readiness',
              desc: 'Architecture supports data retention configuration, account suspension, data export workflows, and append-only audit logs.',
            },
          ].map((c) => (
            <Card key={c.title} className="p-6">
              <c.icon className="w-5 h-5 text-[#2563EB] mb-3" />
              <h2 className="text-base font-semibold text-[#14243A]">{c.title}</h2>
              <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{c.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}

export function PricingPage() {
  return (
    <PublicLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#14243A]">
            Illustrative Commercial Plans (INR)
          </h1>
          <p className="mt-3 text-[#64748B]">
            These figures illustrate planned per-seat pricing for Indian businesses. Billing remains in sandbox mode until Razorpay credentials are configured.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto">
          <Card className="p-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748B]">
                  <th className="py-3 font-medium">Capability</th>
                  <th className="py-3 font-medium">Starter (₹149/mo)</th>
                  <th className="py-3 font-medium">Business (₹299/mo)</th>
                  <th className="py-3 font-medium">Enterprise (₹549/mo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-3.5 font-medium">Mailbox Storage Quota</td>
                  <td className="py-3.5 font-mono">10 GB</td>
                  <td className="py-3.5 font-mono">30 GB</td>
                  <td className="py-3.5 font-mono">100 GB</td>
                </tr>
                <tr>
                  <td className="py-3.5 font-medium">Custom Domains</td>
                  <td className="py-3.5 font-mono">1</td>
                  <td className="py-3.5 font-mono">10</td>
                  <td className="py-3.5 font-mono">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 font-medium">Shared Mailboxes &amp; Groups</td>
                  <td className="py-3.5 text-[#64748B]">Aliases only</td>
                  <td className="py-3.5 text-[#16A34A] font-medium">Included</td>
                  <td className="py-3.5 text-[#16A34A] font-medium">Included</td>
                </tr>
                <tr>
                  <td className="py-3.5 font-medium">Compliance Audit Logs</td>
                  <td className="py-3.5 text-[#64748B]">30-day activity</td>
                  <td className="py-3.5 text-[#64748B]">90-day activity</td>
                  <td className="py-3.5 text-[#16A34A] font-medium">Full append-only export</td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}

export function SupportPage() {
  const { notify } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.includes('@') || message.trim().length < 10) {
      notify('Please fill out your name, valid email, and inquiry details.', 'error');
      return;
    }
    setSubmitted(true);
    notify('Support inquiry recorded in development mode.', 'info');
  };

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-display text-3xl font-bold text-[#14243A]">Support &amp; DNS Documentation</h1>
        <p className="mt-2 text-[#64748B]">
          Need assistance with MX cutover, SPF/DKIM setup, or IMAP mailbox migration?
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="p-6">
            <h2 className="text-base font-semibold text-[#14243A] mb-4">Quick DNS Setup Reference</h2>
            <div className="space-y-3 text-xs text-[#64748B]">
              <div>
                <p className="font-semibold text-[#172033]">1. Ownership TXT</p>
                <p className="mt-0.5">Add the generated <code className="text-[#14243A]">corivo-verify=...</code> TXT record on <code className="text-[#14243A]">@</code>.</p>
              </div>
              <div>
                <p className="font-semibold text-[#172033]">2. Mail Exchangers (MX)</p>
                <p className="mt-0.5">Point MX priority 10 to <code className="text-[#14243A]">mx1.corivomail.example</code> and priority 20 to <code className="text-[#14243A]">mx2.corivomail.example</code>.</p>
              </div>
              <div>
                <p className="font-semibold text-[#172033]">3. SPF, DKIM &amp; DMARC</p>
                <p className="mt-0.5">Publish SPF, the 2048-bit <code className="text-[#14243A]">corivo1._domainkey</code> TXT record, and <code className="text-[#14243A]">_dmarc</code> policy.</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-[#14243A] mb-4">Contact Corivo Support</h2>
            {submitted ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-[#16A34A] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#172033]">Inquiry Logged</p>
                <p className="text-xs text-[#64748B] mt-1">
                  In production, this creates a ticket in the Corivo Support queue for {email}.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setSubmitted(false)}>
                  Send Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <FieldLabel htmlFor="sup-name">Your Name</FieldLabel>
                  <Input id="sup-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Razeen Iqbal" />
                </div>
                <div>
                  <FieldLabel htmlFor="sup-email">Business Email</FieldLabel>
                  <Input id="sup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.example" />
                </div>
                <div>
                  <FieldLabel htmlFor="sup-msg">How can we help?</FieldLabel>
                  <Textarea id="sup-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your domain or mailbox question..." />
                </div>
                <Button type="submit" className="w-full">Submit Inquiry</Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}
