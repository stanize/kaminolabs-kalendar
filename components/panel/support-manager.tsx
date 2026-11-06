"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  submitSupportTicket,
  getTicketWithComments,
  addTicketComment,
  updateTicketComment,
  deleteTicketComment,
  type SupportTicketCategory,
  type SupportTicketStatus,
  type SupportTicketSummary,
  type SupportTicketDetail,
  type SupportTicketComment,
} from "@/lib/actions/support";
import { reportClientError } from "@/lib/report-client-error";
import type { SupportDictionary } from "@/lib/i18n/dictionaries/support";

const CATEGORY_ORDER: SupportTicketCategory[] = ["technical", "billing", "feature_request", "account", "other"];
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;
const STATUS_FILTER_ORDER: SupportTicketStatus[] = ["open", "in_progress", "resolved", "closed"];
type StatusFilter = "all" | SupportTicketStatus;

function statusBadgeClass(status: SupportTicketStatus): string {
  switch (status) {
    case "open": return "border-amber-300 bg-amber-50 text-amber-700";
    case "in_progress": return "border-brand-line bg-brand-weak text-brand-ink";
    case "resolved": return "border-line bg-surface-2 text-ink-soft";
    case "closed": return "border-line bg-surface-2 text-ink-soft";
  }
}

function formatWhen(iso: string, intlLocale: string): string {
  return new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * support-ticketing-v1 (workflows/support-ticketing.md): the clinic's own
 * Soporte page — submit a new ticket (side panel) and see/reply to past
 * tickets (list + detail side panel), same shell/pattern as every other
 * add/edit surface in this app.
 */
export function SupportManager({
  initialTickets,
  dict,
  myEmail,
}: {
  initialTickets: SupportTicketSummary[];
  dict: SupportDictionary;
  myEmail: string;
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [newPanelOpen, setNewPanelOpen] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredTickets = statusFilter === "all" ? tickets : tickets.filter((t) => t.status === statusFilter);

  return (
    <div className="flex flex-col gap-4">
      <Btn variant="primary" size="sm" onClick={() => setNewPanelOpen(true)} className="self-start">
        {dict.newTicketButton}
      </Btn>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[13px] font-semibold text-ink-soft">{dict.listTitle}</h2>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                statusFilter === "all" ? "border-brand-line bg-brand-weak text-brand-ink" : "border-line bg-surface text-ink-soft hover:border-brand-line"
              }`}
            >
              {dict.filterAll}
            </button>
            {STATUS_FILTER_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  statusFilter === s ? "border-brand-line bg-brand-weak text-brand-ink" : "border-line bg-surface text-ink-soft hover:border-brand-line"
                }`}
              >
                {dict.statuses[s]}
              </button>
            ))}
          </div>
        </div>
        {filteredTickets.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-[13px] text-ink-soft">
            {tickets.length === 0 ? dict.listEmpty : dict.listEmptyFiltered}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredTickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOpenTicketId(t.id)}
                className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-brand-line"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[14px] font-semibold text-ink">{t.subject}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(t.status)}`}>
                    {dict.statuses[t.status]}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-soft">
                  <span>{dict.categories[t.category]}</span>
                  <span>·</span>
                  <span>{formatWhen(t.updatedAt, "es-ES")}</span>
                  {t.commentCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{dict.commentCountTemplate.replace("{n}", String(t.commentCount))}</span>
                    </>
                  )}
                </div>
                {t.reportedVia !== "panel" && (
                  <span className="text-[11.5px] italic text-ink-soft">
                    {dict.loggedByAdminNote.replace("{channel}", dict.sources[t.reportedVia])}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {newPanelOpen && (
        <NewTicketPanel
          dict={dict}
          onClose={() => setNewPanelOpen(false)}
          onCreated={(ticket) => {
            setNewPanelOpen(false);
            setTickets((ts) => [ticket, ...ts]);
          }}
        />
      )}

      {openTicketId && (
        <TicketDetailPanel
          ticketId={openTicketId}
          dict={dict}
          myEmail={myEmail}
          onClose={() => setOpenTicketId(null)}
          onCommentAdded={() => {
            setTickets((ts) =>
              ts.map((t) => (t.id === openTicketId ? { ...t, commentCount: t.commentCount + 1, updatedAt: new Date().toISOString() } : t))
            );
          }}
        />
      )}
    </div>
  );
}

function NewTicketPanel({
  dict,
  onClose,
  onCreated,
}: {
  dict: SupportDictionary;
  onClose: () => void;
  onCreated: (ticket: SupportTicketSummary) => void;
}) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("technical");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const closingRef = useRef(false);
  function requestClose(after: () => void) {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(after, 200);
  }
  const closePanel = () => requestClose(onClose);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((f) => {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(dict.errFileTooBig.replace("{name}", f.name).replace("{maxSizeMb}", String(MAX_FILE_SIZE_MB)));
        return false;
      }
      if (!f.type.startsWith("image/")) {
        setError(dict.errFileInvalidType.replace("{name}", f.name));
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    setError(null);
    if (!subject.trim()) { setError(dict.errSubjectRequired); return; }
    if (!description.trim()) { setError(dict.errDescriptionRequired); return; }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("description", description);
    formData.set("category", category);
    files.forEach((f) => formData.append("attachments", f));

    try {
      const result = await submitSupportTicket(formData);
      setSubmitting(false);
      if (!result.ok) { setError(result.error); return; }
      onCreated({
        id: result.ticketId,
        subject: subject.trim(),
        category,
        status: "open",
        reportedVia: "panel",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        commentCount: 0,
      });
    } catch (e) {
      setSubmitting(false);
      reportClientError("submitSupportTicket", e);
      setError(dict.errReplyFailed);
    }
  }

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 md:left-[240px]">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={() => !submitting && closePanel()}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 right-0 flex h-full w-full flex-col overflow-y-auto bg-surface p-5 shadow-2xl transition-transform duration-200 ease-out sm:w-1/2 sm:min-w-[480px] sm:p-8 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{dict.formTitle}</h2>
          <button
            onClick={() => !submitting && closePanel()}
            aria-label={dict.cancel}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink">{dict.categoryLabel}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
              className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{dict.categories[c]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink">{dict.subjectLabel}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={dict.subjectPlaceholder}
              maxLength={120}
              className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink">{dict.descriptionLabel}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={dict.descriptionPlaceholder}
              rows={5}
              maxLength={2000}
              className="w-full resize-none rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none"
            />
            <p className="text-right text-[11.5px] text-ink-soft">{description.length}/2000</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-ink">
              {dict.attachmentsLabel}
              <span className="ml-1.5 text-[12px] font-normal text-ink-soft">
                {dict.attachmentsHint.replace("{maxFiles}", String(MAX_FILES)).replace("{maxSizeMb}", String(MAX_FILE_SIZE_MB))}
              </span>
            </label>

            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-[8px] border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-soft">
                    <Icon name="paperclip" size={13} />
                    <span className="max-w-[140px] truncate">{file.name}</span>
                    <button onClick={() => setFiles((fs) => fs.filter((_, idx) => idx !== i))} className="ml-0.5 hover:text-ink">
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {files.length < MAX_FILES && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-fit items-center gap-2 rounded-[9px] border border-dashed border-line px-3.5 py-2 text-[13px] text-ink-soft hover:border-brand hover:text-brand"
                >
                  <Icon name="paperclip" size={15} />
                  {dict.attachButton}
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">{error}</div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => !submitting && closePanel()} className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2">
            {dict.cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? dict.submitting : dict.submitButton}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketDetailPanel({
  ticketId,
  dict,
  myEmail,
  onClose,
  onCommentAdded,
}: {
  ticketId: string;
  dict: SupportDictionary;
  myEmail: string;
  onClose: () => void;
  onCommentAdded: () => void;
}) {
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [pastedFiles, setPastedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTicketWithComments(ticketId).then((d) => { if (!cancelled) setDetail(d); });
    return () => { cancelled = true; };
  }, [ticketId]);

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const closingRef = useRef(false);
  function requestClose(after: () => void) {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(after, 200);
  }
  const closePanel = () => requestClose(onClose);

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items);
    const images = items.filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile()).filter((f): f is File => !!f);
    if (images.length === 0) return;
    setPastedFiles((prev) => [...prev, ...images].slice(0, MAX_FILES));
  }

  async function handleReply() {
    if (!reply.trim() && pastedFiles.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("ticketId", ticketId);
      formData.set("body", reply.trim());
      pastedFiles.forEach((f) => formData.append("attachments", f));

      const res = await addTicketComment(formData);
      setSending(false);
      if (!res.ok) { setError(res.error); return; }
      setDetail((d) => (d ? { ...d, comments: [...d.comments, res.comment] } : d));
      setReply("");
      setPastedFiles([]);
      onCommentAdded();
    } catch (e) {
      setSending(false);
      reportClientError("addTicketComment", e);
      setError(dict.errReplyFailed);
    }
  }

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 md:left-[240px]">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={closePanel}
        aria-hidden
      />
      <div
        className={`absolute inset-y-0 right-0 flex h-full w-full flex-col overflow-y-auto bg-surface p-5 shadow-2xl transition-transform duration-200 ease-out sm:w-1/2 sm:min-w-[480px] sm:p-8 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {!detail ? (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />)}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[17px] font-bold text-ink">{detail.subject}</h2>
                <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(detail.status)}`}>
                  {dict.statuses[detail.status]}
                </span>
              </div>
              <button onClick={closePanel} aria-label={dict.detailClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-surface-2">
                <Icon name="x" size={16} />
              </button>
            </div>

            <p className="mb-4 whitespace-pre-wrap text-[13.5px] text-ink">{detail.description}</p>

            {detail.attachments.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">{dict.attachmentsSection}</p>
                <div className="flex flex-wrap gap-2">
                  {detail.attachments.map((url) => (
                    <button key={url} type="button" onClick={() => setLightboxUrl(url)}>
                      <img src={url} alt="" className="h-20 w-20 rounded-lg border border-line object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3 flex-1">
              <p className="mb-1.5 text-[12.5px] font-semibold text-ink-soft">{dict.commentsSection}</p>
              {detail.comments.length === 0 ? (
                <p className="text-[12.5px] text-ink-soft">{dict.noComments}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.comments.map((c) => (
                    <CommentItem
                      key={c.id}
                      comment={c}
                      dict={dict}
                      isMine={c.authorType === "clinic" && c.authorEmail === myEmail}
                      onOpenImage={setLightboxUrl}
                      onUpdated={(updated) => setDetail((d) => (d ? { ...d, comments: d.comments.map((x) => (x.id === updated.id ? updated : x)) } : d))}
                      onDeleted={(id) => setDetail((d) => (d ? { ...d, comments: d.comments.filter((x) => x.id !== id) } : d))}
                    />
                  ))}
                </div>
              )}
            </div>

            {error && <div className="mb-2 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">{error}</div>}

            {pastedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {pastedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-1 text-[11px] text-ink-soft">
                    <Icon name="paperclip" size={11} />
                    <span className="max-w-[90px] truncate">{f.name || "imagen.png"}</span>
                    <button onClick={() => setPastedFiles((fs) => fs.filter((_, idx) => idx !== i))} className="hover:text-ink">
                      <Icon name="x" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onPaste={handlePaste}
                placeholder={dict.replyPlaceholder}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink focus:border-brand focus:outline-none"
              />
              <button
                onClick={handleReply}
                disabled={sending || (!reply.trim() && pastedFiles.length === 0)}
                className="shrink-0 self-end rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {sending ? dict.replySending : dict.replyButton}
              </button>
            </div>
          </>
        )}
      </div>

      {lightboxUrl && <Lightbox url={lightboxUrl} label={dict.lightboxClose} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

function Lightbox({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button onClick={onClose} aria-label={label} className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
        <Icon name="x" size={18} />
      </button>
      <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function CommentItem({
  comment: c,
  dict,
  isMine,
  onOpenImage,
  onUpdated,
  onDeleted,
}: {
  comment: SupportTicketComment;
  dict: SupportDictionary;
  isMine: boolean;
  onOpenImage: (url: string) => void;
  onUpdated: (comment: SupportTicketComment) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!editText.trim()) return;
    setBusy(true);
    try {
      const res = await updateTicketComment({ commentId: c.id, body: editText.trim() });
      setBusy(false);
      if (res.ok) {
        onUpdated({ ...c, body: editText.trim() });
        setEditing(false);
      }
    } catch (e) {
      setBusy(false);
      reportClientError("updateTicketComment", e);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const res = await deleteTicketComment(c.id);
      setBusy(false);
      if (res.ok) onDeleted(c.id);
    } catch (e) {
      setBusy(false);
      reportClientError("deleteTicketComment", e);
    }
  }

  return (
    <div className={`rounded-lg border px-3 py-2 text-[13px] ${c.authorType === "admin" ? "border-brand-line bg-brand-weak" : "border-line bg-surface-2/50"}`}>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-ink-soft">
          {c.authorType === "admin" ? "Kalendar Support Team" : (c.authorName || c.authorEmail)} · {formatWhen(c.createdAt, "es-ES")}
        </p>
        {isMine && !editing && (
          <div className="flex shrink-0 items-center gap-2 text-[11px]">
            <button onClick={() => { setEditText(c.body); setEditing(true); }} className="font-medium text-ink-soft hover:text-ink">
              {dict.commentEdit}
            </button>
            {confirmingDelete ? (
              <>
                <span className="text-ink-soft">{dict.commentDeleteConfirm}</span>
                <button onClick={handleDelete} disabled={busy} className="font-semibold text-error hover:underline disabled:opacity-50">
                  {dict.commentDelete}
                </button>
                <button onClick={() => setConfirmingDelete(false)} className="text-ink-soft hover:text-ink">
                  {dict.commentCancel}
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} className="font-medium text-error hover:underline">
                {dict.commentDelete}
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={2}
            className="resize-none rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-ink focus:border-brand focus:outline-none"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={busy || !editText.trim()} className="rounded-md bg-brand px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {dict.commentSave}
            </button>
            <button onClick={() => setEditing(false)} className="text-[11.5px] font-medium text-ink-soft hover:text-ink">
              {dict.commentCancel}
            </button>
          </div>
        </div>
      ) : (
        c.body && <p className="whitespace-pre-wrap text-ink">{c.body}</p>
      )}

      {c.attachments.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {c.attachments.map((url) => (
            <button key={url} type="button" onClick={() => onOpenImage(url)}>
              <img src={url} alt="" className="h-14 w-14 rounded-md border border-line object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
