"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { updateDisplayName } from "@/lib/actions/account";

export function EditableGreetingName({
  initialName,
  prefix,
  fallback,
  editHint,
  errRequired,
  errTooLong,
  errSaveFailed,
}: {
  initialName: string;
  prefix: string;
  fallback: string;
  editHint: string;
  errRequired: string;
  errTooLong: string;
  errSaveFailed: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setDraft(name);
    setError(null);
    setEditing(true);
    // Focus after the input mounts.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function cancelEditing() {
    setEditing(false);
    setError(null);
    setDraft(name);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await updateDisplayName(trimmed, {
        errRequired,
        errTooLong,
        errSaveFailed,
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setName(result.name);
      setEditing(false);
      setSaving(false);
      router.refresh();
    } catch {
      setError(errSaveFailed);
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col gap-1">
        <span className="inline-flex items-center gap-2">
          <span className="text-[24px]">{prefix}</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancelEditing();
            }}
            onBlur={save}
            disabled={saving}
            maxLength={40}
            className="w-auto min-w-[80px] max-w-[240px] rounded-lg border border-brand-line bg-surface px-2 py-0.5 text-[24px] text-ink outline-none focus:shadow-[0_0_0_3px_var(--color-brand-weak)]"
          />
        </span>
        {error && <span className="text-[12.5px] font-normal text-error">{error}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title={editHint}
      className="group inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-surface-2"
    >
      <span>{name ? `${prefix}${name}` : fallback}</span>
      <Icon
        name="pencil"
        size={14}
        className="shrink-0 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100"
      />
    </button>
  );
}
