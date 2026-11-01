"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { SaveOverlay, useSaveOverlay } from "@/components/panel/save-overlay";
import { saveTeam } from "@/lib/actions/team";
import { reportClientError } from "@/lib/report-client-error";
import type { TeamDictionary } from "@/lib/i18n/dictionaries/team";

type TeamMode = "solo" | "team";

interface MemberItem {
  id: string;
  name: string;
  role: string;
  is_owner: boolean;
  professional_dni: string | null;
  professional_college_number: string | null;
}

/** One locally edited roster row. id === null → new member, not yet saved. */
interface Row {
  key: string; // stable React key (real id for saved rows, random for new)
  id: string | null;
  name: string;
  role: string;
  isOwner: boolean;
  professionalDni: string;
  professionalCollegeNumber: string;
}

function toRows(members: MemberItem[]): Row[] {
  return members.map((m) => ({
    key: m.id,
    id: m.id,
    name: m.name,
    role: m.role,
    isOwner: m.is_owner,
    professionalDni: m.professional_dni ?? "",
    professionalCollegeNumber: m.professional_college_number ?? "",
  }));
}

/**
 * Equipo manager — fully local editing, single commit.
 *
 * All roster edits (mode switch, rename, role, add, delete, drag-reorder)
 * happen in local state only. One button at the bottom saves the whole roster
 * atomically via saveTeam (mirrors Disponibilidad's whole-week save) and, in
 * the setup flow (?from=home), continues back to Inicio.
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
  const [rows, setRows] = useState<Row[]>(toRows(initialMembers));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [panelKey, setPanelKey] = useState<string | "new" | null>(null);
  const { overlay, setOverlay, flashSuccessThen } = useSaveOverlay();

  // ── Local roster edits (side-panel-pattern: a member's fields are edited
  // in the MemberPanel below, which only touches local `rows` state — the
  // whole roster still commits atomically via the bottom "Guardar cambios"
  // button, same as before) ───────────────────────────────────────────────
  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  function handleMode(next: TeamMode) {
    if (next === mode) return;
    setError(null);
    // Same rule the server enforces: solo = just the owner. Surface it
    // immediately instead of at save time.
    if (next === "solo" && rows.some((r) => !r.isOwner)) {
      setError(dict.errors.errCannotGoSolo);
      return;
    }
    setMode(next);
  }

  // ── Drag reorder (team mode; local only, persisted on save) ────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setRows(next);
    setDragIndex(null);
  }

  // ── Single commit ───────────────────────────────────────────────────────────
  async function handleSave() {
    setError(null);

    // Client-side validation for immediate feedback (server re-validates).
    for (const r of rows) {
      if (r.name.trim().length < 2) {
        setError(dict.errors.errNameRequired);
        return;
      }
    }

    setSaving(true);
    setOverlay("saving");
    try {
      const result = await saveTeam(
        {
          mode,
          members: rows.map((r) => ({
            id: r.id,
            name: r.name.trim(),
            role: r.role.trim(),
            professionalDni: r.professionalDni.trim(),
            professionalCollegeNumber: r.professionalCollegeNumber.trim(),
          })),
        },
        dict.errors
      );
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        setOverlay(null);
        return;
      }
      flashSuccessThen(() => {
        if (returnToHome) {
          router.push("/panel");
          return; // overlay stays up until navigation unmounts this page
        }
        // Remap local rows to their saved ids so a second save doesn't
        // re-insert new members.
        setRows(
          toRows(
            result.members.map((mem) => ({
              id: mem.id,
              name: mem.name,
              role: mem.role ?? "",
              is_owner: mem.is_owner,
              professional_dni: mem.professional_dni,
              professional_college_number: mem.professional_college_number,
            }))
          )
        );
        setSaving(false);
        setOverlay(null);
        router.refresh();
      });
    } catch (e) {
      reportClientError("saveTeam", e);
      setError(m.errUnexpected);
      setSaving(false);
      setOverlay(null);
    }
  }

  const isTeam = mode === "team";
  const canDrag = isTeam && rows.length > 1;

  const panelRow = panelKey === null ? null : panelKey === "new" ? null : rows.find((r) => r.key === panelKey) ?? null;
  const panelOpen = panelKey !== null;

  return (
    <div className="flex flex-col gap-6">
      <SaveOverlay state={overlay} savingLabel={m.saving} successLabel={m.flashSuccess} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-1 text-[24px]">{dict.page.title}</h1>
          <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
        </div>
        {isTeam && (
          <Btn variant="primary" size="sm" onClick={() => setPanelKey("new")} className="mt-1 shrink-0">
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

      {/* Mode selector (local — committed on save) */}
      <div className="flex flex-col gap-[9px]">
        <span className="text-[13px] font-semibold text-ink">{m.howDoYouWork}</span>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={!isTeam}
            onClick={() => handleMode("solo")}
            icon="user"
            title={m.soloTitle}
            sub={m.soloSub}
          />
          <ModeCard
            active={isTeam}
            onClick={() => handleMode("team")}
            icon="users"
            title={m.teamTitle}
            sub={m.teamSub}
          />
        </div>
      </div>

      {/* Members — compact listing (name + role); Editar opens the side
          panel with the full editable fields (side-panel-pattern, 2026-11-01
          per Arun) instead of inline-editing every field on the page. */}
      <div className="flex flex-col gap-2">
        {rows.map((r, index) => {
          return (
            <div
              key={r.key}
              draggable={canDrag}
              onDragStart={() => canDrag && setDragIndex(index)}
              onDragOver={(e) => canDrag && e.preventDefault()}
              onDrop={() => canDrag && handleDrop(index)}
              className={`flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 transition-colors ${
                dragIndex === index ? "opacity-50" : ""
              }`}
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
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => setPanelKey(r.key)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-brand-weak hover:text-brand"
                  aria-label={m.edit}
                >
                  <Icon name="pencil" size={15} />
                </button>
                {!r.isOwner && (
                  <button
                    onClick={() => removeRow(r.key)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                    aria-label={m.delete}
                  >
                    <Icon name="x" size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Single commit — saves the whole roster; in the setup flow it also
          returns to Inicio after saving. */}
      <div className="pt-2">
        <Btn onClick={handleSave} disabled={saving} size="lg">
          {saving ? m.saving : m.saveTeam}
        </Btn>
      </div>

      {panelOpen && (
        <MemberPanel
          row={panelRow}
          dict={dict}
          onClose={() => setPanelKey(null)}
          onSaved={(saved) => {
            setPanelKey(null);
            setRows((rs) => {
              const exists = rs.some((r) => r.key === saved.key);
              return exists ? rs.map((r) => (r.key === saved.key ? saved : r)) : [...rs, saved];
            });
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
  const [error, setError] = useState<string | null>(null);

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

  function handleSave() {
    setError(null);
    if (name.trim().length < 2) {
      setError(dict.errors.errNameRequired);
      return;
    }
    requestClose(() =>
      onSaved({
        key: row?.key ?? crypto.randomUUID(),
        id: row?.id ?? null,
        name: name.trim(),
        role: role.trim(),
        isOwner: row?.isOwner ?? false,
        professionalDni: professionalDni.trim(),
        professionalCollegeNumber: professionalCollegeNumber.trim(),
      })
    );
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

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={closePanel}
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            {m.panelCancel}
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-brand px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90"
          >
            {m.panelSave}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 rounded-xl border px-4 py-3.5 text-left transition-all ${
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
