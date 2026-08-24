"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui/button";
import {
  updateClientContactInfo,
  addClientNote,
  updateClientNote,
  deleteClientNote,
} from "@/lib/actions/clients";
import { reportClientError } from "@/lib/report-client-error";
import type { ClientDetail, ClientNote, ClientBookingSummary } from "@/lib/clients/data";
import type { ClientsDictionary } from "@/lib/i18n/dictionaries/clients";
import type { Locale } from "@/lib/i18n/config";

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand";

export function ClientDetailView({
  client, initialNotes, dict, locale,
}: {
  client: ClientDetail;
  initialNotes: ClientNote[];
  dict: ClientsDictionary;
  locale: Locale;
}) {
  const d = dict.detail;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-weak text-[17px] font-bold text-brand-ink">
          {client.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-[22px]">{client.name}</h1>
      </div>

      <StatsCard client={client} dict={dict} locale={locale} />
      <ContactCard client={client} dict={dict} />

      <BookingListCard
        title={d.upcomingTitle}
        empty={d.emptyUpcoming}
        bookings={client.upcoming}
        dict={dict}
        locale={locale}
      />
      <BookingListCard
        title={d.historyTitle}
        empty={d.emptyHistory}
        bookings={client.history}
        dict={dict}
        locale={locale}
      />

      <NotesCard clientId={client.id} initialNotes={initialNotes} dict={dict} locale={locale} />
    </div>
  );
}

function StatsCard({ client, dict, locale }: { client: ClientDetail; dict: ClientsDictionary; locale: Locale }) {
  const d = dict.detail;
  const fmt = (iso: string | null) => (iso ? formatDate(iso, locale) : d.never);
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="mb-3 text-[12px] font-bold uppercase tracking-[.04em] text-ink-soft">{d.statsTitle}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={d.totalSessions} value={client.totalSessions} />
        <Stat label={d.completed} value={client.completedCount} />
        <Stat label={d.noShow} value={client.noShowCount} />
        <Stat label={d.cancelled} value={client.cancelledCount} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 border-t border-line pt-4 text-[13px]">
        <span className="text-ink-soft">{d.firstVisit}: <span className="font-medium text-ink">{fmt(client.firstVisitAt)}</span></span>
        <span className="text-ink-soft">{d.lastVisit}: <span className="font-medium text-ink">{fmt(client.lastVisitAt)}</span></span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[22px] font-bold text-ink">{value}</p>
      <p className="text-[12px] text-ink-soft">{label}</p>
    </div>
  );
}

function ContactCard({ client, dict }: { client: ClientDetail; dict: ClientsDictionary }) {
  const d = dict.detail;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const result = await updateClientContactInfo(
        { clientId: client.id, name, email, phone },
        dict.errors
      );
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setSaving(false);
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch (e) {
      reportClientError("updateClientContactInfo", e);
      setError(dict.errors.errSaveFailed);
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(client.name);
    setEmail(client.email ?? "");
    setPhone(client.phone ?? "");
    setEditing(false);
    setError(null);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-bold uppercase tracking-[.04em] text-ink-soft">{d.contactTitle}</p>
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-[12.5px] font-medium text-brand hover:underline">
            {d.edit}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">{d.nameLabel}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">{d.emailLabel}</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-ink-soft">{d.phoneLabel}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </div>
          {error && <p className="text-[12.5px] text-error">{error}</p>}
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={handleSave} disabled={saving}>{saving ? d.saving : d.save}</Btn>
            <Btn size="sm" variant="ghost" onClick={handleCancel} disabled={saving}>{d.cancel}</Btn>
          </div>
        </div>
      ) : (
        <dl className="flex flex-col gap-1.5 text-[14px]">
          <Row label={d.nameLabel} value={client.name} />
          <Row label={d.emailLabel} value={client.email ?? "—"} />
          <Row label={d.phoneLabel} value={client.phone ?? "—"} />
          {saved && <p className="mt-1 text-[12.5px] text-brand-ink">{d.saved}</p>}
        </dl>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function statusLabel(status: string, d: ClientsDictionary["detail"]): string {
  switch (status) {
    case "pending_confirmation": return d.statusPending;
    case "confirmed": return d.statusConfirmed;
    case "completed": return d.statusCompleted;
    case "no_show": return d.statusNoShow;
    case "cancelled": return d.statusCancelled;
    default: return status;
  }
}

function BookingListCard({
  title, empty, bookings, dict, locale,
}: {
  title: string;
  empty: string;
  bookings: ClientBookingSummary[];
  dict: ClientsDictionary;
  locale: Locale;
}) {
  const d = dict.detail;
  return (
    <div>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[.04em] text-ink-soft">{title}</p>
      {bookings.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-[13px] text-ink-soft">
          {empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {bookings.map((b, i) => (
            <div key={b.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{b.serviceName}</p>
                <p className="truncate text-[12px] text-ink-soft capitalize">
                  {formatDateTime(b.startIso, locale)}
                  {b.providerName ? ` · ${b.providerName}` : ""} · {b.durationMin} {d.minutesUnit}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                {statusLabel(b.status, d)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotesCard({
  clientId, initialNotes, dict, locale,
}: {
  clientId: string;
  initialNotes: ClientNote[];
  dict: ClientsDictionary;
  locale: Locale;
}) {
  const d = dict.detail;
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [newBody, setNewBody] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const body = newBody.trim();
    if (!body) return;
    setAdding(true);
    setError(null);
    try {
      const result = await addClientNote({ clientId, body }, dict.errors);
      if (!result.ok) {
        setError(result.error);
        setAdding(false);
        return;
      }
      setNotes((prev) => [
        { id: result.noteId, body, authorName: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ...prev,
      ]);
      setNewBody("");
      setAdding(false);
      router.refresh();
    } catch (e) {
      reportClientError("addClientNote", e);
      setError(dict.errors.errSaveFailed);
      setAdding(false);
    }
  }

  async function handleSaveEdit(noteId: string) {
    const body = editBody.trim();
    if (!body) return;
    setError(null);
    try {
      const result = await updateClientNote({ noteId, clientId, body }, dict.errors);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, body, updatedAt: new Date().toISOString() } : n)));
      setEditingId(null);
      router.refresh();
    } catch (e) {
      reportClientError("updateClientNote", e);
      setError(dict.errors.errSaveFailed);
    }
  }

  async function handleDelete(noteId: string) {
    if (!window.confirm(d.confirmDeleteNote)) return;
    setError(null);
    const prev = notes;
    setNotes((n) => n.filter((x) => x.id !== noteId));
    try {
      const result = await deleteClientNote({ noteId, clientId }, dict.errors);
      if (!result.ok) {
        setNotes(prev);
        setError(result.error);
        return;
      }
      router.refresh();
    } catch (e) {
      reportClientError("deleteClientNote", e);
      setNotes(prev);
      setError(dict.errors.errSaveFailed);
    }
  }

  return (
    <div>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[.04em] text-ink-soft">{d.notesTitle}</p>

      <div className="mb-3 rounded-xl border border-line bg-surface p-3">
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder={d.notesPlaceholder}
          rows={3}
          className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
        />
        <div className="mt-2 flex justify-end">
          <Btn size="sm" onClick={handleAdd} disabled={adding || !newBody.trim()}>
            {adding ? d.saving : d.addNote}
          </Btn>
        </div>
      </div>

      {error && <p className="mb-2 text-[12.5px] text-error">{error}</p>}

      {notes.length === 0 ? (
        <p className="px-1 text-[13px] text-ink-soft">{d.emptyNotes}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-line bg-surface p-3">
              {editingId === n.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
                  />
                  <div className="flex justify-end gap-2">
                    <Btn size="sm" onClick={() => handleSaveEdit(n.id)}>{d.saveNote}</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditingId(null)}>{d.cancel}</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[13.5px] text-ink">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11.5px] text-ink-soft">
                      {n.authorName ? `${n.authorName} · ` : ""}{formatDateTime(n.createdAt, locale)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setEditingId(n.id); setEditBody(n.body); }}
                        className="text-[11.5px] font-medium text-ink-soft hover:text-ink"
                      >
                        {d.editNote}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(n.id)}
                        className="text-[11.5px] font-medium text-ink-soft hover:text-error"
                      >
                        {d.deleteNote}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}
