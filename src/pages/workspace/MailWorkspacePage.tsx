import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Clock,
  Download,
  FileEdit,
  FolderInput,
  Forward,
  Inbox,
  MailOpen,
  Paperclip,
  Printer,
  RefreshCw,
  Reply,
  ReplyAll,
  RotateCcw,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { WorkspaceShell } from '../../components/layout/WorkspaceShell.tsx';
import { ComposeModal, type ComposeInitialState } from '../../components/mail/ComposeModal.tsx';
import {
  Avatar,
  Button,
  DevelopmentModeNotice,
  EmptyState,
  SkeletonRows,
  StatusText,
} from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { cn, formatBytes, formatDateTime, sanitizeHtml } from '../../lib/utils.ts';
import type { Draft, EmailMessage, MailFolder } from '../../shared/types.ts';

const SYSTEM_FOLDER_SLUGS = new Set(['inbox', 'starred', 'snoozed', 'sent', 'drafts', 'archive', 'spam', 'trash', 'all']);

export function MailWorkspacePage({ defaultFolder }: { defaultFolder?: string }) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuth();
  const { notify, confirm } = useToast();

  const rawFolderOrMsg = params.folderId || defaultFolder || 'inbox';
  const looksLikeMessageId = !SYSTEM_FOLDER_SLUGS.has(rawFolderOrMsg) && /^[0-9a-f-]{20,}$/i.test(rawFolderOrMsg);
  const activeFolder = looksLikeMessageId ? 'inbox' : rawFolderOrMsg;
  const routeMessageId = params.messageId || (looksLikeMessageId ? rawFolderOrMsg : null) || searchParams.get('msg');
  const isDrafts = activeFolder === 'drafts';

  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [customFolders, setCustomFolders] = useState<MailFolder[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMessage, setActiveMessage] = useState<EmailMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred' | 'attachments'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [composeOpen, setComposeOpen] = useState(searchParams.get('compose') === '1');
  const [composeInitial, setComposeInitial] = useState<ComposeInitialState | null>(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);

  const tz = session?.preferences.timezone || 'Asia/Kolkata';
  const dateTimePrefs = session?.preferences;
  const readingPane = session?.preferences.readingPane || 'right';
  const density = session?.preferences.density || 'comfortable';
  const threadingEnabled = session?.preferences.threadingEnabled ?? true;
  const defaultReplyMode = session?.preferences.defaultReplyMode || 'reply';
  const defaultFont = session?.preferences.defaultFont || 'DM Sans';

  const loadFolders = useCallback(async () => {
    try {
      const res = await apiFetch<{ customFolders: MailFolder[]; unreadCounts: Record<string, number> }>('/api/folders');
      setCustomFolders(res.customFolders);
      setUnreadCounts(res.unreadCounts);
    } catch {
      // handled gracefully
    }
  }, []);

  const loadMail = useCallback(async () => {
    setLoading(true);
    try {
      if (isDrafts) {
        const res = await apiFetch<{ drafts: Draft[] }>('/api/mail/drafts');
        setDrafts(res.drafts);
        setMessages([]);
        setTotal(res.drafts.length);
      } else {
        const res = await apiFetch<{ messages: EmailMessage[]; total: number }>(
          `/api/mail?folder=${encodeURIComponent(activeFolder)}&filter=${filter}&sort=${sort}&page=${page}&pageSize=25`
        );
        setMessages(res.messages);
        setTotal(res.total);
        if (routeMessageId) {
          const found = res.messages.find((m) => m.id === routeMessageId);
          if (found) {
            setActiveMessage(found);
            const detail = await apiFetch<{ message: EmailMessage; thread: EmailMessage[] }>(`/api/mail/${found.id}`).catch(() => null);
            setThreadMessages(detail?.thread || [found]);
          } else {
            const detail = await apiFetch<{ message: EmailMessage; thread: EmailMessage[] }>(`/api/mail/${routeMessageId}`).catch(() => null);
            if (detail?.message) {
              setActiveMessage(detail.message);
              setThreadMessages(detail.thread);
            }
          }
        }
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to load mailbox', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeFolder, filter, sort, page, isDrafts, routeMessageId, notify]);

  useEffect(() => {
    setActiveMessage(null);
    setSelectedIds([]);
    setPage(1);
  }, [activeFolder]);

  useEffect(() => {
    loadFolders();
    loadMail();
  }, [loadFolders, loadMail]);

  useEffect(() => {
    if (searchParams.get('compose') === '1') {
      const toParam = searchParams.get('to');
      if (toParam) {
        setComposeInitial({ to: [toParam] });
        searchParams.delete('to');
      }
      setComposeOpen(true);
      searchParams.delete('compose');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openMessage = async (msg: EmailMessage) => {
    setActiveMessage(msg);
    if (!msg.isRead) {
      await apiFetch(`/api/mail/${msg.id}/read`, { method: 'POST', body: JSON.stringify({ isRead: true }) });
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
      loadFolders();
    }
    try {
      const detail = await apiFetch<{ message: EmailMessage; thread: EmailMessage[] }>(`/api/mail/${msg.id}`);
      setThreadMessages(detail.thread);
    } catch {
      setThreadMessages([msg]);
    }
  };

  const handleStar = async (msg: EmailMessage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = !msg.isStarred;
    await apiFetch(`/api/mail/${msg.id}/star`, { method: 'POST', body: JSON.stringify({ isStarred: next }) });
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isStarred: next } : m)));
    if (activeMessage?.id === msg.id) setActiveMessage({ ...activeMessage, isStarred: next });
    loadFolders();
  };

  const handleArchive = async (ids: string[]) => {
    await Promise.all(ids.map((id) => apiFetch(`/api/mail/${id}/archive`, { method: 'POST' })));
    notify(ids.length > 1 ? `Archived ${ids.length} messages.` : 'Message archived.', 'success');
    setActiveMessage(null);
    setSelectedIds([]);
    loadMail();
    loadFolders();
  };

  const handleDelete = async (ids: string[], permanent = false) => {
    if (permanent || activeFolder === 'trash') {
      const ok = await confirm({
        title: 'Permanently delete?',
        description: 'This action cannot be undone.',
        confirmLabel: 'Delete Permanently',
        destructive: true,
      });
      if (!ok) return;
    }
    await Promise.all(
      ids.map((id) => apiFetch(`/api/mail/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }))
    );
    notify(permanent || activeFolder === 'trash' ? 'Message deleted permanently.' : 'Moved to Trash.', 'info');
    setActiveMessage(null);
    setSelectedIds([]);
    loadMail();
    loadFolders();
  };

  const handleMove = async (ids: string[], folderSlug: string, label: string) => {
    await Promise.all(
      ids.map((id) => apiFetch(`/api/mail/${id}/move`, { method: 'POST', body: JSON.stringify({ folderSlug }) }))
    );
    notify(`Moved to ${label}.`, 'success');
    setMoveMenuOpen(false);
    setActiveMessage(null);
    setSelectedIds([]);
    loadMail();
    loadFolders();
  };

  const handleMarkUnread = async (id: string) => {
    await apiFetch(`/api/mail/${id}/read`, { method: 'POST', body: JSON.stringify({ isRead: false }) });
    setActiveMessage(null);
    loadMail();
    loadFolders();
  };

  const handleBulkRead = async (ids: string[], isRead: boolean) => {
    await Promise.all(ids.map((id) => apiFetch(`/api/mail/${id}/read`, { method: 'POST', body: JSON.stringify({ isRead }) })));
    notify(isRead ? `Marked ${ids.length} as read.` : `Marked ${ids.length} as unread.`, 'info');
    setSelectedIds([]);
    loadMail();
    loadFolders();
  };

  const handleSnooze = async (msg: EmailMessage, hours: number) => {
    const snoozedUntil = new Date(Date.now() + hours * 3600_000).toISOString();
    await apiFetch(`/api/mail/${msg.id}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ snoozedUntil }),
    });
    notify(`Snoozed for ${hours} hours (Development Simulator).`, 'info');
    setActiveMessage(null);
    loadMail();
    loadFolders();
  };

  const handleUnsnooze = async (msg: EmailMessage) => {
    await apiFetch(`/api/mail/${msg.id}/unsnooze`, { method: 'POST' });
    notify('Returned message to Inbox.', 'success');
    setActiveMessage(null);
    loadMail();
    loadFolders();
  };

  const handleEmptyTrash = async () => {
    const ok = await confirm({
      title: 'Empty Trash?',
      description: 'All messages currently in Trash will be permanently removed.',
      confirmLabel: 'Empty Trash',
      destructive: true,
    });
    if (!ok) return;
    await apiFetch('/api/mail/trash/empty', { method: 'POST' });
    notify('Trash emptied.', 'info');
    setActiveMessage(null);
    loadMail();
    loadFolders();
  };

  const handleReply = (msg: EmailMessage, mode: 'reply' | 'reply_all' | 'forward') => {
    const quoted = `<br/><br/><blockquote style="border-left:2px solid #CBD5E1;padding-left:12px;color:#64748B;">On ${formatDateTime(msg.sentAt, tz, 'full', dateTimePrefs)}, ${msg.fromName} &lt;${msg.fromAddress}&gt; wrote:<br/>${msg.bodyHtml}</blockquote>`;
    if (mode === 'forward') {
      setComposeInitial({
        subject: msg.subject.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.subject}`,
        bodyHtml: quoted,
      });
    } else if (mode === 'reply_all') {
      const others = [...msg.toAddresses, ...msg.ccAddresses].filter(
        (addr) => addr.toLowerCase() !== session?.mailbox?.emailAddress.toLowerCase()
      );
      setComposeInitial({
        to: [msg.fromAddress],
        cc: others,
        subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
        bodyHtml: quoted,
        inReplyToId: msg.id,
      });
    } else {
      setComposeInitial({
        to: [msg.fromAddress],
        subject: msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`,
        bodyHtml: quoted,
        inReplyToId: msg.id,
      });
    }
    setComposeOpen(true);
  };

  const openDraftInComposer = (d: Draft) => {
    setComposeInitial({
      draftId: d.id,
      to: d.toAddresses,
      cc: d.ccAddresses,
      subject: d.subject,
      bodyHtml: d.bodyHtml,
    });
    setComposeOpen(true);
  };

  const deleteDraft = async (id: string) => {
    await apiFetch(`/api/mail/drafts/${id}`, { method: 'DELETE' });
    notify('Draft deleted.', 'info');
    loadMail();
    loadFolders();
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const folderTitle =
    customFolders.find((f) => f.slug === activeFolder)?.name ||
    activeFolder.charAt(0).toUpperCase() + activeFolder.slice(1);

  return (
    <WorkspaceShell
      customFolders={customFolders}
      unreadCounts={unreadCounts}
      onFoldersChanged={loadFolders}
      onCompose={() => {
        setComposeInitial(null);
        setComposeOpen(true);
      }}
    >
      <div
        className={cn(
          'flex-1 min-h-0 flex',
          readingPane === 'bottom' ? 'flex-col' : 'flex-col lg:flex-row'
        )}
      >
        {/* Email List Pane */}
        <section
          className={cn(
            'bg-white dark:bg-[#111A2E] flex flex-col min-h-0',
            readingPane === 'right' && 'flex-1 lg:flex-none lg:w-[400px] xl:w-[430px] border-r border-slate-200 dark:border-slate-800',
            readingPane === 'right' && (activeMessage ? 'hidden lg:flex' : 'flex'),
            readingPane === 'bottom' && (activeMessage ? 'h-1/2 border-b border-slate-200 dark:border-slate-800' : 'flex-1'),
            readingPane === 'off' && (activeMessage ? 'hidden' : 'flex-1')
          )}
        >
          {/* List Toolbar */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-bold text-[#14243A] dark:text-white">
                  {folderTitle}
                </h1>
                <span className="text-xs font-mono text-[#94A3B8] tabular-nums">({total})</span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeFolder === 'trash' && messages.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleEmptyTrash}>
                    Empty Trash
                  </Button>
                )}
                <button
                  type="button"
                  onClick={loadMail}
                  className="p-1.5 rounded-lg text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Refresh mailbox"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isDrafts && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-[#F1F5F9] dark:bg-slate-800 p-0.5 rounded-lg">
                  {(['all', 'unread', 'starred', 'attachments'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={cn(
                        'px-2.5 py-1 text-[11px] font-medium rounded-md capitalize cursor-pointer',
                        filter === f
                          ? 'bg-white dark:bg-[#111A2E] text-[#14243A] dark:text-white shadow-xs'
                          : 'text-[#64748B] hover:text-[#172033]'
                      )}
                    >
                      {f === 'attachments' ? 'Files' : f}
                    </button>
                  ))}
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}
                  className="text-xs bg-transparent text-[#64748B] focus:outline-none cursor-pointer"
                  aria-label="Sort messages"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs bg-[#F7F9FC] dark:bg-slate-800/60 px-3 py-1.5 rounded-lg">
                <span className="font-medium">{selectedIds.length} selected</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => handleBulkRead(selectedIds, true)} className="text-[#172033] dark:text-slate-200 hover:underline cursor-pointer">Mark Read</button>
                  <button type="button" onClick={() => handleBulkRead(selectedIds, false)} className="text-[#172033] dark:text-slate-200 hover:underline cursor-pointer">Unread</button>
                  <select
                    aria-label="Bulk move selected messages"
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const slug = e.target.value;
                      const label = slug === 'inbox' ? 'Inbox' : customFolders.find((f) => f.slug === slug)?.name || slug;
                      handleMove(selectedIds, slug, label);
                      e.target.value = '';
                    }}
                    className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] cursor-pointer"
                  >
                    <option value="">Move...</option>
                    <option value="inbox">Inbox</option>
                    {customFolders.map((f) => (
                      <option key={f.id} value={f.slug}>{f.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => handleArchive(selectedIds)} className="text-[#2563EB] hover:underline cursor-pointer">Archive</button>
                  <button type="button" onClick={() => handleDelete(selectedIds)} className="text-[#DC2626] hover:underline cursor-pointer">Delete</button>
                  <button type="button" onClick={() => setSelectedIds([])} className="text-[#64748B] hover:underline cursor-pointer">Clear</button>
                </div>
              </div>
            )}
          </div>

          {activeFolder === 'snoozed' && (
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <DevelopmentModeNotice detail="Snooze reminders are stored in Development Mode; automated timer return requires background worker scheduling." />
            </div>
          )}

          {/* List Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <SkeletonRows rows={6} />
            ) : isDrafts ? (
              drafts.length === 0 ? (
                <EmptyState
                  icon={FileEdit}
                  title="No saved drafts"
                  description="Drafts you save while composing will appear here."
                />
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => openDraftInComposer(d)}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#D97706]">Draft · {d.toAddresses.join(', ') || 'No recipient'}</p>
                      <p className="text-sm font-semibold text-[#172033] dark:text-slate-100 truncate mt-0.5">
                        {d.subject || '(No subject)'}
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-1 font-mono tabular-nums">
                        Updated {formatDateTime(d.updatedAt, tz, 'full', dateTimePrefs)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDraft(d.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-[#DC2626]"
                      aria-label="Delete draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )
            ) : messages.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="You don't have any emails yet."
                description={`No messages found in ${folderTitle}.`}
              />
            ) : (
              messages.map((msg) => {
                const isSelected = selectedIds.includes(msg.id);
                const isActive = activeMessage?.id === msg.id;
                return (
                  <div
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={cn(
                      'px-4 cursor-pointer transition-colors flex items-start gap-3',
                      density === 'compact' ? 'py-2' : 'py-3.5',
                      isActive
                        ? 'bg-[#2563EB]/8 dark:bg-[#2563EB]/15'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                      !msg.isRead && 'bg-[#F7F9FC] dark:bg-slate-900/40'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => toggleSelect(msg.id, e)}
                      onChange={() => {}}
                      className="mt-1 rounded border-slate-300 text-[#2563EB] cursor-pointer"
                      aria-label={`Select message ${msg.subject}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'text-sm truncate',
                            !msg.isRead
                              ? 'font-semibold text-[#14243A] dark:text-white'
                              : 'font-medium text-[#64748B] dark:text-slate-300'
                          )}
                        >
                          {activeFolder === 'sent' ? `To: ${msg.toAddresses.join(', ')}` : msg.fromName}
                        </span>
                        <span className="text-[11px] font-mono text-[#94A3B8] shrink-0 tabular-nums">
                          {formatDateTime(msg.sentAt, tz, 'short', dateTimePrefs)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p
                          className={cn(
                            'text-xs truncate',
                            !msg.isRead
                              ? 'font-semibold text-[#172033] dark:text-slate-100'
                              : 'text-[#64748B] dark:text-slate-400'
                          )}
                        >
                          {msg.subject}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {msg.attachments.length > 0 && (
                            <Paperclip className="w-3.5 h-3.5 text-[#94A3B8]" />
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleStar(msg, e)}
                            className="p-0.5 cursor-pointer"
                            aria-label="Toggle star"
                          >
                            <Star
                              className={cn(
                                'w-3.5 h-3.5',
                                msg.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'
                              )}
                            />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 truncate mt-1">
                        {msg.snippet}
                      </p>
                      {msg.snoozedUntil && activeFolder === 'snoozed' && (
                        <p className="text-[11px] font-mono text-[#D97706] mt-1 tabular-nums">
                          Scheduled return: {formatDateTime(msg.snoozedUntil, tz, 'full', dateTimePrefs)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          {!isDrafts && total > 0 && (
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-mono tabular-nums">
                {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
              </span>
              <div className="flex items-center gap-1.5">
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
                  disabled={page * 25 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Email Reading Pane */}
        <section
          className={cn(
            'flex-1 bg-[#F7F9FC] dark:bg-[#0B1220] flex flex-col min-w-0 min-h-0',
            readingPane === 'bottom' && !activeMessage ? 'hidden' : activeMessage ? 'flex' : 'hidden lg:flex'
          )}
        >
          {!activeMessage ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyState
                icon={MailOpen}
                title="Select an email to read"
                description="Choose a conversation from the list to view full headers, attachments, and reply controls."
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Reading Action Bar */}
              <div className="px-4 sm:px-6 py-3 bg-white dark:bg-[#111A2E] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveMessage(null)}
                    className={readingPane === 'off' ? '' : 'lg:hidden'}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <Button
                    variant={defaultReplyMode === 'reply' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => handleReply(activeMessage, 'reply')}
                  >
                    <Reply className="w-3.5 h-3.5" />
                    Reply
                  </Button>
                  <Button
                    variant={defaultReplyMode === 'reply_all' ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => handleReply(activeMessage, 'reply_all')}
                  >
                    <ReplyAll className="w-3.5 h-3.5" />
                    Reply All
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleReply(activeMessage, 'forward')}>
                    <Forward className="w-3.5 h-3.5" />
                    Forward
                  </Button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeFolder === 'snoozed' && (
                    <Button variant="outline" size="sm" onClick={() => handleUnsnooze(activeMessage)}>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Unsnooze
                    </Button>
                  )}
                  {activeFolder === 'spam' && (
                    <Button variant="outline" size="sm" onClick={() => handleMove([activeMessage.id], 'inbox', 'Inbox')}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Not Spam
                    </Button>
                  )}
                  {activeFolder === 'trash' && (
                    <Button variant="outline" size="sm" onClick={() => handleMove([activeMessage.id], 'inbox', 'Inbox')}>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleArchive([activeMessage.id])} title="Archive">
                    <Archive className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleMarkUnread(activeMessage.id)} title="Mark unread">
                    <MailOpen className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleSnooze(activeMessage, 24)} title="Snooze 24h (Simulated)">
                    <Clock className="w-4 h-4" />
                  </Button>
                  <div className="relative">
                    <Button variant="ghost" size="sm" onClick={() => setMoveMenuOpen(!moveMenuOpen)} title="Move to folder">
                      <FolderInput className="w-4 h-4" />
                    </Button>
                    {moveMenuOpen && (
                      <div className="absolute right-0 mt-1 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111A2E] shadow-lg z-30 py-1 text-xs">
                        <button type="button" onClick={() => handleMove([activeMessage.id], 'inbox', 'Inbox')} className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">Inbox</button>
                        {customFolders.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleMove([activeMessage.id], f.slug, f.name)}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => window.print()} title="Print message">
                    <Printer className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete([activeMessage.id])} title="Delete">
                    <Trash2 className="w-4 h-4 text-[#DC2626]" />
                  </Button>
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                <div className="bg-white dark:bg-[#111A2E] rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#14243A] dark:text-white">
                        {activeMessage.subject}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                        <span>Status:</span>
                        <StatusText status={activeMessage.deliveryStatus} />
                        <span aria-hidden="true">·</span>
                        <span>Spam Score: <span className="font-mono">{activeMessage.spamScore}</span></span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStar(activeMessage)}
                      className="p-1 cursor-pointer"
                      aria-label={activeMessage.isStarred ? 'Unstar message' : 'Star message'}
                    >
                      <Star className={cn('w-5 h-5', activeMessage.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300')} />
                    </button>
                  </div>

                  <div className="space-y-6 mt-5">
                    {(threadingEnabled && threadMessages.length > 0 ? threadMessages : [activeMessage]).map((item) => (
                      <div key={item.id} className="pb-5 border-b last:border-b-0 border-slate-100 dark:border-slate-800">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <Avatar name={item.fromName} size="md" />
                            <div className="text-xs">
                              <p className="font-semibold text-[#172033] dark:text-slate-100">
                                {item.fromName}{' '}
                                <span className="font-mono font-normal text-[#64748B]">&lt;{item.fromAddress}&gt;</span>
                              </p>
                              <p className="text-[#64748B] mt-0.5">
                                To: {item.toAddresses.join(', ')}
                                {item.ccAddresses.length > 0 && ` · Cc: ${item.ccAddresses.join(', ')}`}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-mono text-[#94A3B8] shrink-0 tabular-nums">
                            {formatDateTime(item.sentAt, tz, 'full', dateTimePrefs)}
                          </span>
                        </div>

                        <div
                          style={{ fontFamily: defaultFont }}
                          className="mt-4 text-sm text-[#172033] dark:text-slate-200 leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.bodyHtml) }}
                        />

                        {item.attachments.length > 0 && (
                          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-semibold text-[#64748B] mb-2">
                              Attachments ({item.attachments.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {item.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={`/api/attachments/${att.id}/download`}
                                  className="inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F7F9FC] dark:bg-[#0B1220] hover:border-[#2563EB] text-xs"
                                >
                                  <Paperclip className="w-3.5 h-3.5 text-[#2563EB]" />
                                  <span className="font-medium">{att.fileName}</span>
                                  <span className="font-mono text-[#94A3B8]">{formatBytes(att.sizeBytes)}</span>
                                  <Download className="w-3.5 h-3.5 text-[#64748B]" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        initial={composeInitial}
        onSentOrSaved={() => {
          loadMail();
          loadFolders();
        }}
      />
    </WorkspaceShell>
  );
}
