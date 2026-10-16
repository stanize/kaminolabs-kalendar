"use client";

import { useState } from "react";
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
  const { overlay, setOverlay, flashSuccessThen } = useSaveOverlay();

  // ── Local roster edits ──────────────────────────────────────────────────────
  function updateRow(
    key: string,
    patch: Partial<Pick<Row, "name" | "role" | "professionalDni" | "professionalCollegeNumber">>
  ) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      {
        key: crypto.randomUUID(),
        id: null,
        name: "",
        role: "",
        isOwner: false,
        professionalDni: "",
        professionalCollegeNumber: "",
      },
    ]);
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

  const inputBase =
    "w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)] placeholder:text-ink-soft/60";

  return (
    <div className="flex flex-col gap-6">
      <SaveOverlay state={overlay} savingLabel={m.saving} successLabel={m.flashSuccess} />

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

      {/* Members — each a card with labeled fields (name/role up top,
          invoicing fields below) */}
      <div className="flex flex-col gap-3">
        {rows.map((r, index) => {
          return (
            <div
              key={r.key}
              draggable={canDrag}
              onDragStart={() => canDrag && setDragIndex(index)}
              onDragOver={(e) => canDrag && e.preventDefault()}
              onDrop={() => canDrag && handleDrop(index)}
              className={`rounded-xl border border-line bg-surface p-4 transition-colors ${
                dragIndex === index ? "opacity-50" : ""
              }`}
            >
              <div className="mb-3 flex items-start justify-between gap-2 border-b border-line pb-3">
                <div className="flex items-start gap-2">
                  {canDrag && (
                    <span className="mt-0.5 cursor-grab text-ink-soft active:cursor-grabbing" aria-hidden>
                      <Icon name="list" size={16} />
                    </span>
                  )}
                  <div>
                    <h3 className="text-[14px] font-semibold text-ink">{m.professionalDataTitle}</h3>
                    <p className="text-[12px] text-ink-soft">{m.professionalDataSubtitle}</p>
                  </div>
                </div>
                {r.isOwner ? (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                    {m.you}
                  </span>
                ) : (
                  <button
                    onClick={() => removeRow(r.key)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
                    aria-label={m.delete}
                  >
                    <Icon name="x" size={15} />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <LabeledField
                  label={m.nameLabel}
                  value={r.name}
                  onChange={(v) => updateRow(r.key, { name: v })}
                  placeholder={m.namePlaceholder}
                  maxLength={80}
                  inputClassName={inputBase}
                />
                <LabeledField
                  label={m.roleLabel}
                  value={r.role}
                  onChange={(v) => updateRow(r.key, { role: v })}
                  placeholder={m.rolePlaceholder}
                  maxLength={60}
                  inputClassName={inputBase}
                />
                <LabeledField
                  label={m.dniLabel}
                  value={r.professionalDni}
                  onChange={(v) => updateRow(r.key, { professionalDni: v })}
                  placeholder={m.dniPlaceholder}
                  inputClassName={inputBase}
                />
                <LabeledField
                  label={m.collegeNumberLabel}
                  value={r.professionalCollegeNumber}
                  onChange={(v) => updateRow(r.key, { professionalCollegeNumber: v })}
                  placeholder={m.collegeNumberPlaceholder}
                  inputClassName={inputBase}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add member (team mode only — appends a local row) */}
      {isTeam && (
        <div>
          <Btn variant="outline" onClick={addRow}>
            <Icon name="plus" size={15} /> {m.addMember}
          </Btn>
        </div>
      )}

      {/* Single commit — saves the whole roster; in the setup flow it also
          returns to Inicio after saving. */}
      <div className="pt-2">
        <Btn onClick={handleSave} disabled={saving} size="lg">
          {saving ? m.saving : m.saveTeam}
        </Btn>
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
