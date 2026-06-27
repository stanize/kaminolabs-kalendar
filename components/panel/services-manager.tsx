"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  createService,
  updateService,
  deleteService,
  reorderServices,
  addServicesFromTemplates,
} from "@/lib/actions/services";
import {
  DURATION_PRESETS,
  DURATION_MIN_MINUTES,
  DURATION_MAX_MINUTES,
  PRICE_MIN,
  PRICE_MAX,
  PRICE_SLIDER_MAX,
  NAME_MAX_LENGTH,
} from "@/lib/services/constants";

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
}

const EMPTY_DRAFT: DraftService = { name: "", duration_min: 60, price: 40 };

function formatPrice(euros: number): string {
  return euros === 0 ? "Gratis" : `${euros} €`;
}

export function ServicesManager({
  initialServices,
  templates,
  returnToHome,
}: {
  initialServices: ServiceItem[];
  templates: TemplateItem[];
  returnToHome: boolean;
}) {
  const router = useRouter();
  const [services, setServices] = useState<ServiceItem[]>(initialServices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hadNoServices = initialServices.length === 0;

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate(draft: DraftService) {
    setError(null);
    setBusy(true);
    try {
      const result = await createService(draft);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      setAdding(false);
      setBusy(false);
      // First-service transition from the home flow -> return to Inicio.
      if (returnToHome && hadNoServices) {
        router.push("/panel");
        return;
      }
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  // ── Add selected templates ──────────────────────────────────────────────────
  async function handleAddTemplates(indices: number[]) {
    setError(null);
    setBusy(true);
    try {
      const result = await addServicesFromTemplates(indices);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      setBusy(false);
      if (returnToHome && hadNoServices) {
        router.push("/panel");
        return;
      }
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async function handleUpdate(id: string, draft: DraftService) {
    setError(null);
    setBusy(true);
    try {
      const result = await updateService({ id, ...draft });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      setEditingId(null);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      setBusy(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setError(null);
    setBusy(true);
    // Optimistic removal.
    const prev = services;
    setServices((s) => s.filter((x) => x.id !== id));
    try {
      const result = await deleteService(id);
      if (!result.ok) {
        setServices(prev);
        setError(result.error);
      }
    } catch {
      setServices(prev);
      setError("No se pudo eliminar. Inténtalo de nuevo.");
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
    // Persist immediately.
    void reorderServices(next.map((s) => s.id)).then(() => router.refresh());
  }

  const showTemplates = templates.length > 0 && services.length === 0 && !adding;

  return (
    <div className="flex flex-col gap-5">
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
                initial={{ name: svc.name, duration_min: svc.duration_min, price: svc.price }}
                busy={busy}
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
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-ink">{svc.name}</p>
                  <p className="text-[12.5px] text-ink-soft">
                    {svc.duration_min} min · {formatPrice(svc.price)}
                  </p>
                </div>
                <button
                  onClick={() => setEditingId(svc.id)}
                  className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(svc.id)}
                  disabled={busy}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-error-weak hover:text-error disabled:opacity-50"
                  aria-label="Eliminar"
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
            )
          )}
        </div>
      )}

      {/* Add new service editor */}
      {adding && (
        <ServiceEditor
          initial={EMPTY_DRAFT}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={handleCreate}
        />
      )}

      {/* Add button */}
      {!adding && (
        <div>
          <Btn variant="outline" onClick={() => { setError(null); setAdding(true); }}>
            <Icon name="plus" size={15} /> Añadir servicio
          </Btn>
        </div>
      )}

      {/* Templates picker (only when no services yet) */}
      {showTemplates && (
        <TemplatePicker templates={templates} busy={busy} onAdd={handleAddTemplates} />
      )}
    </div>
  );
}

// ── Inline editor (create + edit) ─────────────────────────────────────────────
function ServiceEditor({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: DraftService;
  busy: boolean;
  onSave: (draft: DraftService) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [duration, setDuration] = useState<number>(initial.duration_min);
  const [customDuration, setCustomDuration] = useState<boolean>(
    !DURATION_PRESETS.includes(initial.duration_min as (typeof DURATION_PRESETS)[number])
  );
  const [price, setPrice] = useState<number>(initial.price);

  const inputBase =
    "rounded-[10px] border border-line bg-surface px-[13px] py-3 text-[15px] text-ink outline-none transition-all focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-weak)]";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-brand-line bg-brand-weak/40 p-4">
      {/* Name */}
      <label className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">Nombre del servicio</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Primera consulta"
          maxLength={NAME_MAX_LENGTH}
          className={inputBase}
        />
      </label>

      {/* Duration */}
      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">Duración</span>
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setCustomDuration(false);
                setDuration(d);
              }}
              className={`rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all ${
                !customDuration && duration === d
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
              }`}
            >
              {d} min
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomDuration(true)}
            className={`rounded-lg border px-3 py-2 text-[13px] font-semibold transition-all ${
              customDuration
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
            }`}
          >
            Otra
          </button>
          {customDuration && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={DURATION_MIN_MINUTES}
                max={DURATION_MAX_MINUTES}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={`${inputBase} w-24 !py-2`}
              />
              <span className="text-[13px] text-ink-soft">min</span>
            </div>
          )}
        </div>
      </div>

      {/* Price: slider + synced box */}
      <div className="flex flex-col gap-[7px]">
        <span className="text-[13px] font-semibold text-ink">Precio</span>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_SLIDER_MAX}
            step={1}
            // Slider clamps to its max when the real price exceeds the common range;
            // the number box remains the source of truth.
            value={Math.min(price, PRICE_SLIDER_MAX)}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-brand"
          />
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={PRICE_MIN}
              max={PRICE_MAX}
              step={1}
              value={price}
              onChange={(e) => {
                const v = Math.round(Number(e.target.value));
                setPrice(Number.isFinite(v) ? Math.max(PRICE_MIN, Math.min(PRICE_MAX, v)) : 0);
              }}
              className={`${inputBase} w-24 !py-2`}
            />
            <span className="text-[14px] font-medium text-ink-soft">€</span>
          </div>
        </div>
        <p className="text-[12px] text-ink-soft">{formatPrice(price)}</p>
      </div>

      <div className="flex items-center gap-2">
        <Btn onClick={() => onSave({ name, duration_min: duration, price })} disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Btn>
      </div>
    </div>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({
  templates,
  busy,
  onAdd,
}: {
  templates: TemplateItem[];
  busy: boolean;
  onAdd: (indices: number[]) => void;
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

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-1 text-[14px] font-semibold text-ink">¿No sabes por dónde empezar?</p>
      <p className="mb-4 text-[13px] text-ink-soft">
        Elige algunos servicios habituales para tu tipo de negocio y añádelos de una vez.
      </p>
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
              <span className="flex-1">
                <span className="block text-[14px] font-semibold text-ink">{t.name}</span>
                <span className="block text-[12.5px] text-ink-soft">
                  {t.duration_min} min · {formatPrice(t.price)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <Btn
          onClick={() => onAdd([...selected])}
          disabled={busy || selected.size === 0}
        >
          <Icon name="plus" size={15} />
          {selected.size > 0 ? `Añadir ${selected.size}` : "Añadir seleccionados"}
        </Btn>
      </div>
    </div>
  );
}
