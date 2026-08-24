"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { updatePatientProfile } from "@/lib/actions/patient";
import { reportClientError } from "@/lib/report-client-error";

export function PatientProfileForm({
  initialName,
  initialPhone,
}: {
  initialName: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSaved(false);

    if (name.trim().length < 1) {
      setError("Introduce tu nombre.");
      return;
    }

    setSaving(true);
    try {
      const result = await updatePatientProfile({
        name: name.trim(),
        phone: phone.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setSaving(false);
      setSaved(true);
      router.refresh();
    } catch (e) {
      reportClientError("updatePatientProfile", e);
      setError("No se pudo guardar el perfil.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Nombre"
        placeholder="Tu nombre"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setSaved(false);
        }}
        maxLength={80}
      />
      <Field
        label="Teléfono"
        placeholder="600 000 000"
        value={phone}
        onChange={(e) => {
          setPhone(e.target.value);
          setSaved(false);
        }}
        maxLength={30}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && !error && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-weak px-4 py-3 text-[13.5px] text-brand-ink">
          <Icon name="check" size={16} strokeWidth={2.5} />
          <span>Perfil guardado.</span>
        </div>
      )}

      <div>
        <Btn onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Btn>
      </div>
    </div>
  );
}
