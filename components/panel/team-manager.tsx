"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  setTeamMode,
  createTeamMember,
  updateTeamMember,
  deleteOrDisableTeamMember,
  reactivateTeamMember,
  reorderTeamMembers,
  uploadTeamMemberSignature,
  removeTeamMemberSignature,
} from "@/lib/actions/team";
import { reportClientError } from "@/lib/report-client-error";
import type { TeamDictionary } from "@/lib/i18n/dictionaries/team";
import { SignaturePad } from "@/components/panel/signature-pad";

type TeamMode = "solo" | "team";

interface MemberItem {
  id: string;
  name: string;
  role: string;
  is_owner: boolean;
  professional_dni: string | null;
  professional_college_number: string | null;
  professional_title: string | null;
  signature_url: string | null;
  active: boolean;
}

/** One roster row, always backed by a saved member (id is never null here —
 * add goes through the panel, which inserts server-side before it appears
 * in this list). */
interface Row {
  id: string;
  name: string;
  role: string;
  isOwner: boolean;
  professionalDni: string;
  professionalCollegeNumber: string;
  professionalTitle: string;
  signatureUrl: string | null;
  active: boolean;
}

function toRow(m: MemberItem): Row {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    isOwner: m.is_owner,
    professionalDni: m.professional_dni ?? "",
    professionalCollegeNumber: m.professional_college_number ?? "",
    professionalTitle: m.professional_title ?? "",
    signatureUrl: m.signature_url,
    active: m.active,
  };
}

/**
 * Equipo manager — every action commits immediately (2026-11-01, per Arun:
 * "no changes should happen in this page", replacing the old single
 * "Guardar cambios" batch commit). Mode switch, add/edit (via the side
 * panel), delete-or-disable, reactivate, and drag-reorder each fire their
 * own server action on the spot.
 *
 * team-member-lifecycle: a member with any booking (past or future) can't
 * be hard-deleted — deleteOrDisableTeamMember disables them instead
 * (active=false). Disabled members stay listed, grayed out, with a
 * "Desactivado" badge and a Reactivar action instead of Editar/Eliminar.
 */
export function TeamManager({
  teamMode,
  initialMembers,
  returnToHome,
  dict,
}: {
  teamMode: TeamMode;
  initialMembers: MemberItem[];
  returnToHome: boolean;
  dict: TeamDictionary;
}) {
  const router = useRouter();
  const m = dict.manager;
  const [mode, setMode] = useState<TeamMode>(teamMode);
  const [rows, setRows] = useState<Row[]>(initialMembers.map(toRow));
  const [error, setError] = useState<string | null>(null);
  const [modeSaving, setModeSaving] = useState(false);
  const [panelId, setPanelId] = useState<string | "new" | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleMode(next: TeamMode) {
    if (next === mode || modeSaving) return;
    setError(null);
    // Same rule the server enforces: solo = just the owner. Surface it
    // immediately instead of waiting on the round trip.
    if (next === "solo" && rows.some((r) => !r.isOwner)) {
      setError(dict.errors.errCannotGoSolo);
      return;
    }
    setModeSaving(true);
    try {
      const result = await setTeamMode({ mode: next, dict: dict.errors });
      if (!result.ok) {
        setError(result.error);
        setModeSaving(false);
        return;
      }
      setMode(next);
      setModeSaving(false);
      if (returnToHome) router.push("/panel");
      else router.refresh();
    } catch (e) {
      reportClientError("setTeamMode", e);
      setError(m.errUnexpected);
      setModeSaving(false);
    }
  }

  async function handleDeleteOrDisable(id: string) {
    setError(null);
    setRowBusyId(id);
    try {
      const result = await deleteOrDisableTeamMember({ id, dict: dict.errors });
      setConfirmingId(null);
      if (!result.ok) {
        setError(result.error);
        setRowBusyId(null);
        return;
      }
      if (result.outcome === "deleted") {
        setRows((rs) => rs.filter((r) => r.id !== id));
      } else {
        setRows((rs) => rs.map((r) => (r.id === id ? toRow(result.member as MemberItem) : r)));
      }
      setRowBusyId(null);
      router.refresh();
    } catch (e) {
      reportClientError("deleteOrDisableTeamMember", e);
      setError(m.errUnexpected);
      setRowBusyId(null);
      setConfirmingId(null);
    }
  }

  async function handleReactivate(id: string) {
    setError(null);
    setRowBusyId(id);
    try {
      const result = await reactivateTeamMember({ id, dict: dict.errors });
      if (!result.ok) {
        setError(result.error);
        setRowBusyId(null);
        return;
      }
      setRows((rs) => rs.map((r) => (r.id === id ? toRow(result.member as MemberItem) : r)));
      setRowBusyId(null);
      router.refresh();
    } catch (e) {
      reportClientError("reactivateTeamMember", e);
      setError(m.errUnexpected);
      setRowBusyId(null);
    }
  }

  // ── Drag reorder — commits immediately on drop ──────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  async function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setRows(next);
    setDragIndex(null);

    setError(null);
    setReordering(true);
    try {
      const result = await reorderTeamMembers({ orderedIds: next.map((r) => r.id), dict: dict.errors });
      if (!result.ok) setError(result.error);
      setReordering(false);
    } catch (e) {
      reportClientError("reorderTeamMembers", e);
      setError(m.errUnexpected);
      setReordering(false);
    }
  }

  const isTeam = mode === "team";
  const canDrag = isTeam && rows.length > 1 && !reordering;

  const panelRow = panelId === null || panelId === "new" ? null : rows.find((r) => r.id === panelId) ?? null;
  const panelOpen = panelId !== null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
          <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
        </div>
        {isTeam && (
          <Btn variant="primary" size="sm" onClick={() => setPanelId("new")} className="mt-1 shrink-0">
            <Icon name="plus" size={15} /> {m.addMember}
          </Btn>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode selector — commits immediately */}
      <div className="flex flex-col gap-[9px]">
        <span className="text-[13px] font-semibold text-ink">{m.howDoYouWork}</span>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={!isTeam}
            disabled={modeSaving}
            onClick={() => handleMode("solo")}
            icon="user"
            title={m.soloTitle}
            sub={m.soloSub}
          />
          <ModeCard
            active={isTeam}
            disabled={modeSaving}
            onClick={() => handleMode("team")}
            icon="users"
            title={m.teamTitle}
            sub={m.teamSub}
          />
        </div>
      </div>

      {/* Members — compact listing (name + role); Editar opens the side
          panel with the full editable fields (side-panel-pattern). A member
          with bookings can't be hard-deleted — Eliminar disables them
          instead (grayed row, "Desactivado" badge, Reactivar action). */}
      <div className="flex flex-col gap-2">
        {rows.map((r, index) => {
          const busy = rowBusyId === r.id;
          return (
            <div
              key={r.id}
              draggable={canDrag}
              onDragStart={() => canDrag && setDragIndex(index)}
              onDragOver={(e) => canDrag && e.preventDefault()}
              onDrop={() => canDrag && handleDrop(index)}
              className={`flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 transition-colors ${
                dragIndex === index ? "opacity-50" : ""
              } ${!r.active ? "opacity-60" : ""}`}
            >
              {canDrag && (
                <span className="shrink-0 cursor-grab text-ink-soft active:cursor-grabbing" aria-hidden>
                  <Icon name="list" size={16} />
                </span>
              )}
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-weak text-brand">
                <Icon name="user" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{r.name || m.namePlaceholder}</p>
                <p className="truncate text-[12.5px] text-ink-soft">{r.role || m.noRole}</p>
              </div>
              {r.isOwner && (
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                  {m.you}
                </span>
              )}
              {!r.active && (
                <span className="shrink-0 rounded-full bg-error-weak px-2 py-0.5 text-[11px] font-semibold text-error">
                  {m.disabledBadge}
                </span>
              )}

              {!r.active ? (
                <button
                  onClick={() => handleReactivate(r.id)}
                  disabled={busy}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-brand-weak disabled:opacity-50"
                >
                  {busy ? "…" : m.reactivate}
                </button>
              ) : confirmingId === r.id ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[12px] text-ink-soft">{m.confirmDelete}</span>
                  <button
                    onClick={() => handleDeleteOrDisable(r.id)}
                    disabled={busy}
                    className="rounded-lg bg-error px-2.5 py-1 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "…" : m.confirmDeleteYes}
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-ink-soft hover:bg-surface-2"
                  >
                    {m.confirmDeleteNo}
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setPanelId(r.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-brand-weak hover:text-brand"
                    aria-label={m.edit}
                  >
                    <Icon name="pencil" size={15} />
                  </button>
                  {!r.isOwner && (
                    <button
                      onClick={() => setConfirmingId(r.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                      aria-label={m.delete}
                    >
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {panelOpen && (
        <MemberPanel
          row={panelRow}
          dict={dict}
          onClose={() => setPanelId(null)}
          onSaved={(saved) => {
            setPanelId(null);
            setRows((rs) => {
              const exists = rs.some((r) => r.id === saved.id);
              return exists ? rs.map((r) => (r.id === saved.id ? saved : r)) : [...rs, saved];
            });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function MemberPanel({
  row,
  dict,
  onClose,
  onSaved,
}: {
  row: Row | null;
  dict: TeamDictionary;
  onClose: () => void;
  onSaved: (row: Row) => void;
}) {
  const m = dict.manager;
  const [name, setName] = useState(row?.name ?? "");
  const [role, setRole] = useState(row?.role ?? "");
  const [professionalDni, setProfessionalDni] = useState(row?.professionalDni ?? "");
  const [professionalCollegeNumber, setProfessionalCollegeNumber] = useState(row?.professionalCollegeNumber ?? "");
  const [professionalTitle, setProfessionalTitle] = useState(row?.professionalTitle ?? "");
  const [signatureUrl, setSignatureUrl] = useState(row?.signatureUrl ?? null);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [drawingSignature, setDrawingSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signatureFileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        role: role.trim(),
        professionalDni: professionalDni.trim(),
        professionalCollegeNumber: professionalCollegeNumber.trim(),
        professionalTitle: professionalTitle.trim(),
        dict: dict.errors,
      };
      const result = row
        ? await updateTeamMember({ id: row.id, ...payload })
        : await createTeamMember(payload);
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setSaving(false);
      requestClose(() =>
        onSaved({
          id: result.member.id,
          name: result.member.name,
          role: result.member.role ?? "",
          isOwner: result.member.is_owner,
          professionalDni: result.member.professional_dni ?? "",
          professionalCollegeNumber: result.member.professional_college_number ?? "",
          professionalTitle: result.member.professional_title ?? "",
          signatureUrl,
          active: result.member.active,
        })
      );
    } catch (e) {
      reportClientError(row ? "updateTeamMember" : "createTeamMember", e);
      setError(dict.manager.errUnexpected);
      setSaving(false);
    }
  }

  // Shared by both signature sources (file upload + drawn pad). Only
  // callable once the member is saved (needs an id) — see the panel's
  // signature section below, shown only when editing an existing member.
  async function uploadSignatureFile(file: File) {
    if (!row) return;
    setError(null);
    setSignatureUploading(true);
    const formData = new FormData();
    formData.set("memberId", row.id);
    formData.set("signature", file);
    try {
      const result = await uploadTeamMemberSignature(formData, {
        errNoBusiness: dict.errors.errNoBusiness,
        errInvalidFile: dict.errors.errInvalidFile,
        errSaveFailed: dict.errors.errSaveFailed,
      });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSignatureUrl(result.signatureUrl);
        setDrawingSignature(false);
      }
    } catch (e) {
      reportClientError("uploadTeamMemberSignature", e);
      setError(dict.manager.errUnexpected);
    } finally {
      setSignatureUploading(false);
    }
  }

  async function handleSignatureFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(dict.errors.errInvalidFile);
      return;
    }
    await uploadSignatureFile(file);
  }

  async function handleRemoveSignature() {
    if (!row) return;
    setError(null);
    setSignatureUploading(true);
    try {
      const result = await removeTeamMemberSignature({ id: row.id, dict: { errNoBusiness: dict.errors.errNoBusiness, errSaveFailed: dict.errors.errSaveFailed } });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSignatureUrl(null);
      }
    } catch (e) {
      reportClientError("removeTeamMemberSignature", e);
      setError(dict.manager.errUnexpected);
    } finally {
      setSignatureUploading(false);
    }
  }

  const inputBase =
    "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)] placeholder:text-ink-soft/60";

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">{row ? m.panelTitleEdit : m.panelTitleNew}</h2>
          <button
            onClick={closePanel}
            aria-label={m.panelClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-surface-2"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[12.5px] text-error">{error}</div>
        )}

        <div className="mb-4 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
          <p className="text-[12.5px] font-medium text-ink">{m.professionalDataTitle}</p>
          <p className="text-[11.5px] text-ink-soft">{m.professionalDataSubtitle}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledField
            label={m.nameLabel}
            value={name}
            onChange={setName}
            placeholder={m.namePlaceholder}
            maxLength={80}
            inputClassName={inputBase}
          />
          <LabeledField
            label={m.roleLabel}
            value={role}
            onChange={setRole}
            placeholder={m.rolePlaceholder}
            maxLength={60}
            inputClassName={inputBase}
          />
          <LabeledField
            label={m.titleLabel}
            value={professionalTitle}
            onChange={setProfessionalTitle}
            placeholder={m.titlePlaceholder}
            inputClassName={inputBase}
          />
          <LabeledField
            label={m.dniLabel}
            value={professionalDni}
            onChange={setProfessionalDni}
            placeholder={m.dniPlaceholder}
            inputClassName={inputBase}
          />
          <LabeledField
            label={m.collegeNumberLabel}
            value={professionalCollegeNumber}
            onChange={setProfessionalCollegeNumber}
            placeholder={m.collegeNumberPlaceholder}
            inputClassName={inputBase}
          />
        </div>

        {row && (
          <div className="mt-5 rounded-lg border border-line bg-surface-2/50 p-3.5">
            <p className="text-[12.5px] font-medium text-ink">{m.signatureSectionTitle}</p>
            <p className="text-[11.5px] text-ink-soft">{m.signatureSectionSubtitle}</p>

            {drawingSignature ? (
              <div className="mt-3">
                <SignaturePad
                  onSave={uploadSignatureFile}
                  onCancel={() => setDrawingSignature(false)}
                  saving={signatureUploading}
                  dict={{
                    hint: m.signatureDrawHint,
                    clear: m.signatureDrawClear,
                    save: signatureUploading ? m.signatureUploading : m.signatureDrawSave,
                    cancel: m.signatureDrawCancel,
                    errEmpty: m.errSignatureEmpty,
                  }}
                />
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="flex h-14 min-w-[120px] max-w-[200px] items-center justify-center rounded-xl border border-line bg-surface px-3">
                  {signatureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local/optimizable asset
                    <img src={signatureUrl} alt="Firma" className="max-h-10 max-w-full object-contain" />
                  ) : (
                    <Icon name="fileText" size={20} className="text-ink-soft" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Btn variant="outline" size="sm" type="button" onClick={() => signatureFileInputRef.current?.click()} disabled={signatureUploading}>
                    {signatureUploading ? m.signatureUploading : signatureUrl ? m.signatureChange : m.signatureUpload}
                  </Btn>
                  <Btn variant="outline" size="sm" type="button" onClick={() => setDrawingSignature(true)} disabled={signatureUploading}>
                    {m.signatureDrawButton}
                  </Btn>
                  {signatureUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveSignature}
                      disabled={signatureUploading}
                      className="text-[12.5px] font-medium text-ink-soft hover:text-error disabled:opacity-50"
                    >
                      {m.signatureRemove}
                    </button>
                  )}
                </div>
                <input
                  ref={signatureFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleSignatureFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={closePanel}
            disabled={saving}
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            {m.panelCancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "…" : m.panelSave}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  disabled,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3.5 text-left transition-all disabled:opacity-60 ${
        active
          ? "border-brand bg-brand-weak shadow-[0_0_0_3px_var(--color-brand-weak)]"
          : "border-line bg-surface hover:border-brand-line"
      }`}
    >
      <Icon name={icon} size={20} className={active ? "text-brand" : "text-ink-soft"} />
      <span className={`text-[14px] font-semibold ${active ? "text-brand-ink" : "text-ink"}`}>
        {title}
      </span>
      <span className="text-[12px] text-ink-soft">{sub}</span>
    </button>
  );
}

function LabeledField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  inputClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
  inputClassName: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[.03em] text-ink-soft">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={inputClassName}
      />
    </label>
  );
}
