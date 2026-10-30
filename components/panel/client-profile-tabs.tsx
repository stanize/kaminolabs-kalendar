"use client";

import { useEffect, useState } from "react";
import { Btn } from "@/components/ui/button";
import {
  getClientPanelData,
  updateClientContactInfo,
  addClientNote,
  updateClientNote,
  deleteClientNote,
  type ClientPanelData,
} from "@/lib/actions/clients";
import { reportClientError } from "@/lib/report-client-error";
import type { CalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import type { ClientBookingSummary } from "@/lib/clients/data";

export type ClientProfileTab = "cliente" | "historial" | "notas";
// The full tab bar, shared by AppointmentModal and BookingDetailModal —
// "cita" is each panel's own existing content, not rendered by this file.
export type FullTab = "cita" | ClientProfileTab;
export const TAB_ORDER: FullTab[] = ["cita", "cliente", "historial", "notas"];
export const TAB_LABEL: Record<FullTab, (d: CalendarDictionary["clientTabs"]) => string> = {
  cita: (d) => d.tabCita,
  cliente: (d) => d.tabCliente,
  historial: (d) => d.tabHistorial,
  notas: (d) => d.tabNotas,
};

// appointment-panel-tabs: the fields a brand-new (not-yet-created) client
// can be given during appointment CREATION, before a real kalendar_clients
// row exists — held here by the parent panel and flushed (via
// updateClientContactInfo + addClientNote) right after the booking (and
// its freshly-created client row) is saved. Name/email/phone are NOT
// included — those are already the Cita tab's own client fields.
export interface StagedClientFields {
  dni: string;
  address: string;
  dateOfBirth: string;
  note: string;
}

export const EMPTY_STAGED_CLIENT_FIELDS: StagedClientFields = { dni: "", address: "", dateOfBirth: "", note: "" };

function statusLabel(status: ClientBookingSummary["status"], d: CalendarDictionary["clientTabs"]): string {
  switch (status) {
    case "pending_confirmation": return d.statusPending;
    case "confirmed": return d.statusConfirmed;
    case "completed": return d.statusCompleted;
    case "no_show": return d.statusNoShow;
    case "cancelled": return d.statusCancelled;
  }
}

/**
 * appointment-panel-tabs: Cliente/Historial/Notas content, shared by
 * AppointmentModal (create) and BookingDetailModal (existing booking).
 *
 * Two modes, switched on `clientId`:
 * - clientId set (existing booking, or an existing client picked while
 *   creating a new one): fetches+shows the real client record, every edit
 *   saves immediately via the same actions client-detail-view.tsx uses.
 * - clientId null (creating an appointment for a brand-new client — no
 *   kalendar_clients row exists yet): Cliente/Notas render editable but
 *   write into the `staged`/`onStagedChange` fields instead of the server;
 *   Historial is always empty (nothing to show yet). The parent flushes
 *   `staged` after the booking is created.
 */
export function ClientProfileTabs({
  activeTab,
  clientId,
  currentBookingId,
  staged,
  onStagedChange,
  dict,
}: {
  activeTab: ClientProfileTab;
  clientId: string | null;
  currentBookingId?: string;
  staged: StagedClientFields;
  onStagedChange: (next: StagedClientFields) => void;
  dict: CalendarDictionary["clientTabs"];
}) {
  const [data, setData] = useState<ClientPanelData | null>(null);
  // Derived instead of a separately-tracked boolean set inside the effect
  // (which would mean calling setState synchronously in the effect body) —
  // "loading" just means "clientId is set but we haven't loaded data for
  // this particular id yet".
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const loading = !!clientId && loadedForId !== clientId;

  useEffect(() => {
    // Nothing to fetch for a brand-new (not-yet-created) client — `data`
    // is simply never read in that case (every branch below checks
    // `clientId` first).
    if (!clientId) return;
    let cancelled = false;
    getClientPanelData(clientId).then((res) => {
      if (cancelled) return;
      setData(res);
      setLoadedForId(clientId);
    }).catch((e) => {
      if (cancelled) return;
      reportClientError("getClientPanelData", e);
      setLoadedForId(clientId);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (activeTab === "cliente") {
    return clientId ? (
      <LiveClienteTab
        clientId={clientId}
        data={data}
        loading={loading}
        dict={dict}
        onSaved={(profile) => setData((d) => (d ? { ...d, profile } : d))}
      />
    ) : (
      <StagedClienteTab staged={staged} onStagedChange={onStagedChange} dict={dict} />
    );
  }

  if (activeTab === "historial") {
    if (!clientId) {
      return <p className="text-[13px] text-ink-soft">{dict.historialEmptyNewClient}</p>;
    }
    if (loading) return <HistorialSkeleton />;
    const history = data?.history ?? [];
    if (history.length === 0) return <p className="text-[13px] text-ink-soft">{dict.historialEmpty}</p>;
    return (
      <div className="flex flex-col gap-2">
        {history.map((b) => (
          <HistorialRow key={b.id} booking={b} isCurrent={b.id === currentBookingId} dict={dict} />
        ))}
      </div>
    );
  }

  // Notas
  return clientId ? (
    <LiveNotasTab
      clientId={clientId}
      notes={data?.notes ?? []}
      loading={loading}
      dict={dict}
      onChanged={(notes) => setData((d) => (d ? { ...d, notes } : d))}
    />
  ) : (
    <StagedNotasTab staged={staged} onStagedChange={onStagedChange} dict={dict} />
  );
}

function fieldClass() {
  return "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

// ── Cliente ──────────────────────────────────────────────────────────────

function LiveClienteTab({
  clientId,
  data,
  loading,
  dict,
  onSaved,
}: {
  clientId: string;
  data: ClientPanelData | null;
  loading: boolean;
  dict: CalendarDictionary["clientTabs"];
  onSaved: (profile: NonNullable<ClientPanelData>["profile"]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dni, setDni] = useState("");
  const [address, setAddress] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || !data) return <ClienteSkeleton />;

  // Fields are only initialized from `data` the moment edit mode starts
  // (data is guaranteed loaded by then, per the guard above) — avoids
  // syncing local state from a prop in an effect.
  function startEditing() {
    if (!data) return;
    setName(data.profile.name);
    setEmail(data.profile.email ?? "");
    setPhone(data.profile.phone ?? "");
    setDni(data.profile.dni ?? "");
    setAddress(data.profile.address ?? "");
    setDateOfBirth(data.profile.dateOfBirth ?? "");
    setEditing(true);
  }

  const isDirty =
    name !== data.profile.name ||
    email !== (data.profile.email ?? "") ||
    phone !== (data.profile.phone ?? "") ||
    dni !== (data.profile.dni ?? "") ||
    address !== (data.profile.address ?? "") ||
    dateOfBirth !== (data.profile.dateOfBirth ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await updateClientContactInfo({ clientId, name, email, phone, dni, address, dateOfBirth });
      setSaving(false);
      if (!res.ok) { setError(res.error); return; }
      onSaved({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, dni: dni.trim() || null, address: address.trim() || null, dateOfBirth: dateOfBirth.trim() || null });
      setEditing(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setSaving(false);
      reportClientError("updateClientContactInfo", e);
      setError(dict.saving);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        {savedFlash && <p className="text-[12.5px] font-semibold text-brand">{dict.saved}</p>}
        <Row label={dict.nameLabel} value={data.profile.name} />
        <Row label={dict.emailLabel} value={data.profile.email ?? "—"} />
        <Row label={dict.phoneLabel} value={data.profile.phone ?? "—"} />
        <Row label={dict.dniLabel} value={data.profile.dni ?? "—"} />
        <Row label={dict.addressLabel} value={data.profile.address ?? "—"} />
        <Row label={dict.dateOfBirthLabel} value={data.profile.dateOfBirth ?? "—"} />
        <Btn variant="outline" size="sm" onClick={startEditing} className="self-start">
          {dict.editButton}
        </Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-[12.5px] text-error">{error}</p>}
      <Field label={dict.nameLabel}><input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass()} /></Field>
      <Field label={dict.emailLabel}><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={fieldClass()} /></Field>
      <Field label={dict.phoneLabel}><input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldClass()} /></Field>
      <Field label={dict.dniLabel}><input value={dni} onChange={(e) => setDni(e.target.value)} className={fieldClass()} /></Field>
      <Field label={dict.addressLabel}><input value={address} onChange={(e) => setAddress(e.target.value)} className={fieldClass()} /></Field>
      <Field label={dict.dateOfBirthLabel}><input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={fieldClass()} /></Field>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>{dict.cancelEditButton}</Btn>
        <Btn variant={isDirty ? "primary" : "outline"} size="sm" onClick={handleSave} disabled={!isDirty || saving}>
          {saving ? dict.saving : dict.saveButton}
        </Btn>
      </div>
    </div>
  );
}

function StagedClienteTab({
  staged,
  onStagedChange,
  dict,
}: {
  staged: StagedClientFields;
  onStagedChange: (next: StagedClientFields) => void;
  dict: CalendarDictionary["clientTabs"];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-soft">{dict.newClientNote}</p>
      <Field label={dict.dniLabel}>
        <input value={staged.dni} onChange={(e) => onStagedChange({ ...staged, dni: e.target.value })} className={fieldClass()} />
      </Field>
      <Field label={dict.addressLabel}>
        <input value={staged.address} onChange={(e) => onStagedChange({ ...staged, address: e.target.value })} className={fieldClass()} />
      </Field>
      <Field label={dict.dateOfBirthLabel}>
        <input type="date" value={staged.dateOfBirth} onChange={(e) => onStagedChange({ ...staged, dateOfBirth: e.target.value })} className={fieldClass()} />
      </Field>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-ink-soft">{label}</p>
      <p className="text-[14px] text-ink">{value}</p>
    </div>
  );
}

function ClienteSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
      ))}
    </div>
  );
}

// ── Historial ────────────────────────────────────────────────────────────

function HistorialSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
      ))}
    </div>
  );
}

function HistorialRow({
  booking,
  isCurrent,
  dict,
}: {
  booking: ClientBookingSummary;
  isCurrent: boolean;
  dict: CalendarDictionary["clientTabs"];
}) {
  const isResolved = booking.status === "cancelled" || booking.status === "no_show";
  const when = new Date(booking.startIso);
  const dateLabel = when.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  const timeLabel = when.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${
        isResolved
          ? "border-line bg-slate-50 text-slate-500 line-through decoration-slate-400"
          : isCurrent
            ? "border-brand bg-brand-weak text-ink"
            : "border-line bg-surface text-ink"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {dateLabel} · {timeLabel} — {booking.serviceName}
        </p>
        <p className="text-[12px] text-ink-soft">
          {statusLabel(booking.status, dict)}
          {booking.status === "completed" && ` · ${booking.paymentStatus === "paid" ? dict.paidLabel : dict.unpaidLabel}`}
        </p>
      </div>
      {isCurrent && (
        <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
          {dict.currentAppointmentBadge}
        </span>
      )}
    </div>
  );
}

// ── Notas ────────────────────────────────────────────────────────────────

function LiveNotasTab({
  clientId,
  notes,
  loading,
  dict,
  onChanged,
}: {
  clientId: string;
  notes: NonNullable<ClientPanelData>["notes"];
  loading: boolean;
  dict: CalendarDictionary["clientTabs"];
  onChanged: (notes: NonNullable<ClientPanelData>["notes"]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />)}
      </div>
    );
  }

  async function handleAdd() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addClientNote({ clientId, body });
      setBusy(false);
      if (!res.ok) { setError(res.error); return; }
      onChanged([{ id: res.noteId, body, authorName: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...notes]);
      setDraft("");
      setAdding(false);
    } catch (e) {
      setBusy(false);
      reportClientError("addClientNote", e);
    }
  }

  async function handleUpdate(noteId: string) {
    const body = editBody.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const res = await updateClientNote({ noteId, clientId, body });
      setBusy(false);
      if (!res.ok) { setError(res.error); return; }
      onChanged(notes.map((n) => (n.id === noteId ? { ...n, body, updatedAt: new Date().toISOString() } : n)));
      setEditingId(null);
    } catch (e) {
      setBusy(false);
      reportClientError("updateClientNote", e);
    }
  }

  async function handleDelete(noteId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteClientNote({ noteId, clientId });
      setBusy(false);
      if (!res.ok) { setError(res.error); return; }
      onChanged(notes.filter((n) => n.id !== noteId));
    } catch (e) {
      setBusy(false);
      reportClientError("deleteClientNote", e);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-[12.5px] text-error">{error}</p>}
      {adding ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={dict.notesPlaceholder}
            rows={3}
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
          />
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setDraft(""); }} disabled={busy}>{dict.cancelEditButton}</Btn>
            <Btn size="sm" onClick={handleAdd} disabled={busy || !draft.trim()}>{busy ? dict.savingNote : dict.saveNoteButton}</Btn>
          </div>
        </div>
      ) : (
        <Btn variant="outline" size="sm" onClick={() => setAdding(true)} className="self-start">{dict.addNoteButton}</Btn>
      )}

      {notes.length === 0 ? (
        <p className="text-[13px] text-ink-soft">{dict.notesEmpty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-line bg-surface px-3 py-2.5">
              {editingId === n.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
                  />
                  <div className="flex justify-end gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={busy}>{dict.cancelEditButton}</Btn>
                    <Btn size="sm" onClick={() => handleUpdate(n.id)} disabled={busy || !editBody.trim()}>{busy ? dict.savingNote : dict.saveNoteButton}</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-[13.5px] text-ink">{n.body}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <p className="text-[11.5px] text-ink-soft">
                      {new Date(n.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      {n.authorName ? ` · ${n.authorName}` : ""}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditingId(n.id); setEditBody(n.body); }} className="text-[11.5px] font-semibold text-brand hover:underline">
                        {dict.editNoteButton}
                      </button>
                      <button type="button" onClick={() => handleDelete(n.id)} className="text-[11.5px] font-semibold text-error hover:underline">
                        {dict.deleteNoteButton}
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

function StagedNotasTab({
  staged,
  onStagedChange,
  dict,
}: {
  staged: StagedClientFields;
  onStagedChange: (next: StagedClientFields) => void;
  dict: CalendarDictionary["clientTabs"];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12.5px] text-ink-soft">{dict.newClientNote}</p>
      <textarea
        value={staged.note}
        onChange={(e) => onStagedChange({ ...staged, note: e.target.value })}
        placeholder={dict.newClientNotePlaceholder}
        rows={4}
        className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink"
      />
    </div>
  );
}
