"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { BUSINESS_TYPES } from "@/lib/onboarding/data";
import { businessTypeLabelFor } from "@/lib/i18n/dictionaries/business-types";
import type { BusinessType } from "@/lib/onboarding/types";
import {
  saveBusinessSettings,
  checkSlugAvailability,
  lookupPostalCode,
  type SlugCheckResult,
} from "@/lib/actions/business";
import {
  sanitizeSlug,
  suggestSlug,
} from "@/lib/business/slug-screen";
import { bookingUrlDisplay } from "@/lib/business/booking-url";
import type { SlugStatus } from "@/lib/business/data";
import type { Locale } from "@/lib/i18n/config";
import type { BusinessDictionary } from "@/lib/i18n/dictionaries/business";

interface InitialBusiness {
  name: string;
  type: BusinessType;
  city: string;
  legalId: string;
  addressStreet: string;
  addressNumber: string;
  addressAdditional: string;
  addressPostalCode: string;
  addressProvince: string;
  addressCountry: string;
  phone: string;
  contactEmail: string;
  slug: string;
  slugStatus: SlugStatus;
}

export function BusinessForm({
  initial,
  returnToHome,
  dict,
  locale,
  userEmail,
}: {
  initial: InitialBusiness | null;
  returnToHome: boolean;
  dict: BusinessDictionary;
  locale: Locale;
  userEmail: string;
}) {
  const router = useRouter();
  const isNew = !initial;
  const f = dict.form;

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<BusinessType | "">(initial?.type ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [legalId, setLegalId] = useState(initial?.legalId ?? "");
  const [addressStreet, setAddressStreet] = useState(initial?.addressStreet ?? "");
  const [addressNumber, setAddressNumber] = useState(initial?.addressNumber ?? "");
  const [addressAdditional, setAddressAdditional] = useState(initial?.addressAdditional ?? "");
  const [addressPostalCode, setAddressPostalCode] = useState(initial?.addressPostalCode ?? "");
  const [addressProvince, setAddressProvince] = useState(initial?.addressProvince ?? "");
  const [addressCountry, setAddressCountry] = useState(initial?.addressCountry ?? "España");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  // Defaults to the owner's account email on creation, but stays editable —
  // the business's contact email is intentionally distinct from the account.
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? userEmail ?? "");

  // Slug is only editable at creation. After that it is fixed.
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugCheck, setSlugCheck] = useState<SlugCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [postalAutofilled, setPostalAutofilled] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const result = await checkSlugAvailability(value, {
          errSlugReserved: dict.errors.errSlugReserved,
          errSlugFlagged: dict.errors.errSlugFlagged,
          errSlugTooShort: dict.errors.errSlugTooShort,
          errSlugTooLong: dict.errors.errSlugTooLong,
          errSlugInvalidChars: dict.errors.errSlugInvalidChars,
        });
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
      if (postalDebounceRef.current) clearTimeout(postalDebounceRef.current);
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

  // Postal-code autofill (free, static dataset — see lib/business/postal-codes.ts).
  // Only fills city/province when BOTH are still empty, so it never clobbers
  // something the user already typed (e.g. if they filled City before reaching
  // the postal code fields, which is the field order in this form).
  function handlePostalCodeChange(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, 5);
    setAddressPostalCode(next);
    setPostalAutofilled(false);

    if (postalDebounceRef.current) clearTimeout(postalDebounceRef.current);
    if (next.length !== 5) return;

    postalDebounceRef.current = setTimeout(async () => {
      try {
        const result = await lookupPostalCode(next);
        if (result && !city.trim() && !addressProvince.trim()) {
          setCity(result.city);
          setAddressProvince(result.province);
          setPostalAutofilled(true);
        }
      } catch {
        // Silent miss — autofill is a convenience, not a required step.
      }
    }, 400);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (name.trim().length < 2) {
      setError(f.errName);
      return;
    }
    if (!type) {
      setError(f.errType);
      return;
    }
    if (addressStreet.trim().length < 3) {
      setError(f.errAddressStreet);
      return;
    }
    if (addressNumber.trim().length < 1) {
      setError(f.errAddressNumber);
      return;
    }
    if (city.trim().length < 2) {
      setError(f.errCity);
      return;
    }
    if (addressPostalCode.trim().length < 3) {
      setError(f.errAddressPostalCode);
      return;
    }
    if (addressProvince.trim().length < 2) {
      setError(f.errAddressProvince);
      return;
    }
    if (addressCountry.trim().length < 2) {
      setError(f.errAddressCountry);
      return;
    }
    if (phone.trim().length < 5) {
      setError(f.errPhone);
      return;
    }
    if (!contactEmail.trim().includes("@")) {
      setError(f.errContactEmail);
      return;
    }
    if (isNew && (!slug || slug.length < 3)) {
      setError(f.errSlugRequired);
      return;
    }
    if (isNew && slugCheck?.status === "taken") {
      setError(f.errSlugTaken);
      return;
    }

    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("type", type);
    fd.set("city", city.trim());
    fd.set("legalId", legalId.trim());
    fd.set("addressStreet", addressStreet.trim());
    fd.set("addressNumber", addressNumber.trim());
    fd.set("addressAdditional", addressAdditional.trim());
    fd.set("addressPostalCode", addressPostalCode.trim());
    fd.set("addressProvince", addressProvince.trim());
    fd.set("addressCountry", addressCountry.trim());
    fd.set("phone", phone.trim());
    fd.set("contactEmail", contactEmail.trim());
    if (isNew) fd.set("slug", slug);

    setSaving(true);
    try {
      const result = await saveBusinessSettings(fd, {
        errName: f.errName,
        errType: f.errType,
        errCity: f.errCity,
        errAddressStreet: f.errAddressStreet,
        errAddressNumber: f.errAddressNumber,
        errAddressPostalCode: f.errAddressPostalCode,
        errAddressProvince: f.errAddressProvince,
        errAddressCountry: f.errAddressCountry,
        errPhone: f.errPhone,
        errContactEmail: f.errContactEmail,
        errSlugTaken: dict.errors.errSlugTaken,
        errSaveFailed: dict.errors.errSaveFailed,
        errCreateFailed: dict.errors.errCreateFailed,
        errSlugTooShort: dict.errors.errSlugTooShort,
        errSlugTooLong: dict.errors.errSlugTooLong,
        errSlugInvalidChars: dict.errors.errSlugInvalidChars,
      });
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
      setError(f.errUnexpected);
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Name */}
      <Field
        label={f.nameLabel}
        placeholder={f.namePlaceholder}
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        maxLength={80}
      />

      {/* Type */}
      <div className="flex flex-col gap-[9px]">
        <span className="text-[13px] font-semibold text-ink">{f.typeLabel}</span>
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
                <span className="text-[12.5px] font-semibold leading-tight">
                  {businessTypeLabelFor(t.id, locale)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legal ID (optional) */}
      <Field
        label={f.legalIdLabel}
        hint={f.legalIdHint}
        placeholder={f.legalIdPlaceholder}
        value={legalId}
        onChange={(e) => setLegalId(e.target.value)}
        maxLength={20}
      />

      {/* Address */}
      <div className="flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-ink">{f.addressSectionLabel}</span>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field
              label={f.addressStreetLabel}
              placeholder={f.addressStreetPlaceholder}
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
              maxLength={120}
            />
          </div>
          <Field
            label={f.addressNumberLabel}
            placeholder={f.addressNumberPlaceholder}
            value={addressNumber}
            onChange={(e) => setAddressNumber(e.target.value)}
            maxLength={20}
          />
        </div>
        <Field
          label={f.addressAdditionalLabel}
          hint={f.addressAdditionalHint}
          placeholder={f.addressAdditionalPlaceholder}
          value={addressAdditional}
          onChange={(e) => setAddressAdditional(e.target.value)}
          maxLength={40}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={f.addressPostalCodeLabel}
            placeholder={f.addressPostalCodePlaceholder}
            value={addressPostalCode}
            onChange={(e) => handlePostalCodeChange(e.target.value)}
            maxLength={5}
          />
          <Field
            label={f.addressProvinceLabel}
            placeholder={f.addressProvincePlaceholder}
            value={addressProvince}
            onChange={(e) => setAddressProvince(e.target.value)}
            maxLength={60}
          />
        </div>
        <Field
          label={f.cityLabel}
          placeholder={f.cityPlaceholder}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={80}
        />
        {postalAutofilled && (
          <p className="-mt-2 flex items-center gap-1.5 text-[12px] font-medium text-brand-ink">
            <Icon name="check" size={12} strokeWidth={2.5} /> {f.postalAutofilledHint}
          </p>
        )}
        <Field
          label={f.addressCountryLabel}
          placeholder={f.addressCountryPlaceholder}
          value={addressCountry}
          onChange={(e) => setAddressCountry(e.target.value)}
          maxLength={60}
        />
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-4">
        <span className="text-[13px] font-semibold text-ink">{f.contactSectionLabel}</span>
        <Field
          label={f.phoneLabel}
          placeholder={f.phonePlaceholder}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
        />
        <Field
          label={f.contactEmailLabel}
          placeholder={f.contactEmailPlaceholder}
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          maxLength={120}
        />
      </div>

      {/* Slug */}
      {isNew ? (
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink">{f.slugLabel}</span>
          <div className="flex items-stretch overflow-hidden rounded-[10px] border border-line focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--color-brand-weak)]">
            <span className="flex select-none items-center bg-surface-2 px-3 text-[13px] text-ink-soft">
              /bookings/
            </span>
            <input
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder={f.slugPlaceholder}
              maxLength={40}
              className="w-full bg-surface px-[13px] py-3 text-[15px] text-ink outline-none placeholder:text-ink-soft/60"
            />
          </div>
          <SlugFeedback checking={checking} result={slugCheck} slug={slug} f={f} />
          <p className="text-[12px] text-ink-soft">{f.slugImmutableNew}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[7px]">
          <span className="text-[13px] font-semibold text-ink">{f.slugLabel}</span>
          <div className={`${inputClasses(false)} flex items-center justify-between !cursor-default bg-surface-2`}>
            <span className="truncate text-[14px] text-ink">{bookingUrlDisplay(initial.slug)}</span>
            <SlugStatusBadge status={initial.slugStatus} f={f} />
          </div>
          <p className="text-[12px] text-ink-soft">{f.slugImmutableEdit}</p>
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
          <span>{f.saved}</span>
        </div>
      )}

      <div>
        <Btn onClick={handleSave} disabled={saving} size="lg">
          {saving ? f.saving : isNew ? f.createButton : f.saveButton}
        </Btn>
      </div>
    </div>
  );
}

function SlugFeedback({
  checking,
  result,
  slug,
  f,
}: {
  checking: boolean;
  result: SlugCheckResult | null;
  slug: string;
  f: BusinessDictionary["form"];
}) {
  if (!slug) return null;
  if (checking) {
    return <p className="text-[12.5px] text-ink-soft">{f.slugChecking}</p>;
  }
  if (!result) return null;

  switch (result.status) {
    case "available":
      return (
        <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-ink">
          <Icon name="check" size={13} strokeWidth={2.5} /> {f.slugAvailable}
        </p>
      );
    case "taken":
      return <p className="text-[12.5px] font-medium text-error">{f.slugTaken}</p>;
    case "invalid":
      return <p className="text-[12.5px] text-error">{result.reason}</p>;
    case "flagged":
      return <p className="text-[12.5px] text-ink-soft">{result.reason}</p>;
    default:
      return null;
  }
}

function SlugStatusBadge({ status, f }: { status: SlugStatus; f: BusinessDictionary["form"] }) {
  const map: Record<SlugStatus, { label: string; className: string }> = {
    active: { label: f.statusActive, className: "bg-brand-weak text-brand-ink border-brand-line" },
    pending_review: { label: f.statusPending, className: "bg-surface text-ink-soft border-line" },
    rejected: { label: f.statusRejected, className: "bg-error-weak text-error border-error" },
  };
  const s = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}
