import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  HardDrive,
  KeyRound,
  Mail,
  Network,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout.tsx';
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
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { formatDateTime, formatStorageMb } from '../../lib/utils.ts';
import type {
  Alias,
  DistributionGroup,
  Domain,
  Mailbox,
  PermissionKey,
  RoleDefinition,
  RoleKey,
} from '../../shared/types.ts';

interface EnrichedMailbox extends Mailbox {
  domainName: string;
  department: string;
  jobTitle: string;
}

interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  phone: string;
  roleKey: RoleKey;
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
  mailbox: Mailbox | null;
}

// Screen 43: Mailbox List
export function AdminMailboxesPage() {
  const { session, hasPermission } = useAuth();
  const { notify, confirm } = useToast();
  const [mailboxes, setMailboxes] = useState<EnrichedMailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [editTarget, setEditTarget] = useState<EnrichedMailbox | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editQuotaGb, setEditQuotaGb] = useState(10);
  const [editRoleKey, setEditRoleKey] = useState<RoleKey>('MAILBOX_USER');

  const [resetTarget, setResetTarget] = useState<EnrichedMailbox | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [mbPage, setMbPage] = useState(1);
  const mbPageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await apiFetch<{ mailboxes: EnrichedMailbox[] }>(`/api/mailboxes?${params.toString()}`);
      setMailboxes(res.mailboxes);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to load mailboxes', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, notify]);

  useEffect(() => {
    setMbPage(1);
    load();
  }, [load]);

  const openEdit = (mb: EnrichedMailbox) => {
    setEditTarget(mb);
    setEditDisplayName(mb.displayName);
    setEditQuotaGb(Math.max(1, Math.round(mb.quotaMb / 1024)));
    setEditRoleKey(mb.roleKey);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/mailboxes/${editTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          quotaMb: editQuotaGb * 1024,
          roleKey: editRoleKey,
        }),
      });
      notify(`Updated ${editTarget.emailAddress}`, 'success');
      setEditTarget(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to update mailbox', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSuspendToggle = async (mb: EnrichedMailbox) => {
    const isSuspended = mb.status === 'SUSPENDED';
    const ok = await confirm({
      title: isSuspended ? `Reactivate ${mb.emailAddress}?` : `Suspend ${mb.emailAddress}?`,
      description: isSuspended
        ? 'The user will regain mailbox sign-in access immediately.'
        : 'All active webmail sessions for this mailbox will be revoked immediately.',
      confirmLabel: isSuspended ? 'Reactivate' : 'Suspend Mailbox',
      destructive: !isSuspended,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/mailboxes/${mb.id}/${isSuspended ? 'reactivate' : 'suspend'}`, {
        method: 'POST',
      });
      notify(`${mb.emailAddress} ${isSuspended ? 'reactivated' : 'suspended'}.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Operation failed', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/mailboxes/${resetTarget.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      notify(`Password updated for ${resetTarget.emailAddress} and sessions revoked.`, 'success');
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Password reset failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mb: EnrichedMailbox) => {
    const ok = await confirm({
      title: `Delete mailbox ${mb.emailAddress}?`,
      description: 'This permanently deletes the mailbox and its stored messages in this organisation.',
      confirmLabel: 'Delete Mailbox',
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/mailboxes/${mb.id}`, { method: 'DELETE' });
      notify(`Mailbox ${mb.emailAddress} deleted.`, 'info');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Delete failed', 'error');
    }
  };

  return (
    <AdminLayout
      title="Mailboxes"
      subtitle="Provision, allocate storage quotas, suspend access, and reset credentials for organisation mailboxes."
      actions={
        hasPermission('mailboxes.create') && (
          <Link to="/admin/mailboxes/new">
            <Button>
              <Plus className="w-4 h-4" />
              Create Mailbox
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
            placeholder="Search by address or display name..."
            className="pl-9"
          />
        </div>
        <div className="w-44">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active only</option>
            <option value="SUSPENDED">Suspended only</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} />
        ) : mailboxes.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No mailboxes match your filter"
            description="Adjust your search query or create a new business mailbox on one of your domains."
            action={
              hasPermission('mailboxes.create') ? (
                <Link to="/admin/mailboxes/new">
                  <Button size="sm">Create Mailbox</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Mailbox</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Storage Used</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Last Activity</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {mailboxes.slice((mbPage - 1) * mbPageSize, mbPage * mbPageSize).map((mb) => {
                  const pct = Math.min(100, Math.round((mb.usedMb / mb.quotaMb) * 100));
                  const isSelf = mb.userId === session?.user.id;
                  return (
                    <tr key={mb.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                      <td className="py-3.5 px-4">
                        <Link to={`/admin/mailboxes/${mb.id}`} className="flex items-center gap-3 group">
                          <Avatar name={mb.displayName} size="sm" />
                          <div>
                            <p className="font-semibold text-[#14243A] dark:text-slate-100 group-hover:text-[#2563EB]">
                              {mb.displayName}
                            </p>
                            <p className="font-mono text-[11px] text-[#64748B]">{mb.emailAddress}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-[#64748B]">{mb.roleKey.replace(/_/g, ' ')}</td>
                      <td className="py-3.5 px-4">
                        <div className="w-36">
                          <div className="flex justify-between font-mono text-[11px] mb-1">
                            <span>{formatStorageMb(mb.usedMb)}</span>
                            <span className="text-[#94A3B8]">/ {formatStorageMb(mb.quotaMb)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 85 ? 'bg-[#DC2626]' : 'bg-[#2563EB]'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusText status={mb.status} />
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#64748B]">
                        {formatDateTime(mb.lastActivityAt, session?.organisation?.timezone, 'short')}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {hasPermission('quotas.change') && (
                            <Button size="sm" variant="outline" onClick={() => openEdit(mb)}>
                              Edit
                            </Button>
                          )}
                          {hasPermission('users.manage') && (
                            <Button size="sm" variant="ghost" onClick={() => setResetTarget(mb)} title="Reset Password">
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {hasPermission('mailboxes.suspend') && !isSelf && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSuspendToggle(mb)}
                              title={mb.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                            >
                              {mb.status === 'SUSPENDED' ? (
                                <UserCheck className="w-3.5 h-3.5 text-[#16A34A]" />
                              ) : (
                                <UserX className="w-3.5 h-3.5 text-[#D97706]" />
                              )}
                            </Button>
                          )}
                          {hasPermission('mailboxes.delete') && !isSelf && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(mb)}
                              title="Delete mailbox"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && mailboxes.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-[#64748B]">
            <span className="font-mono tabular-nums">
              Showing {(mbPage - 1) * mbPageSize + 1}–{Math.min(mbPage * mbPageSize, mailboxes.length)} of {mailboxes.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mbPage <= 1}
                onClick={() => setMbPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={mbPage * mbPageSize >= mailboxes.length}
                onClick={() => setMbPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Mailbox Modal */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit Mailbox & Quota"
        description={editTarget?.emailAddress}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <FieldLabel>Display Name</FieldLabel>
            <Input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} required />
          </div>
          <div>
            <FieldLabel hint="Minimum 1 GB">Storage Quota (GB)</FieldLabel>
            <Input
              type="number"
              min={1}
              max={1000}
              value={editQuotaGb}
              onChange={(e) => setEditQuotaGb(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <FieldLabel>Role</FieldLabel>
            <Select value={editRoleKey} onChange={(e) => setEditRoleKey(e.target.value as RoleKey)}>
              <option value="MAILBOX_USER">Mailbox User</option>
              <option value="ADMIN">Organisation Admin</option>
              {session?.membership?.roleKey === 'OWNER' && <option value="OWNER">Organisation Owner</option>}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="Reset Mailbox Password"
        description={`Set a new temporary password for ${resetTarget?.emailAddress}. Existing sessions will be signed out.`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <FieldLabel hint="Minimum 10 characters">New Temporary Password</FieldLabel>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={10}
              required
              placeholder="Enter strong temporary password"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Updating...' : 'Reset Password'}</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}

// Screen 44: Create Mailbox
export function AdminCreateMailboxPage() {
  const { session, hasPermission } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [domainsError, setDomainsError] = useState<string | null>(null);
  const [domainId, setDomainId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [quotaGb, setQuotaGb] = useState(10);
  const [roleKey, setRoleKey] = useState<'ADMIN' | 'MAILBOX_USER'>('MAILBOX_USER');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = hasPermission('mailboxes.create');

  const loadDomains = useCallback(async () => {
    setLoadingDomains(true);
    setDomainsError(null);
    try {
      const res = await apiFetch<{ domains: Domain[] }>('/api/domains');
      setDomains(res.domains);
      if (res.domains.length > 0) {
        const primary = res.domains.find((d) => d.isPrimary) || res.domains[0];
        setDomainId((prev) => prev || primary.id);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load organisation domains';
      setDomainsError(msg);
      notify(msg, 'error');
    } finally {
      setLoadingDomains(false);
    }
  }, [notify]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  const selectedDomain = domains.find((d) => d.id === domainId);
  const previewAddress = `${username.trim().toLowerCase() || 'username'}@${selectedDomain?.domainName || 'yourdomain.com'}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/mailboxes', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim().toLowerCase(),
          domainId,
          password,
          quotaMb: quotaGb * 1024,
          roleKey,
        }),
      });
      notify(`Mailbox ${previewAddress} created successfully.`, 'success');
      navigate('/admin/mailboxes');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to create mailbox', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout
      title="Create Mailbox"
      subtitle="Provision a new business email account and user profile in your organisation."
      actions={
        <Link to="/admin/mailboxes">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4" />
            Back to Mailboxes
          </Button>
        </Link>
      }
    >
      <div className="max-w-2xl">
        {!canCreate ? (
          <EmptyState
            icon={Shield}
            title="Permission required"
            description="Your role does not include mailboxes.create permission to provision new mailboxes."
            action={<Link to="/admin/mailboxes"><Button size="sm" variant="outline">Back to Mailboxes</Button></Link>}
          />
        ) : loadingDomains ? (
          <Card className="p-6"><SkeletonRows rows={5} /></Card>
        ) : domainsError ? (
          <Card className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
            <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{domainsError}</span>
            <Button size="sm" variant="outline" onClick={loadDomains}>Retry</Button>
          </Card>
        ) : domains.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No organisation domains available"
            description="Add a custom domain before creating business mailboxes for your team."
            action={<Link to="/admin/domains/add"><Button size="sm">Add Domain</Button></Link>}
          />
        ) : (
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>First Name</FieldLabel>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Meera" />
                </div>
                <div>
                  <FieldLabel>Last Name</FieldLabel>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Nair" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel hint="Letters, numbers, dots, hyphens">Mailbox Username</FieldLabel>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="meera.nair"
                  />
                </div>
                <div>
                  <FieldLabel>Organisation Domain</FieldLabel>
                  <Select value={domainId} onChange={(e) => setDomainId(e.target.value)} required>
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        @{d.domainName} ({d.ownershipStatus})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-xs text-[#64748B]">Generated Mailbox Address</span>
                <span className="font-mono text-sm font-semibold text-[#14243A] dark:text-white truncate">{previewAddress}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel hint="Min 10 characters">Initial Password</FieldLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={10}
                    required
                    placeholder="Strong temporary password"
                  />
                </div>
                <div>
                  <FieldLabel>Storage Quota (GB)</FieldLabel>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={quotaGb}
                    onChange={(e) => setQuotaGb(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Organisation Role</FieldLabel>
                <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value as 'ADMIN' | 'MAILBOX_USER')}>
                  <option value="MAILBOX_USER">Mailbox User — Standard webmail &amp; workspace access</option>
                  <option value="ADMIN">Organisation Admin — Manages domains, mailboxes &amp; policies</option>
                </Select>
                <p className="text-[11px] text-[#64748B] mt-1">
                  {session?.organisation?.name} default quota is 10 GB per mailbox.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Link to="/admin/mailboxes">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
                <Button type="submit" disabled={submitting || !domainId}>
                  {submitting ? 'Provisioning...' : 'Provision Mailbox'}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

// Screen 45: Mailbox Details
export function AdminMailboxDetailPage() {
  const { id } = useParams();
  const { session, hasPermission } = useAuth();
  const { notify, confirm } = useToast();
  const [data, setData] = useState<{
    mailbox: Mailbox;
    domain: Domain | null;
    user: { id: string; firstName: string; lastName: string; jobTitle: string; department: string; phone: string; lastLoginAt: string | null } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotaGb, setQuotaGb] = useState(10);
  const [savingQuota, setSavingQuota] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [savingReset, setSavingReset] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NonNullable<typeof data>>(`/api/mailboxes/${id}`);
      setData(res);
      if (res?.mailbox) {
        setQuotaGb(Math.max(1, Math.round(res.mailbox.quotaMb / 1024)));
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Mailbox not found';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleQuotaSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSavingQuota(true);
    try {
      await apiFetch(`/api/mailboxes/${data.mailbox.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quotaMb: quotaGb * 1024 }),
      });
      notify('Mailbox quota updated.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to update quota', 'error');
    } finally {
      setSavingQuota(false);
    }
  };

  const handleSuspendToggle = async () => {
    if (!data) return;
    const isSuspended = data.mailbox.status === 'SUSPENDED';
    const ok = await confirm({
      title: isSuspended ? `Reactivate ${data.mailbox.emailAddress}?` : `Suspend ${data.mailbox.emailAddress}?`,
      description: isSuspended
        ? 'The user will regain mailbox sign-in access immediately.'
        : 'All active webmail sessions for this mailbox will be revoked immediately.',
      confirmLabel: isSuspended ? 'Reactivate' : 'Suspend Mailbox',
      destructive: !isSuspended,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/mailboxes/${data.mailbox.id}/${isSuspended ? 'reactivate' : 'suspend'}`, {
        method: 'POST',
      });
      notify(`${data.mailbox.emailAddress} ${isSuspended ? 'reactivated' : 'suspended'}.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Operation failed', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSavingReset(true);
    try {
      await apiFetch(`/api/mailboxes/${data.mailbox.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      notify(`Password updated for ${data.mailbox.emailAddress} and active sessions revoked.`, 'success');
      setResetOpen(false);
      setNewPassword('');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Password reset failed', 'error');
    } finally {
      setSavingReset(false);
    }
  };

  const isSelf = data?.mailbox.userId === session?.user.id;

  return (
    <AdminLayout
      title={data?.mailbox.emailAddress || 'Mailbox Details'}
      subtitle="Mailbox identity, quota utilisation, and domain binding."
      actions={
        <Link to="/admin/mailboxes">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4" />
            All Mailboxes
          </Button>
        </Link>
      }
    >
      {loading ? (
        <Card className="p-6"><SkeletonRows rows={4} /></Card>
      ) : error || !data ? (
        <EmptyState
          icon={Mail}
          title="Mailbox not available"
          description={error || 'The requested mailbox could not be found in this organisation.'}
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={load}>Retry</Button>
              <Link to="/admin/mailboxes"><Button size="sm">Back to Mailboxes</Button></Link>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar name={data.mailbox.displayName} size="lg" />
                <div>
                  <h2 className="font-display text-lg font-bold text-[#14243A] dark:text-white">
                    {data.mailbox.displayName}
                  </h2>
                  <p className="font-mono text-xs text-[#64748B]">{data.mailbox.emailAddress}</p>
                  <div className="mt-1.5 flex items-center gap-4">
                    <StatusText status={data.mailbox.status} />
                    <span className="text-xs text-[#64748B]">Role: {data.mailbox.roleKey.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {data.user && (
                  <Link to={`/admin/users/${data.user.id}`}>
                    <Button size="sm" variant="outline">View User Profile</Button>
                  </Link>
                )}
                {hasPermission('users.manage') && (
                  <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}>
                    <KeyRound className="w-3.5 h-3.5" />
                    Reset Password
                  </Button>
                )}
                {hasPermission('mailboxes.suspend') && !isSelf && (
                  <Button
                    size="sm"
                    variant={data.mailbox.status === 'SUSPENDED' ? 'primary' : 'danger'}
                    onClick={handleSuspendToggle}
                  >
                    {data.mailbox.status === 'SUSPENDED' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        Reactivate
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5" />
                        Suspend
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[#64748B] block">Department</span>
                <span className="font-medium mt-0.5 block">{data.user?.department || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Job Title</span>
                <span className="font-medium mt-0.5 block">{data.user?.jobTitle || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-[#64748B] block">Bound Domain</span>
                {data.domain ? (
                  <Link to={`/admin/domains/${data.domain.id}`} className="font-mono font-medium mt-0.5 inline-block text-[#2563EB] hover:underline">
                    {data.domain.domainName}
                  </Link>
                ) : (
                  <span className="font-mono font-medium mt-0.5 block">Unknown</span>
                )}
              </div>
              <div>
                <span className="text-[#64748B] block">Last Sign-in</span>
                <span className="font-mono font-medium mt-0.5 block">
                  {formatDateTime(data.user?.lastLoginAt, session?.organisation?.timezone, 'full')}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold">Storage Allocation</h3>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono tabular-nums">
                <span>{formatStorageMb(data.mailbox.usedMb)} used</span>
                <span>{formatStorageMb(data.mailbox.quotaMb)} total</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[#2563EB]"
                  style={{ width: `${Math.min(100, (data.mailbox.usedMb / data.mailbox.quotaMb) * 100)}%` }}
                />
              </div>
            </div>

            {hasPermission('quotas.change') && (
              <form onSubmit={handleQuotaSave} className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <FieldLabel>Adjust Quota (GB)</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={quotaGb}
                  onChange={(e) => setQuotaGb(Number(e.target.value))}
                />
                <Button type="submit" size="sm" className="w-full" disabled={savingQuota}>
                  {savingQuota ? 'Updating...' : 'Update Quota'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset Mailbox Password"
        description={`Set a new temporary password for ${data?.mailbox.emailAddress}. Existing sessions will be signed out.`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <FieldLabel hint="Minimum 10 characters">New Temporary Password</FieldLabel>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={10}
              required
              placeholder="Enter strong temporary password"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={savingReset}>{savingReset ? 'Updating...' : 'Reset Password'}</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}

// Screen 46: User Management
export function AdminUsersPage() {
  const { session, hasPermission } = useAuth();
  const { notify } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | RoleKey>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ users: AdminUserRow[] }>('/api/admin/users');
      setUsers(res.users);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load users';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, roleFilter, statusFilter]);

  const filtered = users.filter((u) => {
    const matchesQ = `${u.displayName} ${u.email} ${u.department} ${u.jobTitle}`
      .toLowerCase()
      .includes(q.trim().toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.roleKey === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesQ && matchesRole && matchesStatus;
  });

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <AdminLayout
      title="Users & Directory"
      subtitle="Manage organisation members, roles, departments, and account lifecycle."
      actions={
        hasPermission('mailboxes.create') ? (
          <Link to="/admin/mailboxes/new">
            <Button>
              <UserPlus className="w-4 h-4" />
              Add User &amp; Mailbox
            </Button>
          </Link>
        ) : undefined
      }
    >
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter users by name, email, department..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
              <option value="ALL">All Roles</option>
              <option value="OWNER">Owner</option>
              <option value="ADMIN">Admin</option>
              <option value="MAILBOX_USER">Mailbox User</option>
            </Select>
          </div>
          <div className="w-40">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="SUSPENDED">Suspended Only</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={5} />
        ) : error ? (
          <div className="p-6 flex items-center justify-between gap-4 text-xs text-[#DC2626]">
            <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
            <Button size="sm" variant="outline" onClick={load}>Retry</Button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No users found" description="No organisation members match your filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-4 font-semibold">Department / Title</th>
                  <th className="py-3 px-4 font-semibold">Role</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Last Sign-in</th>
                  <th className="py-3 px-4 font-semibold text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paged.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                    <td className="py-3.5 px-4">
                      <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 group">
                        <Avatar name={u.displayName} size="sm" />
                        <div>
                          <p className="font-semibold text-[#14243A] dark:text-slate-100 group-hover:text-[#2563EB]">{u.displayName}</p>
                          <p className="font-mono text-[11px] text-[#64748B]">{u.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-[#64748B]">
                      {u.department || '—'} {u.jobTitle ? `· ${u.jobTitle}` : ''}
                    </td>
                    <td className="py-3.5 px-4 font-medium">{u.roleKey.replace(/_/g, ' ')}</td>
                    <td className="py-3.5 px-4"><StatusText status={u.status} /></td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#64748B] tabular-nums">
                      {formatDateTime(u.lastLoginAt, session?.organisation?.timezone, 'short')}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link to={`/admin/users/${u.id}`}>
                        <Button size="sm" variant="outline">Details</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-[#64748B]">
            <span className="font-mono tabular-nums">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page * pageSize >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}

// Screen 47: User Details
export function AdminUserDetailPage() {
  const { id } = useParams();
  const { session, hasPermission } = useAuth();
  const { notify } = useToast();
  const [userRow, setUserRow] = useState<AdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleKey, setRoleKey] = useState<RoleKey>('MAILBOX_USER');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [saving, setSaving] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const canManageUsers = hasPermission('users.manage');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ users: AdminUserRow[] }>('/api/admin/users');
      const found = res.users.find((u) => u.id === id) || null;
      setUserRow(found);
      if (found) {
        setRoleKey(found.roleKey);
        setDepartment(found.department);
        setJobTitle(found.jobTitle);
        setStatus(found.status);
      } else {
        setError('User not found in this organisation.');
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to load user details';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRow || !canManageUsers) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${userRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ roleKey, department, jobTitle, status }),
      });
      notify(`Updated ${userRow.displayName}.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save user changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userRow?.mailbox) return;
    setResetting(true);
    try {
      await apiFetch(`/api/mailboxes/${userRow.mailbox.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      notify(`Password updated for ${userRow.email} and sessions revoked.`, 'success');
      setResetOpen(false);
      setNewPassword('');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Password reset failed', 'error');
    } finally {
      setResetting(false);
    }
  };

  const isSelf = userRow?.id === session?.user.id;

  return (
    <AdminLayout
      title={userRow?.displayName || 'User Details'}
      subtitle={userRow?.email || 'Organisation member profile, role assignment, and linked mailbox.'}
      actions={
        <Link to="/admin/users">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4" />
            All Users
          </Button>
        </Link>
      }
    >
      {loading ? (
        <Card className="p-6"><SkeletonRows rows={4} /></Card>
      ) : error || !userRow ? (
        <EmptyState
          icon={Users}
          title="User not available"
          description={error || 'The requested organisation member could not be found.'}
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={load}>Retry</Button>
              <Link to="/admin/users"><Button size="sm">Back to All Users</Button></Link>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6 lg:col-span-2 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                <Avatar name={userRow.displayName} size="lg" />
                <div>
                  <h2 className="font-display text-lg font-bold text-[#14243A] dark:text-white">{userRow.displayName}</h2>
                  <p className="font-mono text-xs text-[#64748B]">{userRow.email}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <StatusText status={userRow.status} />
                    {userRow.phone && <span className="font-mono text-[#64748B]">{userRow.phone}</span>}
                  </div>
                </div>
              </div>
              {canManageUsers && userRow.mailbox && (
                <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}>
                  <KeyRound className="w-3.5 h-3.5" />
                  Reset Password
                </Button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Department</FieldLabel>
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Engineering"
                    disabled={!canManageUsers}
                  />
                </div>
                <div>
                  <FieldLabel>Job Title</FieldLabel>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Lead Engineer"
                    disabled={!canManageUsers}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Organisation Role</FieldLabel>
                  <Select
                    value={roleKey}
                    onChange={(e) => setRoleKey(e.target.value as RoleKey)}
                    disabled={!canManageUsers}
                  >
                    <option value="MAILBOX_USER">Mailbox User</option>
                    <option value="ADMIN">Organisation Admin</option>
                    {session?.membership?.roleKey === 'OWNER' && <option value="OWNER">Organisation Owner</option>}
                  </Select>
                </div>
                <div>
                  <FieldLabel hint={isSelf ? 'Cannot suspend active self account' : undefined}>Account Status</FieldLabel>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}
                    disabled={!canManageUsers || isSelf}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[#64748B] block">Created</span>
                  <span className="font-mono font-medium mt-0.5 block">
                    {formatDateTime(userRow.createdAt, session?.organisation?.timezone, 'full')}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block">Last Sign-in</span>
                  <span className="font-mono font-medium mt-0.5 block">
                    {formatDateTime(userRow.lastLoginAt, session?.organisation?.timezone, 'full')}
                  </span>
                </div>
              </div>

              {canManageUsers && (
                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save User Settings'}</Button>
                </div>
              )}
            </form>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-semibold">Linked Mailbox</h3>
            </div>
            {userRow.mailbox ? (
              <div className="space-y-4 text-xs">
                <div>
                  <p className="font-mono font-semibold text-[#14243A] dark:text-white">{userRow.mailbox.emailAddress}</p>
                  <div className="mt-1">
                    <StatusText status={userRow.mailbox.status} />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between font-mono tabular-nums">
                    <span>{formatStorageMb(userRow.mailbox.usedMb)} used</span>
                    <span>{formatStorageMb(userRow.mailbox.quotaMb)} total</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB]"
                      style={{ width: `${Math.min(100, (userRow.mailbox.usedMb / userRow.mailbox.quotaMb) * 100)}%` }}
                    />
                  </div>
                </div>
                <Link to={`/admin/mailboxes/${userRow.mailbox.id}`} className="block">
                  <Button size="sm" variant="outline" className="w-full">Open Mailbox Details</Button>
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={Mail}
                title="No mailbox provisioned"
                description="This user does not have a bound mailbox in the organisation."
                action={
                  hasPermission('mailboxes.create') ? (
                    <Link to="/admin/mailboxes/new"><Button size="sm">Provision Mailbox</Button></Link>
                  ) : undefined
                }
              />
            )}
          </Card>
        </div>
      )}

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset User Password"
        description={`Set a new temporary password for ${userRow?.email}. Existing sessions will be signed out.`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <FieldLabel hint="Minimum 10 characters">New Temporary Password</FieldLabel>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={10}
              required
              placeholder="Enter strong temporary password"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={resetting}>{resetting ? 'Updating...' : 'Reset Password'}</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}

// Screen 48: Roles & Permissions
export function AdminRolesPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [allPerms, setAllPerms] = useState<{ key: PermissionKey; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const isOwner = session?.membership?.roleKey === 'OWNER';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ roles: RoleDefinition[]; allPermissions: { key: PermissionKey; label: string }[] }>('/api/admin/roles');
      setRoles(res.roles);
      setAllPerms(res.allPermissions);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to load roles', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const togglePermission = async (role: RoleDefinition, permKey: PermissionKey) => {
    if (!isOwner || role.key === 'OWNER') return;
    const has = role.permissions.includes(permKey);
    const nextPerms = has
      ? role.permissions.filter((p) => p !== permKey)
      : [...role.permissions, permKey];

    setSavingRole(role.key);
    try {
      await apiFetch('/api/admin/roles', {
        method: 'PATCH',
        body: JSON.stringify({ roleKey: role.key, permissions: nextPerms }),
      });
      setRoles((prev) =>
        prev.map((r) => (r.key === role.key ? { ...r, permissions: nextPerms } : r))
      );
      notify(`Updated ${role.name} permissions.`, 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to update role permissions', 'error');
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <AdminLayout
      title="Roles & Permissions"
      subtitle="Organisation RBAC policy matrix enforced on every API request."
    >
      {!isOwner && (
        <Card className="p-4 flex items-center gap-3 text-xs text-[#64748B]">
          <Shield className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span>Viewing permission matrix in read-only mode. Only the Organisation Owner can modify role permissions.</span>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <SkeletonRows rows={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[#64748B]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Permission</th>
                  {roles.map((r) => (
                    <th key={r.key} className="py-3 px-4 font-semibold text-center">
                      <div>{r.name}</div>
                      <div className="font-normal text-[11px] text-[#94A3B8]">{r.key}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {allPerms.map((perm) => (
                  <tr key={perm.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                    <td className="py-3 px-4">
                      <p className="font-medium text-[#14243A] dark:text-slate-100">{perm.label}</p>
                      <p className="font-mono text-[11px] text-[#94A3B8]">{perm.key}</p>
                    </td>
                    {roles.map((role) => {
                      const enabled = role.permissions.includes(perm.key);
                      const editable = isOwner && role.key !== 'OWNER';
                      return (
                        <td key={role.key} className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={enabled}
                            disabled={!editable || savingRole === role.key}
                            onChange={() => togglePermission(role, perm.key)}
                            className="w-4 h-4 accent-[#2563EB] cursor-pointer disabled:cursor-not-allowed"
                            aria-label={`${role.name} - ${perm.label}`}
                          />
                        </td>
                      );
                    })}
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

// Screen 70: Email Aliases & Distribution Groups
export function AdminGroupsAliasesPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [groups, setGroups] = useState<DistributionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const [aliasAddress, setAliasAddress] = useState('');
  const [targetAddress, setTargetAddress] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupEmail, setGroupEmail] = useState('');
  const [groupMembers, setGroupMembers] = useState('');

  const [editGroup, setEditGroup] = useState<DistributionGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupEmail, setEditGroupEmail] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupMembers, setEditGroupMembers] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ aliases: Alias[]; groups: DistributionGroup[] }>('/api/aliases');
      setAliases(res.aliases);
      setGroups(res.groups);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to load aliases & groups', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/aliases', {
        method: 'POST',
        body: JSON.stringify({ aliasAddress, targetAddress }),
      });
      setAliasAddress('');
      setTargetAddress('');
      notify('Alias created.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to create alias', 'error');
    }
  };

  const handleDeleteAlias = async (id: string) => {
    try {
      await apiFetch(`/api/aliases/${id}`, { method: 'DELETE' });
      notify('Alias removed.', 'info');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to remove alias', 'error');
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const members = groupMembers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, emailAddress: groupEmail, members }),
      });
      setGroupName('');
      setGroupEmail('');
      setGroupMembers('');
      notify('Distribution group created.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to create group', 'error');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
      notify('Distribution group removed.', 'info');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to remove distribution group', 'error');
    }
  };

  const openEditGroup = (g: DistributionGroup) => {
    setEditGroup(g);
    setEditGroupName(g.name);
    setEditGroupEmail(g.emailAddress);
    setEditGroupDesc(g.description || '');
    setEditGroupMembers(g.members.join(', '));
  };

  const handleSaveEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroup) return;
    const members = editGroupMembers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await apiFetch(`/api/groups/${editGroup.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editGroupName,
          emailAddress: editGroupEmail,
          description: editGroupDesc,
          members,
        }),
      });
      notify('Distribution group updated.', 'success');
      setEditGroup(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to update distribution group', 'error');
    }
  };

  return (
    <AdminLayout
      title="Aliases & Distribution Groups"
      subtitle="Route functional addresses and team distribution lists across your organisation."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aliases */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#14243A] dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#2563EB]" />
              Email Aliases
            </h2>
            <span className="font-mono text-xs text-[#64748B]">{aliases.length} active</span>
          </div>

          {hasPermission('mailboxes.create') && (
            <form onSubmit={handleAddAlias} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div className="sm:col-span-2">
                <Input
                  value={aliasAddress}
                  onChange={(e) => setAliasAddress(e.target.value)}
                  placeholder="hello@domain.com"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  placeholder="target@domain.com"
                  required
                />
              </div>
              <Button type="submit">Add</Button>
            </form>
          )}

          {loading ? (
            <SkeletonRows rows={3} />
          ) : aliases.length === 0 ? (
            <EmptyState icon={Mail} title="No aliases yet" description="Forward addresses like hello@ or billing@ to existing mailboxes." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {aliases.map((a) => (
                <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-[#14243A] dark:text-white truncate">{a.aliasAddress}</p>
                    <p className="font-mono text-[#64748B] truncate">→ {a.targetAddress}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteAlias(a.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Distribution Groups */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#14243A] dark:text-white flex items-center gap-2">
              <Network className="w-4 h-4 text-[#2563EB]" />
              Distribution Groups
            </h2>
            <span className="font-mono text-xs text-[#64748B]">{groups.length} active</span>
          </div>

          {hasPermission('users.manage') && (
            <form onSubmit={handleAddGroup} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Group Name (e.g. Engineering)"
                  required
                />
                <Input
                  value={groupEmail}
                  onChange={(e) => setGroupEmail(e.target.value)}
                  placeholder="eng@domain.com"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Input
                  value={groupMembers}
                  onChange={(e) => setGroupMembers(e.target.value)}
                  placeholder="Comma-separated member emails"
                  required
                />
                <Button type="submit">Create</Button>
              </div>
            </form>
          )}

          {loading ? (
            <SkeletonRows rows={3} />
          ) : groups.length === 0 ? (
            <EmptyState icon={Network} title="No distribution groups" description="Create team lists to broadcast mail to multiple recipients." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {groups.map((g) => (
                <div key={g.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#14243A] dark:text-white">{g.name}</p>
                    <p className="font-mono text-[#2563EB]">{g.emailAddress}</p>
                    <p className="text-[#64748B] mt-1 truncate">
                      {g.members.length} members: {g.members.join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasPermission('users.manage') && (
                      <Button size="sm" variant="ghost" onClick={() => openEditGroup(g)} title="Edit distribution group">
                        <Pencil className="w-3.5 h-3.5 text-[#64748B]" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteGroup(g.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={Boolean(editGroup)} onClose={() => setEditGroup(null)} title="Edit Distribution Group">
        <form onSubmit={handleSaveEditGroup} className="space-y-4">
          <div>
            <FieldLabel>Group Name</FieldLabel>
            <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} required />
          </div>
          <div>
            <FieldLabel>Group Email Address</FieldLabel>
            <Input type="email" value={editGroupEmail} onChange={(e) => setEditGroupEmail(e.target.value)} required />
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <Input value={editGroupDesc} onChange={(e) => setEditGroupDesc(e.target.value)} />
          </div>
          <div>
            <FieldLabel hint="Comma-separated emails">Members</FieldLabel>
            <Input value={editGroupMembers} onChange={(e) => setEditGroupMembers(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditGroup(null)}>Cancel</Button>
            <Button type="submit">Save Group</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
