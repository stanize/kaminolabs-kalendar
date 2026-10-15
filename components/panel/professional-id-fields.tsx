"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { saveProfessionalIdFields } from "@/lib/actions/invoices";
import type { BusinessDictionary } from "@/lib/i18n/dictionaries/business";
import { reportClientError } from "@/lib/report-client-error";

// professional-id-fields (pdf-invoicing.md) — the individual professional's
// DNI and professional college registration number, distinct from the
// business's own legal_id (NIF/CIF). Both optional; shown on generated
// invoices when filled in.
export function ProfessionalIdFields({
  initialDni,
  initialCollegeNumber,
  dict,
}: {
  initialDni: string | null;
  initialCollegeNumber: string | null;
  dict: BusinessDictionary["professionalId"];
}) {
  const [dni, setDni] = useState(initialDni ?? "");
  const [collegeNumber, setCollegeNumber] = useState(initialCollegeNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await saveProfessionalIdFields(
        { professionalDni: dni, professionalCollegeNumber: collegeNumber },
        { errNoBusiness: dict.errNoBusiness, errSaveFailed: dict.errSaveFailed }
      );
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    } catch (e) {
      reportClientError("saveProfessionalIdFields", e);
      setError(dict.errSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 rounded-[14px] border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold text-ink">{dict.sectionTitle}</h2>
        <p className="text-[13.5px] text-ink-soft">{dict.sectionSubtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.dniLabel} placeholder={dict.dniPlaceholder} value={dni} onChange={(e) => setDni(e.target.value)} />
        <Field
          label={dict.collegeNumberLabel}
          placeholder={dict.collegeNumberPlaceholder}
          value={collegeNumber}
          onChange={(e) => setCollegeNumber(e.target.value)}
        />
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-error bg-error-weak px-3 py-2 text-[13px] text-error">
          <Icon name="x" size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saved && !error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-brand-line bg-brand-weak px-3 py-2 text-[13px] text-brand-ink">
          <Icon name="check" size={14} strokeWidth={2.5} />
          <span>{dict.saved}</span>
        </div>
      )}

      <div className="mt-4">
        <Btn onClick={handleSave} disabled={saving}>
          {saving ? dict.saving : dict.saveButton}
        </Btn>
      </div>
    </div>
  );
}
