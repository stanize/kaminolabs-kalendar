"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { BUSINESS_TYPES } from "@/lib/onboarding/data";
import type { BusinessType } from "@/lib/onboarding/types";
import {
  saveBusinessSettings,
  checkSlugAvailability,
  type SlugCheckResult,
} from "@/lib/actions/business";
import {
  sanitizeSlug,
  suggestSlug,
} from "@/lib/business/slug-screen";
import { bookingUrlDisplay } from "@/lib/business/booking-url";
import type { SlugStatus } from "@/lib/business/data";

interface InitialBusiness {
  name: string;
  type: BusinessType;
  city: string;
  slug: string;
  slugStatus: SlugStatus;
}

export function BusinessForm({
  initial,
  returnToHome,
}: {
  initial: InitialBusiness | null;
  returnToHome: boolean;
}) {
  const router = useRouter();
  const isNew = !initial;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<BusinessType | "">(initial?.type ?? "");
  const [city, setCity] = useState(initial?.city ?? "");

  // Slug is only editable at creation. After that it is fixed.
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugCheck, setSlugCheck] = useState<SlugCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Schedule a debounced availability check for a given slug (creation only).
  function scheduleSlugCheck(value: string) {
    if (!isNew) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value) {
      setChecking(false);
      setSlugCheck(null);
      return;
    }

    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkSlugAvailability(value);
        setSlugCheck(result);
      } catch {
        setSlugCheck(null);
      } finally {
        setChecking(false);
      }
    }, 400);
  }

  // Clean up any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // When the name changes and the user hasn't taken over the slug, derive the
  // suggestion directly (not in an effect — avoids cascading renders) and check it.
  function handleNameChange(value: string) {
    setName(value);
    if (isNew && !slugTouched) {
      const next = suggestSlug(value);
      setSlug(next);
      scheduleSlugCheck(next);
    }
  }

  function handleSlugChange(raw: string) {
    const next = sanitizeSlug(raw);
    setSlugTouched(true);
    setSlug(next);
    scheduleSlugCheck(next);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (name.trim().length < 2) {
      setError("El nombre del negocio es obligatorio.");
      return;
    }
    if (!type) {
      setError("Selecciona el tipo de negocio.");
      return;
    }
    if (isNew && (!slug || slug.length < 3)) {
      setError("Elige un enlace para tu página de reservas.");
      return;
    }
    if (isNew && slugCheck?.status === "taken") {
      setError("Ese enlace ya está en uso. Elige otro.");
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("type", type);
    fd.set("city", city.trim());
    if (isNew) fd.set("slug", slug);

    setSaving(true);
    try {
      const result = await saveBusinessSettings(fd);
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);

      // Return-intent: when the user arrived from the home page (?from=home),
      // send them back to Inicio after a successful save so the guided setup
      // flows step-to-step. When they came directly (sidebar), stay put.
      if (returnToHome) {
        router.push("/panel");
        return;
      }
      // Refresh server components (this page's create/edit mode, home checklist).
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Name */}
      <Field
        label="Nombre del negocio"
        placeholder="Centro Bienestar Serena"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        maxLength={80}
      />

      {/* Type */}
      <div className="flex flex-col gap-[9px]">
        <span className="text-[13px] font-semibold text-ink">Tipo de negocio</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BUSINESS_TYPES.map((t) => {
            const active = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3.5 text-center transition-all duration-150 ${
                  active
                    ? "border-brand bg-brand-weak text-brand-ink shadow-[0_0_0_3px_var(--color-brand-weak)]"
                    : "border-line bg-surface text-ink-soft hover:border-brand-line hover:text-ink"
                }`}
              >
                <Icon name={t.icon} size={20} className={active ? "text-brand" : ""} />
                <span className="text-[12.5px] font-semibold leading-tight">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* City */}
      <Field
        label="Ciudad"
        hint="(opcional)"
        placeholder="Valencia"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        maxLength={80}
      />

      {/* Slug */}
      {isNew ? (
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink">
            Enlace de tu página de reservas
          </span>
          <div className="flex items-stretch overflow-hidden rounded-[10px] border border-line focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--color-brand-weak)]">
            <span className="flex select-none items-center bg-surface-2 px-3 text-[13px] text-ink-soft">
              /bookings/
            </span>
            <input
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="centro-bienestar"
              maxLength={40}
              className="w-full bg-surface px-[13px] py-3 text-[15px] text-ink outline-none placeholder:text-ink-soft/60"
            />
          </div>
          <SlugFeedback checking={checking} result={slugCheck} slug={slug} />
          <p className="text-[12px] text-ink-soft">
            Este enlace es permanente: no podrás cambiarlo más adelante. Todos los enlaces se
            revisan antes de activarse por completo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink">
            Enlace de tu página de reservas
          </span>
          <div className={`${inputClasses(false)} flex items-center justify-between !cursor-default bg-surface-2`}>
            <span className="truncate text-[14px] text-ink">{bookingUrlDisplay(initial.slug)}</span>
            <SlugStatusBadge status={initial.slugStatus} />
          </div>
          <p className="text-[12px] text-ink-soft">
            El enlace es permanente. Si necesitas cambiarlo, contacta con soporte.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-weak px-4 py-3 text-[13.5px] text-brand-ink">
          <Icon name="check" size={16} strokeWidth={2.5} className="shrink-0" />
          <span>Guardado correctamente.</span>
        </div>
      )}

      <div>
        <Btn onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Guardando…" : isNew ? "Crear negocio" : "Guardar cambios"}
        </Btn>
      </div>
    </div>
  );
}

function SlugFeedback({
  checking,
  result,
  slug,
}: {
  checking: boolean;
  result: SlugCheckResult | null;
  slug: string;
}) {
  if (!slug) return null;
  if (checking) {
    return <p className="text-[12.5px] text-ink-soft">Comprobando disponibilidad…</p>;
  }
  if (!result) return null;

  switch (result.status) {
    case "available":
      return (
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-ink">
          <Icon name="check" size={13} strokeWidth={2.5} /> Disponible
        </p>
      );
    case "taken":
      return <p className="text-[12.5px] font-medium text-error">Ya está en uso. Prueba otra variación.</p>;
    case "invalid":
      return <p className="text-[12.5px] text-error">{result.reason}</p>;
    case "flagged":
      return <p className="text-[12.5px] text-ink-soft">{result.reason}</p>;
    default:
      return null;
  }
}

function SlugStatusBadge({ status }: { status: SlugStatus }) {
  const map: Record<SlugStatus, { label: string; className: string }> = {
    active: { label: "Activo", className: "bg-brand-weak text-brand-ink border-brand-line" },
    pending_review: { label: "En revisión", className: "bg-surface text-ink-soft border-line" },
    rejected: { label: "Rechazado", className: "bg-error-weak text-error border-error" },
  };
  const s = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}
