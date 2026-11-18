import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  Download,
  FileText,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { WorkspaceShell } from '../../components/layout/WorkspaceShell.tsx';
import {
  Avatar,
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
  Textarea,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { cn, formatDateTime } from '../../lib/utils.ts';
import type {
  CalendarEvent,
  Contact,
  MigrationJob,
  SharedMailbox,
  WorkspaceNote,
  WorkspaceTask,
} from '../../shared/types.ts';

// Screen 68: Contacts & Address Book (V1)
export function ContactsPage() {
  const navigate = useNavigate();
  const { notify, confirm } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [groupName, setGroupName] = useState('General');
  const [notes, setNotes] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<'csv' | 'vcf'>('csv');
  const [importContent, setImportContent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (group !== 'ALL') params.set('group', group);
      const res = await apiFetch<{ contacts: Contact[]; groups: string[] }>(`/api/contacts?${params.toString()}`);
      setContacts(res.contacts);
      setGroups(res.groups);
      if (res.contacts.length > 0 && !selectedId) {
        setSelectedId(res.contacts[0].id);
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to load contacts', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, group, selectedId, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const active = contacts.find((c) => c.id === selectedId) || contacts[0] || null;

  const openCreate = () => {
    setEditing(null);
    setFullName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setJobTitle('');
    setGroupName('General');
    setNotes('');
    setFormOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setFullName(c.fullName);
    setEmail(c.email);
    setPhone(c.phone);
    setCompany(c.company);
    setJobTitle(c.jobTitle);
    setGroupName(c.groupName);
    setNotes(c.notes);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { fullName, email, phone, company, jobTitle, groupName, notes };
      if (editing) {
        await apiFetch(`/api/contacts/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        notify('Contact updated.', 'success');
      } else {
        const res = await apiFetch<{ contact: Contact }>('/api/contacts', { method: 'POST', body: JSON.stringify(payload) });
        setSelectedId(res.contact.id);
        notify('Contact added.', 'success');
      }
      setFormOpen(false);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Save failed', 'error');
    }
  };

  const handleDelete = async (c: Contact) => {
    const ok = await confirm({
      title: `Delete contact ${c.fullName}?`,
      description: 'This removes the contact from your address book.',
      confirmLabel: 'Delete Contact',
      destructive: true,
    });
    if (!ok) return;
    await apiFetch(`/api/contacts/${c.id}`, { method: 'DELETE' });
    notify('Contact removed.', 'info');
    setSelectedId(null);
    load();
  };

  const handleExport = async (format: 'csv' | 'vcf') => {
    const res = await fetch(`/api/contacts/export?format=${format}`, { credentials: 'include' });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `corivo-contacts.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ count: number }>('/api/contacts/import', {
        method: 'POST',
        body: JSON.stringify({ content: importContent, format: importFormat }),
      });
      notify(`Imported ${res.count} contacts.`, 'success');
      setImportOpen(false);
      setImportContent('');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Import failed', 'error');
    }
  };

  return (
    <WorkspaceShell>
      <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-[#14243A] dark:text-white">Contacts &amp; Address Book</h1>
            <p className="text-xs text-[#64748B]">Manage business contacts, groups, and CSV/vCard import-export.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-3.5 h-3.5" />
              Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExport('csv')}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExport('vcf')}>
              <Download className="w-3.5 h-3.5" />
              vCard
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              New Contact
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts..." className="pl-9" />
          </div>
          <div className="w-44">
            <Select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="ALL">All Groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
          <Card className="overflow-y-auto">
            {loading ? (
              <SkeletonRows rows={5} />
            ) : contacts.length === 0 ? (
              <EmptyState icon={Users} title="No contacts" description="Add your first business contact." />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer',
                      active?.id === c.id && 'bg-[#2563EB]/10'
                    )}
                  >
                    <Avatar name={c.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{c.fullName}</p>
                      <p className="text-[11px] font-mono text-[#64748B] truncate">{c.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2 p-6 overflow-y-auto">
            {!active ? (
              <EmptyState icon={Users} title="Select a contact" description="Choose a contact from the list to inspect details." />
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={active.fullName} size="lg" />
                    <div>
                      <h2 className="font-display text-lg font-bold">{active.fullName}</h2>
                      <p className="text-xs text-[#64748B]">{active.jobTitle} {active.company ? `at ${active.company}` : ''}</p>
                      <p className="text-[11px] font-mono text-[#2563EB] mt-1">{active.groupName}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/app/mail/inbox?compose=1&to=${encodeURIComponent(active.email)}`)}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(active)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(active)}>
                      <Trash2 className="w-4 h-4 text-[#DC2626]" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[#64748B] block">Email Address</span>
                    <span className="font-mono font-medium mt-0.5 block">{active.email}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Phone</span>
                    <span className="font-mono font-medium mt-0.5 block">{active.phone || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Company</span>
                    <span className="font-medium mt-0.5 block">{active.company || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block">Notes</span>
                    <span className="font-medium mt-0.5 block">{active.notes || '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Contact' : 'Add Contact'}>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <FieldLabel>Full Name</FieldLabel>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Company</FieldLabel>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Group</FieldLabel>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
          </div>
          <div>
            <FieldLabel>Job Title</FieldLabel>
            <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Notes</FieldLabel>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit">Save Contact</Button>
          </div>
        </form>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import Contacts">
        <form onSubmit={handleImport} className="space-y-3">
          <div>
            <FieldLabel>Format</FieldLabel>
            <Select value={importFormat} onChange={(e) => setImportFormat(e.target.value as 'csv' | 'vcf')}>
              <option value="csv">CSV (Full Name,Email,Phone,Company)</option>
              <option value="vcf">vCard (.vcf)</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Paste CSV or vCard Content</FieldLabel>
            <Textarea
              rows={5}
              value={importContent}
              onChange={(e) => setImportContent(e.target.value)}
              placeholder={'Full Name,Email,Phone,Company\nKavya Iyer,kavya@partner.example,+91 9800000001,Partner Co'}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button type="submit">Import Contacts</Button>
          </div>
        </form>
      </Modal>
    </WorkspaceShell>
  );
}

// Screen 69: Calendar (V1)
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<'week' | 'month' | 'day'>('week');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState(() => toLocalInputValue(new Date(Date.now() + 3600_000).toISOString()));
  const [endAt, setEndAt] = useState(() => toLocalInputValue(new Date(Date.now() + 7200_000).toISOString()));
  const [attendees, setAttendees] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ events: CalendarEvent[] }>('/api/calendar');
      setEvents(res.events);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingEvent(null);
    setTitle('');
    setLocation('');
    setStartAt(toLocalInputValue(new Date(Date.now() + 3600_000).toISOString()));
    setEndAt(toLocalInputValue(new Date(Date.now() + 7200_000).toISOString()));
    setAttendees('');
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setTitle(ev.title);
    setLocation(ev.location || '');
    setStartAt(toLocalInputValue(ev.startAt));
    setEndAt(toLocalInputValue(ev.endAt));
    setAttendees(ev.attendees.join(', '));
    setDescription(ev.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        title,
        description,
        location,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        attendees: attendees.split(',').map((s) => s.trim()).filter(Boolean),
        reminderMin: 15,
      };
      if (editingEvent) {
        await apiFetch(`/api/calendar/${editingEvent.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        notify('Calendar event updated.', 'success');
      } else {
        await apiFetch('/api/calendar', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('Calendar event scheduled.', 'success');
      }
      setModalOpen(false);
      setEditingEvent(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save event', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/calendar/${id}`, { method: 'DELETE' });
    notify('Event deleted.', 'info');
    load();
  };

  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOffset = (monthStart.getDay() + 6) % 7; // Mon=0..Sun=6
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthCells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(today.getFullYear(), today.getMonth(), i + 1)),
  ];
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  const todayEvents = events.filter((ev) => sameLocalDay(new Date(ev.startAt), today));

  return (
    <WorkspaceShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-[#14243A] dark:text-white">Workspace Calendar</h1>
            <p className="text-xs text-[#64748B]">Schedule team meetings, domain reviews, and reminders.</p>
          </div>
          <div className="flex items-center gap-2">
            {(['day', 'week', 'month'] as const).map((v) => (
              <Button key={v} size="sm" variant={view === v ? 'primary' : 'outline'} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Button>
            ))}
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              New Event
            </Button>
          </div>
        </div>

        <DevelopmentModeNotice
          label="Local Workspace Calendar"
          detail="Events persist in your Corivo workspace store. External CalDAV/ICS two-way sync is currently unconfigured."
        />

        {loading ? (
          <Card className="p-6"><SkeletonRows rows={4} /></Card>
        ) : view === 'day' ? (
          <div className="space-y-4">
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  Today — {today.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h2>
                <span className="text-xs font-mono text-[#64748B]">{todayEvents.length} events</span>
              </div>
              {todayEvents.length === 0 ? (
                <p className="text-xs text-[#64748B] py-4">No events scheduled for today.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {todayEvents.map((ev) => (
                    <div key={ev.id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#14243A] dark:text-white">{ev.title}</p>
                        <p className="font-mono text-xs text-[#2563EB] mt-0.5">
                          {formatDateTime(ev.startAt, session?.preferences.timezone, 'full')}
                        </p>
                        {ev.location && <p className="text-xs text-[#64748B] mt-0.5">Location: {ev.location}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(ev)} aria-label="Edit event">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(ev.id)} aria-label="Delete event">
                          <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            {events.length > 0 && (
              <Card className="p-5 space-y-3">
                <h3 className="text-sm font-semibold">All Upcoming Schedule</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map((ev) => (
                    <div key={ev.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold">{ev.title}</p>
                        <p className="font-mono text-[11px] text-[#2563EB] mt-0.5">
                          {formatDateTime(ev.startAt, session?.preferences.timezone, 'full')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(ev)} className="text-slate-400 hover:text-[#2563EB] p-1">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(ev.id)} className="text-slate-400 hover:text-[#DC2626] p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : view === 'month' ? (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
              <span className="text-xs text-[#64748B]">Click an event chip to edit</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-[#64748B] text-center">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {monthCells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="min-h-[84px] rounded-lg bg-slate-50/50 dark:bg-slate-900/20" />;
                }
                const dayEvents = events.filter((ev) => sameLocalDay(new Date(ev.startAt), cell));
                const isToday = sameLocalDay(cell, today);
                return (
                  <div
                    key={cell.toISOString()}
                    className={cn(
                      'min-h-[84px] rounded-lg border p-1.5 flex flex-col gap-1',
                      isToday
                        ? 'border-[#2563EB] bg-[#2563EB]/5'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E]'
                    )}
                  >
                    <span className={cn('text-[11px] font-mono', isToday ? 'font-bold text-[#2563EB]' : 'text-[#64748B]')}>
                      {cell.getDate()}
                    </span>
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => openEdit(ev)}
                        className="text-left px-1.5 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB] text-[10px] font-medium truncate hover:bg-[#2563EB]/20 cursor-pointer"
                      >
                        {ev.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : events.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={CalendarIcon} title="No scheduled events" description="Create your first meeting or reminder." />
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const dayEvents = events.filter((ev) => sameLocalDay(new Date(ev.startAt), day));
                const isToday = sameLocalDay(day, today);
                return (
                  <Card
                    key={day.toISOString()}
                    className={cn('p-3 space-y-2', isToday && 'ring-1 ring-[#2563EB]')}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5">
                      <span className="text-xs font-semibold">
                        {day.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                      <span className="text-xs font-mono text-[#64748B]">{day.getDate()}</span>
                    </div>
                    {dayEvents.length === 0 ? (
                      <p className="text-[11px] text-[#94A3B8] py-2">No events</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="p-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-[11px] space-y-1"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(ev)}
                                className="font-semibold text-left hover:text-[#2563EB] cursor-pointer"
                              >
                                {ev.title}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(ev.id)}
                                className="text-slate-400 hover:text-[#DC2626]"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="font-mono text-[10px] text-[#2563EB]">
                              {new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((ev) => (
                <Card key={ev.id} className="p-5 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#14243A] dark:text-white">{ev.title}</h3>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(ev)} className="text-slate-400 hover:text-[#2563EB] p-1" aria-label="Edit event">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(ev.id)} className="text-slate-400 hover:text-[#DC2626] p-1" aria-label="Delete event">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="font-mono text-xs text-[#2563EB] mt-1">
                      {formatDateTime(ev.startAt, session?.preferences.timezone, 'full')}
                    </p>
                    {ev.location && <p className="text-xs text-[#64748B] mt-1">Location: {ev.location}</p>}
                    {ev.description && <p className="text-xs text-[#64748B] mt-2">{ev.description}</p>}
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-[#64748B]">
                    {ev.attendees.length > 0 ? `Attendees: ${ev.attendees.join(', ')}` : 'Personal reminder'}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? 'Edit Event' : 'Schedule Event'}
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <FieldLabel>Event Title</FieldLabel>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Q4 DNS Review" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel>Start</FieldLabel>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </div>
            <div>
              <FieldLabel>End</FieldLabel>
              <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
            </div>
          </div>
          <div>
            <FieldLabel>Location / Link</FieldLabel>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Conference Room B" />
          </div>
          <div>
            <FieldLabel>Attendee Emails (comma-separated)</FieldLabel>
            <Input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="ananya@corivotech.example" />
          </div>
          <div>
            <FieldLabel>Agenda</FieldLabel>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingEvent ? 'Save Changes' : 'Schedule'}</Button>
          </div>
        </form>
      </Modal>
    </WorkspaceShell>
  );
}

// Screen 71: Email Migration Centre (V1)
export function MigrationPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceProvider, setSourceProvider] = useState<'GMAIL' | 'ZOHO' | 'OUTLOOK' | 'IMAP'>('GMAIL');
  const [sourceAccount, setSourceAccount] = useState('');
  const [targetMailbox, setTargetMailbox] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ jobs: MigrationJob[] }>('/api/migration');
      setJobs(res.jobs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStartMigration = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/migration', {
        method: 'POST',
        body: JSON.stringify({ sourceProvider, sourceAccount, targetMailbox }),
      });
      notify('Simulated IMAP migration job completed.', 'success');
      setSourceAccount('');
      setTargetMailbox('');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to start migration', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryMigration = async (id: string) => {
    try {
      await apiFetch(`/api/migration/${id}/retry`, { method: 'POST' });
      notify('Migration job re-run completed.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to retry migration', 'error');
    }
  };

  return (
    <WorkspaceShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="font-display text-xl font-bold text-[#14243A] dark:text-white">Email Migration Centre</h1>
          <p className="text-xs text-[#64748B]">Import legacy mail from Google Workspace, Zoho Mail, Microsoft 365, or standard IMAP.</p>
        </div>

        <DevelopmentModeNotice
          label="Development Simulation Adapter"
          detail="Live IMAP/OAuth bulk sync workers are not attached in this environment. Submitting a job executes a deterministic simulated migration audit."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#2563EB]" />
              Start New Import
            </h2>
            <form onSubmit={handleStartMigration} className="space-y-3">
              <div>
                <FieldLabel>Source Provider</FieldLabel>
                <Select value={sourceProvider} onChange={(e) => setSourceProvider(e.target.value as typeof sourceProvider)}>
                  <option value="GMAIL">Google Workspace / Gmail</option>
                  <option value="ZOHO">Zoho Mail</option>
                  <option value="OUTLOOK">Microsoft 365 / Outlook</option>
                  <option value="IMAP">Custom IMAP Server</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Source Email Account</FieldLabel>
                <Input type="email" value={sourceAccount} onChange={(e) => setSourceAccount(e.target.value)} required placeholder="legacy@gmail.com" />
              </div>
              <div>
                <FieldLabel>Target Corivo Mailbox</FieldLabel>
                <Input type="email" value={targetMailbox} onChange={(e) => setTargetMailbox(e.target.value)} required placeholder="razeen@corivotech.example" />
              </div>
              <Button type="submit" disabled={submitting || !hasPermission('mailboxes.create')} className="w-full">
                {submitting ? 'Running Import...' : 'Start Simulated Import'}
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-2 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-semibold">Migration Jobs</h2>
            </div>
            {loading ? (
              <SkeletonRows rows={3} />
            ) : jobs.length === 0 ? (
              <EmptyState icon={ArrowRightLeft} title="No migration jobs" description="Start an import job on the left." />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {job.sourceProvider}: <span className="font-mono">{job.sourceAccount}</span> →{' '}
                        <span className="font-mono">{job.targetMailbox}</span>
                      </p>
                      <p className="text-[#64748B] mt-1">
                        {job.successCount} / {job.totalItems} items synced · {job.failedCount} skipped
                      </p>
                      {job.errorDetail && <p className="text-[11px] text-[#D97706] mt-0.5">{job.errorDetail}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusText status={job.status} />
                      {hasPermission('mailboxes.create') && (
                        <Button size="sm" variant="outline" onClick={() => handleRetryMigration(job.id)}>
                          <RefreshCw className="w-3 h-3" />
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </WorkspaceShell>
  );
}

// Screen 74: Shared Mailboxes (V2)
export function SharedMailboxesPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const [items, setItems] = useState<SharedMailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [description, setDescription] = useState('');
  const [memberEmail, setMemberEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ sharedMailboxes: SharedMailbox[] }>('/api/shared-mailboxes');
      setItems(res.sharedMailboxes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/shared-mailboxes', {
        method: 'POST',
        body: JSON.stringify({
          name,
          emailAddress,
          description,
          members: [{ email: memberEmail, access: 'READ_WRITE' }],
        }),
      });
      notify('Shared mailbox created.', 'success');
      setModalOpen(false);
      setName('');
      setEmailAddress('');
      setDescription('');
      setMemberEmail('');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to create shared mailbox', 'error');
    }
  };

  return (
    <WorkspaceShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-[#14243A] dark:text-white">Shared Mailboxes (V2)</h1>
            <p className="text-xs text-[#64748B]">Collaborative team inboxes for support@, billing@, and operations queues.</p>
          </div>
          {hasPermission('mailboxes.create') && (
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="w-3.5 h-3.5" />
              Create Shared Mailbox
            </Button>
          )}
        </div>

        {loading ? (
          <Card className="p-6"><SkeletonRows rows={3} /></Card>
        ) : items.length === 0 ? (
          <Card className="p-6"><EmptyState icon={Mail} title="No shared mailboxes" description="Create a shared team inbox." /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((sm) => (
              <Card key={sm.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{sm.name}</h3>
                    <p className="font-mono text-xs text-[#2563EB]">{sm.emailAddress}</p>
                  </div>
                  <StatusText status="ACTIVE" />
                </div>
                <p className="text-xs text-[#64748B]">{sm.description || 'Collaborative team mailbox'}</p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                  <p className="font-medium">Assigned Members</p>
                  {sm.members.map((m) => (
                    <div key={m.email} className="flex justify-between font-mono text-[11px] text-[#64748B]">
                      <span>{m.email}</span>
                      <span>{m.access}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Shared Mailbox">
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <FieldLabel>Mailbox Name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Customer Success" />
          </div>
          <div>
            <FieldLabel>Shared Address</FieldLabel>
            <Input type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} required placeholder="success@corivotech.example" />
          </div>
          <div>
            <FieldLabel>Initial Member Email</FieldLabel>
            <Input type="email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} required placeholder="ananya@corivotech.example" />
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Modal>
    </WorkspaceShell>
  );
}

// Screen 75: Tasks (V2)
export function TasksPage() {
  const { session } = useAuth();
  const { notify } = useToast();
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [title, setTitle] = useState('');
  const [assigneeEmail, setAssigneeEmail] = useState(session?.user.email || '');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10));
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  const load = useCallback(() => {
    apiFetch<{ tasks: WorkspaceTask[] }>('/api/tasks').then((res) => setTasks(res.tasks)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title, assigneeEmail: assigneeEmail || session?.user.email, dueDate, priority }),
      });
      setTitle('');
      notify('Task added.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to create task', 'error');
    }
  };

  const handleStatusChange = async (id: string, status: WorkspaceTask['status']) => {
    await apiFetch(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    load();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <WorkspaceShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div>
          <h1 className="font-display text-xl font-bold text-[#14243A] dark:text-white">Workspace Tasks (V2)</h1>
          <p className="text-xs text-[#64748B]">Track operational follow-ups linked to team workflows.</p>
        </div>

        <Card className="p-4">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task title..." required />
            </div>
            <Input type="email" value={assigneeEmail} onChange={(e) => setAssigneeEmail(e.target.value)} placeholder="Assignee email" required />
            <div className="flex gap-2">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="w-28">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </Select>
            </div>
            <Button type="submit">
              <Plus className="w-4 h-4" />
              Add Task
            </Button>
          </form>
        </Card>

        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {tasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="No active tasks" description="Add a task above to track follow-ups." />
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleStatusChange(t.id, t.status === 'DONE' ? 'TODO' : 'DONE')}
                    className={cn(
                      'p-1 rounded cursor-pointer',
                      t.status === 'DONE' ? 'text-[#16A34A]' : 'text-[#94A3B8] hover:text-[#2563EB]'
                    )}
                    aria-label="Toggle task complete"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <div className="min-w-0">
                    <p className={cn('font-semibold', t.status === 'DONE' && 'line-through text-[#94A3B8]')}>{t.title}</p>
                    <p className="text-[#64748B]">
                      Assignee: <span className="font-mono">{t.assigneeEmail}</span> · Due {t.dueDate} · Priority {t.priority}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={t.status}
                    onChange={(e) => handleStatusChange(t.id, e.target.value as WorkspaceTask['status'])}
                    className="h-8 text-xs w-32"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </WorkspaceShell>
  );
}

// Screen 76: Notes (V2)
export function NotesPage() {
  const { notify } = useToast();
  const [notes, setNotes] = useState<WorkspaceNote[]>([]);
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('Operations');
  const [content, setContent] = useState('');
  const [editingNote, setEditingNote] = useState<WorkspaceNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFolder, setEditFolder] = useState('');
  const [editContent, setEditContent] = useState('');

  const load = useCallback(() => {
    apiFetch<{ notes: WorkspaceNote[] }>('/api/notes').then((res) => setNotes(res.notes)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/notes', { method: 'POST', body: JSON.stringify({ title, folder, content }) });
      setTitle('');
      setContent('');
      notify('Note saved.', 'success');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save note', 'error');
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    try {
      await apiFetch(`/api/notes/${editingNote.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle, folder: editFolder, content: editContent }),
      });
      notify('Note updated.', 'success');
      setEditingNote(null);
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to update note', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
    load();
  };

  const filtered = notes.filter((n) => `${n.title} ${n.content} ${n.folder}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <WorkspaceShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-[#14243A] dark:text-white">Workspace Notes (V2)</h1>
            <p className="text-xs text-[#64748B]">Private operational notes and DNS handover checklists.</p>
          </div>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-3 pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter notes..." className="pl-9" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-3">Create Note</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" required />
              <Input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Folder" required />
              <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write note..." required />
              <Button type="submit" className="w-full">Save Note</Button>
            </form>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            {filtered.length === 0 ? (
              <Card className="sm:col-span-2 p-6">
                <EmptyState icon={FileText} title="No notes found" description="Create your first note on the left." />
              </Card>
            ) : (
              filtered.map((n) => (
                <Card key={n.id} className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-mono text-[#2563EB]">{n.folder}</p>
                      <h3 className="text-sm font-semibold text-[#14243A] dark:text-white">{n.title}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNote(n);
                          setEditTitle(n.title);
                          setEditFolder(n.folder);
                          setEditContent(n.content);
                        }}
                        className="text-slate-400 hover:text-[#2563EB] p-1"
                        aria-label="Edit note"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(n.id)}
                        className="text-slate-400 hover:text-[#DC2626] p-1"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#64748B] whitespace-pre-wrap">{n.content}</p>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal open={Boolean(editingNote)} onClose={() => setEditingNote(null)} title="Edit Note">
        <form onSubmit={handleEditSave} className="space-y-3">
          <div>
            <FieldLabel>Title</FieldLabel>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
          </div>
          <div>
            <FieldLabel>Folder</FieldLabel>
            <Input value={editFolder} onChange={(e) => setEditFolder(e.target.value)} required />
          </div>
          <div>
            <FieldLabel>Content</FieldLabel>
            <Textarea rows={5} value={editContent} onChange={(e) => setEditContent(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditingNote(null)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </WorkspaceShell>
  );
}
