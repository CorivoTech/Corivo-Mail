import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Paperclip, Search } from 'lucide-react';
import { WorkspaceShell } from '../../components/layout/WorkspaceShell.tsx';
import { Button, Card, EmptyState, FieldLabel, Input, Select, SkeletonRows } from '../../components/ui/Primitives.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { apiFetch } from '../../lib/api.ts';
import { formatDateTime } from '../../lib/utils.ts';
import type { EmailMessage } from '../../shared/types.ts';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [query, setQuery] = useState(params.get('q') || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [folder, setFolder] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hasAttachment, setHasAttachment] = useState(false);
  const [results, setResults] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async (qVal = query) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        folder,
        ...(qVal ? { q: qVal } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(subject ? { subject } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
        ...(hasAttachment ? { hasAttachment: 'true' } : {}),
      });
      const res = await apiFetch<{ messages: EmailMessage[] }>(`/api/mail?${qs.toString()}`);
      setResults(res.messages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch(params.get('q') || '');
  }, [params]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams(query ? { q: query } : {});
    runSearch(query);
  };

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-amber-200/70 text-[#14243A] px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <WorkspaceShell>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold text-[#14243A] dark:text-white">Advanced Email Search</h1>
          <p className="text-sm text-[#64748B]">Search across sender, recipient, subject, body, folder, and attachments.</p>
        </div>

        <Card className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <FieldLabel htmlFor="sr-q">Keyword</FieldLabel>
                <Input id="sr-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keywords in subject or body" />
              </div>
              <div>
                <FieldLabel htmlFor="sr-from">Sender</FieldLabel>
                <Input id="sr-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="sender@domain.example" />
              </div>
              <div>
                <FieldLabel htmlFor="sr-to">Recipient</FieldLabel>
                <Input id="sr-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@domain.example" />
              </div>
              <div>
                <FieldLabel htmlFor="sr-sub">Subject</FieldLabel>
                <Input id="sr-sub" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject contains..." />
              </div>
              <div>
                <FieldLabel htmlFor="sr-fld">Folder</FieldLabel>
                <Select id="sr-fld" value={folder} onChange={(e) => setFolder(e.target.value)}>
                  <option value="all">All Mail</option>
                  <option value="inbox">Inbox</option>
                  <option value="sent">Sent</option>
                  <option value="archive">Archive</option>
                  <option value="spam">Spam</option>
                  <option value="trash">Trash</option>
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor="sr-df">From Date</FieldLabel>
                <Input id="sr-df" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <FieldLabel htmlFor="sr-dt">To Date</FieldLabel>
                <Input id="sr-dt" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={hasAttachment} onChange={(e) => setHasAttachment(e.target.checked)} />
                  <span>Has attachment</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit">
                <Search className="w-4 h-4" />
                Search Mailbox
              </Button>
            </div>
          </form>
        </Card>

        <Card className="overflow-hidden">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching emails"
              description="Adjust your filters or search terms to find messages in your mailbox."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/app/mail/${m.folderSlug}?msg=${encodeURIComponent(m.id)}`)}
                  className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer block transition-colors"
                >
                  <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-semibold text-[#14243A] dark:text-white">
                      {highlight(m.fromName)} <span className="font-mono font-normal text-[#64748B]">&lt;{m.fromAddress}&gt;</span>
                    </span>
                    <span className="font-mono text-[#94A3B8]">
                      {m.folderSlug} · {formatDateTime(m.sentAt, session?.preferences.timezone, 'full')}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mt-1 flex items-center gap-2">
                    <span>{highlight(m.subject)}</span>
                    {m.attachments.length > 0 && <Paperclip className="w-3.5 h-3.5 text-[#94A3B8]" />}
                  </p>
                  <p className="text-xs text-[#64748B] mt-1">{highlight(m.snippet)}</p>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </WorkspaceShell>
  );
}
