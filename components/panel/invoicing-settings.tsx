"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  saveInvoiceTemplate,
  saveAutoInvoiceSetting,
  uploadInvoiceSignature,
  removeInvoiceSignature,
} from "@/lib/actions/invoices";
import { INVOICE_TEMPLATES } from "@/lib/invoices/templates";
import type { InvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import { reportClientError } from "@/lib/report-client-error";

// invoice-template-selection + auto-invoice-setting + signature-upload
// (pdf-invoicing.md) — all three live on this one Settings tab.
export function InvoicingSettings({
  initialTemplateId,
  initialAutoInvoice,
  initialSignatureUrl,
  dict,
}: {
  initialTemplateId: string;
  initialAutoInvoice: boolean;
  initialSignatureUrl: string | null;
  dict: InvoicingDictionary["settings"];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [autoInvoice, setAutoInvoice] = useState(initialAutoInvoice);
  const [autoSaving, setAutoSaving] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(initialSignatureUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleTemplateChange(next: string) {
    setTemplateId(next);
    setError(null);
    try {
      const result = await saveInvoiceTemplate(next, { errNoBusiness: dict.errNoBusiness, errSaveFailed: dict.errSaveFailed });
      if (!result.ok) setError(result.error);
    } catch (e) {
      reportClientError("saveInvoiceTemplate", e);
      setError(dict.errSaveFailed);
    }
  }

  async function handleAutoInvoiceChange(next: boolean) {
    setAutoInvoice(next);
    setAutoSaving(true);
    setError(null);
    try {
      const result = await saveAutoInvoiceSetting(next, { errNoBusiness: dict.errNoBusiness, errSaveFailed: dict.errSaveFailed });
      if (!result.ok) {
        setAutoInvoice(!next);
        setError(result.error);
      }
    } catch (e) {
      reportClientError("saveAutoInvoiceSetting", e);
      setAutoInvoice(!next);
      setError(dict.errSaveFailed);
    } finally {
      setAutoSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(dict.errInvalidFile);
      return;
    }

    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("signature", file);
    try {
      const result = await uploadInvoiceSignature(formData, { errNoBusiness: dict.errNoBusiness, errInvalidFile: dict.errInvalidFile, errSaveFailed: dict.errSaveFailed });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSignatureUrl(result.signatureUrl);
        router.refresh();
      }
    } catch (e) {
      reportClientError("uploadInvoiceSignature", e);
      setError(dict.errSaveFailed);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveSignature() {
    setError(null);
    setUploading(true);
    try {
      const result = await removeInvoiceSignature({ errNoBusiness: dict.errNoBusiness, errSaveFailed: dict.errSaveFailed });
      if (!result.ok) {
        setError(result.error);
      } else {
        setSignatureUrl(null);
        router.refresh();
      }
    } catch (e) {
      reportClientError("removeInvoiceSignature", e);
      setError(dict.errSaveFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-error bg-error-weak px-4 py-3 text-[13.5px] text-error">
          <Icon name="x" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-[15px] font-semibold text-ink">{dict.templateSectionTitle}</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">{dict.templateSectionSubtitle}</p>
        <div className="mt-4 flex flex-col gap-2">
          {Object.entries(INVOICE_TEMPLATES).map(([id, tmpl]) => (
            <label
              key={id}
              className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 ${
                templateId === id ? "border-brand bg-brand-weak" : "border-line bg-surface"
              }`}
            >
              <input
                type="radio"
                name="invoice-template"
                checked={templateId === id}
                onChange={() => handleTemplateChange(id)}
                className="h-4 w-4 accent-brand"
              />
              <span className="text-[13.5px] font-medium text-ink">{tmpl.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={autoInvoice}
            disabled={autoSaving}
            onChange={(e) => handleAutoInvoiceChange(e.target.checked)}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand disabled:opacity-60"
          />
          <span>
            <span className="block text-[14px] font-medium text-ink">{dict.autoInvoiceLabel}</span>
            <span className="block text-[12.5px] text-ink-soft">{dict.autoInvoiceHint}</span>
          </span>
        </label>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-[15px] font-semibold text-ink">{dict.signatureSectionTitle}</h2>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">{dict.signatureSectionSubtitle}</p>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 min-w-[140px] max-w-[220px] items-center justify-center rounded-xl border border-line bg-surface-2 px-3">
            {signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local/optimizable asset
              <img src={signatureUrl} alt="Firma" className="max-h-12 max-w-full object-contain" />
            ) : (
              <Icon name="fileText" size={22} className="text-ink-soft" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? dict.signatureUploading : signatureUrl ? dict.signatureChange : dict.signatureUpload}
            </Btn>
            {signatureUrl && (
              <button
                type="button"
                onClick={handleRemoveSignature}
                disabled={uploading}
                className="text-[12.5px] font-medium text-ink-soft hover:text-error disabled:opacity-50"
              >
                {dict.signatureRemove}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
