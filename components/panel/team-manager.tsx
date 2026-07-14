"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { SaveOverlay, useSaveOverlay } from "@/components/panel/save-overlay";
import {
  setTeamMode,
  createMember,
  updateMember,
  deleteMember,
  reorderMembers,
} from "@/lib/actions/team";
import type { TeamDictionary } from "@/lib/i18n/dictionaries/team";

type TeamMode = "solo" | "team";

interface MemberItem {
  id: string;
  name: string;
  role: string;
  is_owner: boolean;
}

interface Draft {
  name: string;
  role: string;
}

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
  const [members, setMembers] = useState<MemberItem[]>(initialMembers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Full-screen save overlay (shared setup-page pattern) for create/update
  // saves. Quick inline actions (mode switch, delete, reorder) stay as-is.
  const { overlay, setOverlay, flashSuccessThen } = useSaveOverlay();

  // ── Mode switch ─────────────────────────────────────────────────────────────
  async function handleMode(next: TeamMode) {
    if (next === mode) return;
    setError(null);
    setBusy(true);
    try {
      const result = await setTeamMode(next, dict.errors);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      setMode(next);
      setBusy(false);
      router.refresh();
    } catch {
      setError(m.errUnexpected);
      setBusy(false);
    }
  }

  // ── Create member ───────────────────────────────────────────────────────────
  async function handleCreate(draft: Draft) {
    setError(null);
    setBusy(true);
    setOverlay("saving");
    try {
      const result = await createMember(draft, dict.errors);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        setOverlay(null);
        return;
      }
      flashSuccessThen(() => {
        setAdding(false);
        setBusy(false);
        setOverlay(null);
        router.refresh();
      });
    } catch {
      setError(m.errUnexpected);
      setBusy(false);
      setOverlay(null);
    }
  }

  // ── Update member ───────────────────────────────────────────────────────────
  async function handleUpdate(id: string, draft: Draft) {
    setError(null);
    setBusy(true);
    setOverlay("saving");
    try {
      const result = await updateMember({ id, ...draft }, dict.errors);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        setOverlay(null);
        return;
      }
      flashSuccessThen(() => {
        setEditingId(null);
        setBusy(false);
        setOverlay(null);
        router.refresh();
      });
    } catch {
      setError(m.errUnexpected);
      setBusy(false);
      setOverlay(null);
    }
  }

  // ── Delete member ───────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setError(null);
    setBusy(true);
    const prev = members;
    setMembers((m) => m.filter((x) => x.id !== id));
    try {
      const result = await deleteMember(id, dict.errors);
      if (!result.ok) {
        setMembers(prev);
        setError(result.error);
      }
    } catch {
      setMembers(prev);
      setError(m.errDeleteFailed);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  // ── Drag reorder (team mode; owner stays first) ─────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...members];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setMembers(next);
    setDragIndex(null);
    void reorderMembers(next.map((m) => m.id), dict.errors).then(() => router.refresh());
  }

  const isTeam = mode === "team";
  const canDrag = isTeam && members.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <SaveOverlay state={overlay} savingLabel={m.saving} successLabel={m.flashSuccess} />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode selector */}
      <div className="flex flex-col gap-[9px]">
        <span className="text-[13px] font-semibold text-ink">{m.howDoYouWork}</span>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            active={!isTeam}
            disabled={busy}
            onClick={() => handleMode("solo")}
            icon="user"
            title={m.soloTitle}
            sub={m.soloSub}
          />
          <ModeCard
            active={isTeam}
            disabled={busy}
            onClick={() => handleMode("team")}
            icon="users"
            title={m.teamTitle}
            sub={m.teamSub}
          />
        </div>
      </div>

      {/* Members */}
      <div className="flex flex-col gap-2">
        {members.map((mem, index) =>
          editingId === mem.id ? (
            <MemberEditor
              key={mem.id}
              initial={{ name: mem.name, role: mem.role }}
              busy={busy}
              isOwner={mem.is_owner}
              m={m}
              onCancel={() => setEditingId(null)}
              onSave={(draft) => handleUpdate(mem.id, draft)}
            />
          ) : (
            <div
              key={mem.id}
              draggable={canDrag}
              onDragStart={() => canDrag && setDragIndex(index)}
              onDragOver={(e) => canDrag && e.preventDefault()}
              onDrop={() => canDrag && handleDrop(index)}
              className={`flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors ${
                dragIndex === index ? "opacity-50" : ""
              }`}
            >
              {canDrag && (
                <span className="cursor-grab text-ink-soft active:cursor-grabbing" aria-hidden>
                  <Icon name="list" size={16} />
                </span>
              )}
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-weak text-brand">
                <Icon name="user" size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <span className="truncate">{mem.name}</span>
                  {mem.is_owner && (
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                      {m.you}
                    </span>
                  )}
                </p>
                {mem.role && <p className="truncate text-[12.5px] text-ink-soft">{mem.role}</p>}
              </div>
              <button
                onClick={() => setEditingId(mem.id)}
                className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink"
              >
                {m.edit}
              </button>
              {!mem.is_owner && (
                <button
                  onClick={() => handleDelete(mem.id)}
                  disabled={busy}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error disabled:opacity-50"
                  aria-label={m.delete}
                >
                  <Icon name="x" size={15} />
                </button>
              )}
            </div>
          )
        )}
      </div>

      {/* Add member (team mode only) */}
      {isTeam && adding && (
        <MemberEditor
          initial={{ name: "", role: "" }}
          busy={busy}
          isOwner={false}
          m={m}
          onCancel={() => setAdding(false)}
          onSave={handleCreate}
        />
      )}
      {isTeam && !adding && (
        <div>
          <Btn variant="outline" onClick={() => { setError(null); setAdding(true); }}>
            <Icon name="plus" size={15} /> {m.addMember}
          </Btn>
        </div>
      )}

      {/* Continue (return-intent from home) */}
      {returnToHome && (
        <div className="pt-2">
          <Btn onClick={() => router.push("/panel")} disabled={busy}>
            {m.continueButton}
          </Btn>
        </div>
      )}
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

function MemberEditor({
  initial,
  busy,
  isOwner,
  m,
  onSave,
  onCancel,
}: {
  initial: Draft;
  busy: boolean;
  isOwner: boolean;
  m: TeamDictionary["manager"];
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);

  const inputBase =
    "rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-brand-line bg-brand-weak/40 p-4">
      <label className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">
          {m.nameLabel} {isOwner && <span className="font-normal text-ink-soft">{m.nameYouHint}</span>}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={m.namePlaceholder}
          maxLength={80}
          className={inputBase}
        />
      </label>
      <label className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">
          {m.roleLabel} <span className="font-normal text-ink-soft">{m.roleOptionalHint}</span>
        </span>
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder={m.rolePlaceholder}
          maxLength={60}
          className={inputBase}
        />
      </label>
      <div className="flex items-center gap-2">
        <Btn onClick={() => onSave({ name, role })} disabled={busy}>
          {busy ? m.saving : m.save}
        </Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>
          {m.cancel}
        </Btn>
      </div>
    </div>
  );
}
