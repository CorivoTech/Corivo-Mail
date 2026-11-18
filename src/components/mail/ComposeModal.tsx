import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Link2,
  List,
  Paperclip,
  Save,
  Send,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { formatBytes } from '../../lib/utils.ts';
import type { Attachment, Draft } from '../../shared/types.ts';
import { Button, DevelopmentModeNotice } from '../ui/Primitives.tsx';

export interface ComposeInitialState {
  draftId?: string;
  to?: string[];
  cc?: string[];
  subject?: string;
  bodyHtml?: string;
  inReplyToId?: string;
}

export function ComposeModal({
  open,
  onClose,
  initial,
  onSentOrSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ComposeInitialState | null;
  onSentOrSaved: () => void;
}) {
  const { session } = useAuth();
  const { notify, confirm } = useToast();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(undefined);
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    setToInput(initial?.to?.join(', ') || '');
    setCcInput(initial?.cc?.join(', ') || '');
    setBccInput('');
    setShowCcBcc(Boolean(initial?.cc?.length));
    setSubject(initial?.subject || '');
    setDraftId(initial?.draftId);
    setAttachments([]);
    setLinkPromptOpen(false);
    setLinkUrl('');

    const sig =
      session?.preferences.signatureEnabled && session.preferences.signatureHtml && !initial?.draftId
        ? `<br/><br/><div class="corivo-signature">${session.preferences.signatureHtml}</div>`
        : '';

    if (editorRef.current) {
      editorRef.current.innerHTML = (initial?.bodyHtml || '<p></p>') + sig;
    }
  }, [open, initial, session]);

  if (!open) return null;

  const parseEmails = (val: string): string[] =>
    val
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handleApplyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      notify('Enter a valid http:// or https:// URL.', 'error');
      return;
    }
    execFormat('createLink', trimmed);
    setLinkPromptOpen(false);
    setLinkUrl('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        notify(`${file.name} exceeds the 25 MB attachment limit.`, 'error');
        continue;
      }
      setUploadProgress(25);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || '');
            resolve(result.split(',')[1] || '');
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        setUploadProgress(65);
        const res = await apiFetch<{ attachment: Attachment }>('/api/attachments/upload', {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            contentBase64: base64,
          }),
        });
        setUploadProgress(100);
        setAttachments((prev) => [...prev, res.attachment]);
        notify(`Attached ${file.name}`, 'success');
      } catch (err) {
        notify(err instanceof ApiError ? err.message : `Failed to upload ${file.name}`, 'error');
      } finally {
        setTimeout(() => setUploadProgress(null), 400);
      }
    }
    e.target.value = '';
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const payload = {
        to: parseEmails(toInput),
        cc: parseEmails(ccInput),
        bcc: parseEmails(bccInput),
        subject,
        bodyHtml: editorRef.current?.innerHTML || '',
        attachmentIds: attachments.map((a) => a.id),
      };
      if (draftId) {
        await apiFetch<{ draft: Draft }>(`/api/mail/drafts/${draftId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        const res = await apiFetch<{ draft: Draft }>('/api/mail/drafts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setDraftId(res.draft.id);
      }
      notify('Draft saved.', 'success');
      onSentOrSaved();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to save draft', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDiscard = async () => {
    const ok = await confirm({
      title: 'Discard this message?',
      description: 'Unsaved edits will be discarded.',
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (!ok) return;
    if (draftId) {
      await apiFetch(`/api/mail/drafts/${draftId}`, { method: 'DELETE' }).catch(() => {});
      onSentOrSaved();
    }
    onClose();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = parseEmails(toInput);
    const cc = parseEmails(ccInput);
    const bcc = parseEmails(bccInput);
    const bodyHtml = editorRef.current?.innerHTML || '';

    if (to.length === 0) {
      notify('Enter at least one recipient email address.', 'error');
      return;
    }
    if (!subject.trim()) {
      notify('Subject is required before sending.', 'error');
      return;
    }
    if (session?.preferences.confirmBeforeSend) {
      const ok = await confirm({
        title: 'Send email?',
        description: `Send "${subject}" to ${to.join(', ')}?`,
        confirmLabel: 'Send Now',
      });
      if (!ok) return;
    }

    setSending(true);
    try {
      const res = await apiFetch<{ transport: { detail: string; mode: string } }>('/api/mail/send', {
        method: 'POST',
        body: JSON.stringify({
          to,
          cc,
          bcc,
          subject,
          bodyHtml,
          attachmentIds: attachments.map((a) => a.id),
          draftId,
          inReplyToId: initial?.inReplyToId,
        }),
      });
      notify('Email accepted into mail queue.', 'success', res.transport.detail);
      onSentOrSaved();
      onClose();
    } catch (err) {
      const isBounce = err instanceof ApiError && err.status === 502;
      notify(
        err instanceof ApiError ? err.message : 'Mail service unavailable. Your draft has been preserved.',
        'error'
      );
      if (isBounce) {
        onSentOrSaved();
      } else {
        await handleSaveDraft();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#14243A]/45 p-0 sm:p-4">
      <form
        onSubmit={handleSend}
        className="w-full sm:max-w-3xl h-[92vh] sm:h-auto sm:max-h-[88vh] flex flex-col bg-white dark:bg-[#111A2E] sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#14243A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">New Message</span>
            <span className="text-xs text-slate-300 font-mono hidden sm:inline">
              From: {session?.mailbox?.emailAddress || session?.user.email}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white p-1" aria-label="Close composer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B] w-12 shrink-0">To</span>
            <input
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="recipient@company.example (comma-separated)"
              className="flex-1 py-1.5 bg-transparent focus:outline-none text-sm"
            />
            {!showCcBcc && (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-[#2563EB] hover:underline shrink-0"
              >
                Cc / Bcc
              </button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                <span className="text-xs text-[#64748B] w-12 shrink-0">Cc</span>
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  placeholder="cc@company.example"
                  className="flex-1 py-1 bg-transparent focus:outline-none text-sm"
                />
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                <span className="text-xs text-[#64748B] w-12 shrink-0">Bcc</span>
                <input
                  type="text"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  placeholder="bcc@company.example"
                  className="flex-1 py-1 bg-transparent focus:outline-none text-sm"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span className="text-xs text-[#64748B] w-12 shrink-0">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              className="flex-1 py-1.5 bg-transparent focus:outline-none text-sm font-medium"
            />
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="px-5 py-2 border-b border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => execFormat('bold')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800" title="Bold"><Bold className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => execFormat('italic')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800" title="Italic"><Italic className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => execFormat('underline')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800" title="Underline"><Underline className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => execFormat('insertUnorderedList')} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800" title="Bullet list"><List className="w-3.5 h-3.5" /></button>
          <button
            type="button"
            onClick={() => setLinkPromptOpen((v) => !v)}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
            title="Insert link"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-[#172033] dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Paperclip className="w-3.5 h-3.5" />
            Attach (Max 25 MB)
          </button>
          {linkPromptOpen && (
            <div className="w-full mt-2 flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 h-8 px-2.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111A2E] text-xs focus:outline-none focus:border-[#2563EB]"
              />
              <Button type="button" size="sm" onClick={handleApplyLink}>Insert Link</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setLinkPromptOpen(false)}>Cancel</Button>
            </div>
          )}
        </div>

        {/* Upload progress & Attachments */}
        {(uploadProgress !== null || attachments.length > 0) && (
          <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
            {uploadProgress !== null && (
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#2563EB] transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111A2E] text-xs"
                >
                  <span className="truncate max-w-[180px] font-medium">{att.fileName}</span>
                  <span className="text-[#94A3B8] font-mono">{formatBytes(att.sizeBytes)}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                    className="text-slate-400 hover:text-[#DC2626]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rich Text Editor Body */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[220px]">
          {session?.runtimeMode === 'DEVELOPMENT_SIMULATED' && (
            <div className="mb-3">
              <DevelopmentModeNotice detail="Local Development Mail Transport active. Internal Corivo addresses deliver locally; external domains record queue acceptance." />
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            style={{ fontFamily: session?.preferences.defaultFont || 'DM Sans' }}
            className="min-h-[180px] text-sm leading-relaxed focus:outline-none prose prose-sm max-w-none dark:prose-invert"
          />
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={sending}>
              <Send className="w-4 h-4" />
              {sending ? 'Submitting...' : 'Send Email'}
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={savingDraft}>
              <Save className="w-4 h-4" />
              {savingDraft ? 'Saving...' : 'Save Draft'}
            </Button>
          </div>
          <Button type="button" variant="ghost" onClick={handleDiscard}>
            <Trash2 className="w-4 h-4 text-[#DC2626]" />
            <span className="hidden sm:inline text-[#DC2626]">Discard</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
