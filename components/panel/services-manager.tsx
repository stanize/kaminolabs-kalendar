"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  createService,
  createServices,
  updateService,
  deleteService,
  reorderServices,
} from "@/lib/actions/services";
import {
  DURATION_PRESETS,
  DURATION_MIN_MINUTES,
  DURATION_MAX_MINUTES,
  PRICE_MIN,
  PRICE_MAX,
  PRICE_SLIDER_MAX,
  PRICE_STEP,
  NAME_MAX_LENGTH,
} from "@/lib/services/constants";
import type { ServicesDictionary } from "@/lib/i18n/dictionaries/services";

interface ServiceItem {
  id: string;
  name: string;
  duration_min: number;
  price: number;
}

interface TemplateItem {
  name: string;
  duration_min: number;
  price: number;
}

interface DraftService {
  name: string;
  duration_min: number;
  price: number;
  // UI-only: whether the user chose "Otra" (free custom duration). Not persisted;
  // stripped before sending to the server. Derived initial value from whether the
  // duration matches a preset, but explicit so "Otra" can hold a preset value too.
  durationCustom: boolean;
}

const EMPTY_DRAFT: DraftService = {
  name: "",
  duration_min: 60,
  price: 40,
  durationCustom: false,
};

/** Strips UI-only fields before sending a draft to a server action. */
function toServiceInput(d: DraftService): { name: string; duration_min: number; price: number } {
  return { name: d.name, duration_min: d.duration_min, price: d.price };
}

function isPreset(min: number): boolean {
  return (DURATION_PRESETS as readonly number[]).includes(min);
}

/** Builds a draft from a template tuple, marking custom when not a preset. */
function draftFromTemplate(t: { name: string; duration_min: number; price: number }): DraftService {
  return { ...t, durationCustom: !isPreset(t.duration_min) };
}

function formatPrice(euros: number, freeLabel: string): string {
  return euros === 0 ? freeLabel : `${euros} €`;
}

function tmpl(s: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);
}

export function ServicesManager({
  initialServices,
  templates,
  returnToHome,
  dict,
}: {
  initialServices: ServiceItem[];
  templates: TemplateItem[];
  returnToHome: boolean;
  dict: ServicesDictionary;
}) {
  const router = useRouter();
  const m = dict.manager;
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Staged template drafts the user is customizing before confirming. null when
  // not in the staging flow.
  const [staged, setStaged] = useState<DraftService[] | null>(null);

  // Full-screen save overlay: grays out the page while a save is in flight,
  // then flashes a success confirmation before redirecting/refreshing.
  const [overlay, setOverlay] = useState<"saving" | "success" | null>(null);
  const SUCCESS_FLASH_MS = 900;

  /** Shows the success flash briefly, then runs the follow-up (redirect/refresh). */
  function flashSuccessThen(after: () => void) {
    setOverlay("success");
    window.setTimeout(after, SUCCESS_FLASH_MS);
  }

  const hadNoServices = initialServices.length === 0;

  function redirectAfterFirstAdd() {
    if (returnToHome && hadNoServices) {
      router.push("/panel");
      return true;
    }
    router.refresh();
    return false;
  }

  // ── Create one (manual) ─────────────────────────────────────────────────────
  async function handleCreate(draft: DraftService) {
    setError(null);
    setBusy(true);
    setOverlay("saving");
    try {
      const result = await createService(toServiceInput(draft), {
        action: dict.errors,
        validation: dict.validation,
      });
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
        redirectAfterFirstAdd();
      });
    } catch {
      setError(m.errUnexpected);
      setBusy(false);
      setOverlay(null);
    }
  }

  // ── Confirm staged template drafts (bulk, with edits) ───────────────────────
  async function handleConfirmStaged() {
    if (!staged || staged.length === 0) return;
    setError(null);
    setBusy(true);
    setOverlay("saving");
    try {
      const result = await createServices(staged.map(toServiceInput), {
        action: dict.errors,
        validation: dict.validation,
      });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        setOverlay(null);
        return;
      }
      flashSuccessThen(() => {
        setStaged(null);
        setBusy(false);
        setOverlay(null);
        redirectAfterFirstAdd();
      });
    } catch {
      setError(m.errUnexpected);
      setBusy(false);
      setOverlay(null);
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async function handleUpdate(id: string, draft: DraftService) {
    setError(null);
    setBusy(true);
    setOverlay("saving");
    try {
      const result = await updateService(
        { id, ...toServiceInput(draft) },
        { action: dict.errors, validation: dict.validation }
      );
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

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setError(null);
    setBusy(true);
    const prev = services;
    setServices((s) => s.filter((x) => x.id !== id));
    try {
      const result = await deleteService(id, dict.errors);
      if (!result.ok) {
        setServices(prev);
        setError(result.error);
      }
    } catch {
      setServices(prev);
      setError(m.errDeleteFailed);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  // ── Drag reorder ────────────────────────────────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...services];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setServices(next);
    setDragIndex(null);
    void reorderServices(next.map((s) => s.id), dict.errors).then(() => router.refresh());
  }

  // While staging template drafts, that flow owns the screen.
  const inStaging = staged !== null;
  const showTemplates =
    templates.length > 0 && services.length === 0 && !adding && !inStaging;

  return (
    <div className="flex flex-col gap-5">
      {/* Full-screen save overlay: blocks interaction while saving, then
          flashes the success confirmation before the redirect/refresh runs. */}
      {overlay && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/30 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-5 shadow-lg">
            {overlay === "saving" ? (
              <>
                <span
                  className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand"
                  aria-hidden
                />
                <span className="text-[14px] font-semibold text-ink">{m.saving}</span>
              </>
            ) : (
              <>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Icon name="check" size={14} strokeWidth={3} />
                </span>
                <span className="text-[14px] font-semibold text-ink">{m.flashSuccess}</span>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Existing services */}
      {services.length > 0 && (
        <div className="flex flex-col gap-2">
          {services.map((svc, index) =>
            editingId === svc.id ? (
              <ServiceEditor
                key={svc.id}
                initial={{
                  name: svc.name,
                  duration_min: svc.duration_min,
                  price: svc.price,
                  durationCustom: !isPreset(svc.duration_min),
                }}
                busy={busy}
                m={m}
                onCancel={() => setEditingId(null)}
                onSave={(draft) => handleUpdate(svc.id, draft)}
              />
            ) : (
              <div
                key={svc.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                className={`flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors ${
                  dragIndex === index ? "opacity-50" : ""
                }`}
              >
                <span className="cursor-grab text-ink-soft active:cursor-grabbing" aria-hidden>
                  <Icon name="list" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ink">{svc.name}</p>
                  <p className="truncate text-[12.5px] text-ink-soft">
                    {svc.duration_min} {m.durationUnit} · {formatPrice(svc.price, m.priceFree)}
                  </p>
                </div>
                <button
                  onClick={() => setEditingId(svc.id)}
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink"
                >
                  {m.edit}
                </button>
                <button
                  onClick={() => handleDelete(svc.id)}
                  disabled={busy}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error disabled:opacity-50"
                  aria-label={m.delete}
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Add new service editor (manual) */}
      {adding && !inStaging && (
        <ServiceEditor
          initial={EMPTY_DRAFT}
          busy={busy}
          m={m}
          onCancel={() => setAdding(false)}
          onSave={handleCreate}
        />
      )}

      {/* Add button — hidden while staging templates */}
      {!adding && !inStaging && (
        <div>
          <Btn variant="outline" onClick={() => { setError(null); setAdding(true); }}>
            <Icon name="plus" size={15} /> {m.addService}
          </Btn>
        </div>
      )}

      {/* Divider: separates "create your own" from "use a sample" — only when
          both paths are on screen (add button above, template picker below). */}
      {showTemplates && (
        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <span className="text-[13px] font-medium text-ink-soft">{m.orDivider}</span>
          <span className="h-px flex-1 bg-line" />
        </div>
      )}

      {/* Template picker (only when no services yet) */}
      {showTemplates && (
        <TemplatePicker
          templates={templates}
          busy={busy}
          m={m}
          onStage={(drafts) => { setError(null); setStaged(drafts); }}
        />
      )}

      {/* Staged template drafts: customize, then confirm together */}
      {inStaging && staged && (
        <div className="flex flex-col gap-4">
          {/* No heading here: the user already chose "Personalizar {n}" — repeating
              the template-picker title/subtitle at this stage is redundant. */}
          <div className="flex flex-col gap-3">
            {staged.map((draft, i) => (
              <StagedDraftCard
                key={i}
                draft={draft}
                m={m}
                onChange={(next) =>
                  setStaged((cur) => cur!.map((d, idx) => (idx === i ? next : d)))
                }
                onRemove={() =>
                  setStaged((cur) => {
                    const next = cur!.filter((_, idx) => idx !== i);
                    return next.length === 0 ? null : next;
                  })
                }
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Btn onClick={handleConfirmStaged} disabled={busy || staged.length === 0}>
              {busy ? m.adding : tmpl(m.confirmCount, { n: staged.length })}
            </Btn>
            <Btn variant="ghost" onClick={() => setStaged(null)} disabled={busy}>
              {m.cancel}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline editor (manual create + edit existing) ─────────────────────────────
function ServiceEditor({
  initial,
  busy,
  m,
  onSave,
  onCancel,
}: {
  initial: DraftService;
  busy: boolean;
  m: ServicesDictionary["manager"];
  onSave: (draft: DraftService) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DraftService>(initial);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-brand-line bg-brand-weak/40 p-4">
      <ServiceFields draft={draft} onChange={setDraft} m={m} />
      <div className="flex items-center gap-2">
        <Btn onClick={() => onSave(draft)} disabled={busy}>
          {busy ? m.saving : m.save}
        </Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>
          {m.cancel}
        </Btn>
      </div>
    </div>
  );
}

// ── Staged draft card (template being customized) ─────────────────────────────
function StagedDraftCard({
  draft,
  m,
  onChange,
  onRemove,
}: {
  draft: DraftService;
  m: ServicesDictionary["manager"];
  onChange: (next: DraftService) => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative rounded-xl border border-line bg-surface p-4">
      <button
        onClick={onRemove}
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error"
        aria-label={m.delete}
      >
        <Icon name="x" size={15} />
      </button>
      <ServiceFields draft={draft} onChange={onChange} m={m} />
    </div>
  );
}

// ── Shared field set: name + duration + price ─────────────────────────────────
function ServiceFields({
  draft,
  onChange,
  m,
}: {
  draft: DraftService;
  onChange: (next: DraftService) => void;
  m: ServicesDictionary["manager"];
}) {
  const customDuration = draft.durationCustom;

  const inputBase =
    "rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]";

  function setPrice(value: number) {
    const v = Math.round(value);
    onChange({
      ...draft,
      price: Number.isFinite(v) ? Math.max(PRICE_MIN, Math.min(PRICE_MAX, v)) : 0,
    });
  }

  const stepBtn =
    "grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:border-brand-line hover:text-ink disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft";

  return (
    <>
      {/* Name */}
      <label className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">{m.nameLabel}</span>
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          placeholder={m.namePlaceholder}
          maxLength={NAME_MAX_LENGTH}
          className={inputBase}
        />
      </label>

      {/* Duration */}
      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">{m.durationLabel}</span>
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ ...draft, duration_min: d, durationCustom: false })}
              className={`rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all ${
                !customDuration && draft.duration_min === d
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
              }`}
            >
              {d} {m.durationUnit}
            </button>
          ))}
          <button
            type="button"
            // "Otra": switch to free custom entry, keeping the current value as a
            // starting point. The explicit flag lets custom hold a preset value too.
            onClick={() => onChange({ ...draft, durationCustom: true })}
            className={`rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all ${
              customDuration
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
            }`}
          >
            {m.durationOther}
          </button>
          {customDuration && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={DURATION_MIN_MINUTES}
                max={DURATION_MAX_MINUTES}
                value={draft.duration_min}
                onChange={(e) => onChange({ ...draft, duration_min: Number(e.target.value) })}
                className={`${inputBase} w-24 !py-2`}
              />
              <span className="text-[13px] text-ink-soft">{m.durationUnit}</span>
            </div>
          )}
        </div>
      </div>

      {/* Price: stepper − slider + synced box */}
      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">{m.priceLabel}</span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPrice(draft.price - PRICE_STEP)}
            disabled={draft.price <= PRICE_MIN}
            className={stepBtn}
            aria-label={tmpl(m.priceLower, { step: PRICE_STEP })}
          >
            <Icon name="minus" size={15} />
          </button>
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_SLIDER_MAX}
            step={1}
            // Slider clamps to its max when the real price exceeds the common
            // range; the number box remains the source of truth.
            value={Math.min(draft.price, PRICE_SLIDER_MAX)}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="h-1.5 min-w-[90px] flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-brand"
          />
          <button
            type="button"
            onClick={() => setPrice(draft.price + PRICE_STEP)}
            disabled={draft.price >= PRICE_MAX}
            className={stepBtn}
            aria-label={tmpl(m.priceRaise, { step: PRICE_STEP })}
          >
            <Icon name="plus" size={15} />
          </button>
          <div className="flex w-full items-center gap-1.5 sm:w-auto">
            <input
              type="number"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={1}
              value={draft.price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className={`${inputBase} w-full sm:w-24 !py-2`}
            />
            <span className="text-[14px] font-medium text-ink-soft">€</span>
          </div>
        </div>
        <p className="text-[12px] text-ink-soft">{formatPrice(draft.price, m.priceFree)}</p>
      </div>
    </>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({
  templates,
  busy,
  m,
  onStage,
}: {
  templates: TemplateItem[];
  busy: boolean;
  m: ServicesDictionary["manager"];
  onStage: (drafts: DraftService[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function stageSelected() {
    const drafts = [...selected]
      .sort((a, b) => a - b)
      .map((i) => draftFromTemplate(templates[i]));
    if (drafts.length > 0) onStage(drafts);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-1 text-[14px] font-semibold text-ink">{m.templatesTitle}</p>
      <p className="mb-4 text-[13px] text-ink-soft">{m.templatesSubtitle}</p>
      <div className="flex flex-col gap-2">
        {templates.map((t, i) => {
          const checked = selected.has(i);
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                checked
                  ? "border-brand bg-brand-weak"
                  : "border-line bg-surface hover:border-brand-line"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${
                  checked ? "border-brand bg-brand text-white" : "border-line"
                }`}
              >
                {checked && <Icon name="check" size={12} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-ink">{t.name}</span>
                <span className="block truncate text-[12.5px] text-ink-soft">
                  {t.duration_min} {m.durationUnit} · {formatPrice(t.price, m.priceFree)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <Btn onClick={stageSelected} disabled={busy || selected.size === 0}>
          <Icon name="plus" size={15} />
          {selected.size > 0 ? tmpl(m.customizeCount, { n: selected.size }) : m.addSelected}
        </Btn>
      </div>
    </div>
  );
}
