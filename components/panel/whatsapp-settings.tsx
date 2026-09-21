"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { saveWhatsappConfig, type WhatsappConfigDTO } from "@/lib/actions/whatsapp";
import type { BusinessDictionary } from "@/lib/i18n/dictionaries/business";
import { reportClientError } from "@/lib/report-client-error";

export function WhatsappSettings({
  initial,
  dict,
}: {
  initial: WhatsappConfigDTO | null;
  dict: BusinessDictionary["whatsapp"];
}) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [accountSid, setAccountSid] = useState(initial?.twilioAccountSid ?? "");
  const [authToken, setAuthToken] = useState("");
  const [number, setNumber] = useState(initial?.twilioWhatsappNumber ?? "");
  const [hasAuthToken] = useState(initial?.hasAuthToken ?? false);
  const [isSandbox, setIsSandbox] = useState(initial?.isSandbox ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const result = await saveWhatsappConfig(
        {
          enabled,
          twilioAccountSid: accountSid,
          twilioAuthToken: authToken,
          twilioWhatsappNumber: number,
        },
        { errBusinessRequired: dict.errBusinessRequired, errSaveFailed: dict.errSaveFailed }
      );
      if (result.ok) {
        setSaved(true);
        setAuthToken("");
        setIsSandbox(number.trim() === "+14155238886");
      } else {
        setError(result.error);
      }
    } catch (err) {
      reportClientError("whatsapp-settings:save", err);
      setError(dict.errSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 rounded-[14px] border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon name="whatsapp" className="text-brand" />
        <div>
          <h2 className="text-[17px] font-semibold text-ink">{dict.sectionTitle}</h2>
          <p className="text-[13.5px] text-ink-soft">{dict.sectionSubtitle}</p>
        </div>
      </div>

      <label className="mb-4 flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-[18px] w-[18px] accent-brand"
        />
        <span className="text-[14px] font-medium text-ink">{dict.enabledLabel}</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={dict.accountSidLabel}
          placeholder={dict.accountSidPlaceholder}
          value={accountSid}
          onChange={(e) => setAccountSid(e.target.value)}
        />
        <Field
          label={dict.authTokenLabel}
          hint={hasAuthToken ? dict.authTokenConfiguredHint : undefined}
          placeholder={dict.authTokenPlaceholder}
          type="password"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          autoComplete="new-password"
        />
        <Field
          label={dict.numberLabel}
          placeholder={dict.numberPlaceholder}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
        />
        <div className="flex flex-col justify-end gap-[7px]">
          <span className="text-[13px] font-semibold text-ink">&nbsp;</span>
          <span
            className={
              "inline-flex w-fit items-center rounded-full px-3 py-1.5 text-[12.5px] font-medium " +
              (isSandbox ? "bg-surface-2 text-ink-soft" : "bg-brand-weak text-brand-ink")
            }
          >
            {isSandbox ? dict.statusSandbox : dict.statusProduction}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Btn onClick={handleSave} disabled={saving}>
          {saving ? dict.saving : dict.saveButton}
        </Btn>
        {saved && <span className="text-[13.5px] text-brand-ink">{dict.saved}</span>}
        {error && <span className="text-[13.5px] text-error">{error}</span>}
      </div>
    </div>
  );
}
