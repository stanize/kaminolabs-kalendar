"use client";

import { useState, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { submitSupportTicket, type SupportTicketCategory } from "@/lib/actions/support";

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: "technical", label: "Problema técnico" },
  { value: "billing", label: "Facturación o pagos" },
  { value: "feature_request", label: "Sugerencia o mejora" },
  { value: "account", label: "Mi cuenta" },
  { value: "other", label: "Otro" },
];

const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;

export default function SoportePage() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SupportTicketCategory>("technical");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((f) => {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`"${f.name}" supera los ${MAX_FILE_SIZE_MB} MB permitidos.`);
        return false;
      }
      if (!f.type.startsWith("image/")) {
        setError(`"${f.name}" no es una imagen válida.`);
        return false;
      }
      return true;
    });
    setFiles((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, MAX_FILES);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setError(null);
    if (!subject.trim()) { setError("Por favor, escribe un asunto."); return; }
    if (!description.trim()) { setError("Por favor, describe tu consulta."); return; }

    setLoading(true);
    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("description", description);
    formData.set("category", category);
    files.forEach((f) => formData.append("attachments", f));

    const result = await submitSupportTicket(formData);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 py-6 sm:px-8 sm:py-20">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-weak">
            <Icon name="check" size={24} className="text-brand" strokeWidth={2.5} />
          </div>
          <h1 className="text-[22px] font-bold text-ink">¡Mensaje enviado!</h1>
          <p className="text-[14px] text-ink-soft leading-relaxed">
            Hemos recibido tu consulta. Nuestro equipo la revisará y te responderemos pronto.
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setSubject("");
              setDescription("");
              setCategory("technical");
              setFiles([]);
            }}
            className="mt-2 rounded-[9px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            Enviar otra consulta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Icon name="lifeBuoy" size={20} className="text-brand" strokeWidth={1.8} />
          <h1 className="text-[22px] font-bold text-ink">Soporte</h1>
        </div>
        <p className="text-[14px] text-ink-soft">
          ¿Tienes alguna duda o problema? Cuéntanos y te ayudamos.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5">
        {/* Category */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink">Tipo de consulta</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ej: No puedo acceder a mi cuenta"
            maxLength={120}
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explícanos con detalle qué está ocurriendo o qué necesitas..."
            rows={5}
            maxLength={2000}
            className="w-full resize-none rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors"
          />
          <p className="text-right text-[11.5px] text-ink-muted">{description.length}/2000</p>
        </div>

        {/* Attachments */}
        <div className="flex flex-col gap-2">
          <label className="text-[13px] font-medium text-ink">
            Capturas de pantalla
            <span className="ml-1.5 text-[12px] font-normal text-ink-muted">(opcional, máx. {MAX_FILES} imágenes de hasta {MAX_FILE_SIZE_MB} MB)</span>
          </label>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-1">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-[8px] border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-soft">
                  <Icon name="paperclip" size={13} strokeWidth={1.8} />
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="ml-0.5 hover:text-ink transition-colors cursor-pointer"
                  >
                    <Icon name="x" size={13} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {files.length < MAX_FILES && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-fit items-center gap-2 rounded-[9px] border border-dashed border-line px-3.5 py-2 text-[13px] text-ink-soft hover:border-brand hover:text-brand transition-colors cursor-pointer"
              >
                <Icon name="paperclip" size={15} strokeWidth={1.8} />
                Adjuntar imagen
              </button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-[9px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 rounded-[10px] bg-brand px-6 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Enviando…
              </>
            ) : (
              <>
                <Icon name="send" size={15} strokeWidth={2} />
                Enviar consulta
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
