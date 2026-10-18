"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import { addInvoiceConcept, updateInvoiceConcept, removeInvoiceConcept } from "@/lib/actions/invoices";
import type { InvoiceConcept } from "@/lib/invoices/concepts";
import type { InvoicingDictionary } from "@/lib/i18n/dictionaries/invoicing";
import { reportClientError } from "@/lib/report-client-error";

/**
 * invoice-concepts-list (pdf-invoicing.md): Settings > Facturación section
 * for managing the per-business list of invoice concepts — add, rename,
 * delete. Blank slate by design (no starter list); clinics build this
 * themselves, and typing a new one directly in the invoice confirm modal
 * also adds it here.
 */
export function InvoiceConceptsSettings({
  initialConcepts,
  dict,
}: {
  initialConcepts: InvoiceConcept[];
  dict: InvoicingDictionary["settings"];
}) {
  const [concepts, setConcepts] = useState(initialConcepts);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    setError(null);
    try {
      const result = await addInvoiceConcept(label, { errNoBusiness: dict.errNoBusiness, errSaveFailed: dict.errSaveFailed });
      if (!result.ok) {
        setError(result.error);
      } else {
        setConcepts((prev) =>
          prev.some((c) => c.id === result.concept.id) ? prev : [...prev, result.concept].sort((a, b) => a.label.localeCompare(b.label))
        );
        setNewLabel("");
      }
    } catch (e) {
      reportClientError("addInvoiceConcept", e);
      setError(dict.errSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  function startEditing(concept: InvoiceConcept) {
    setEditingId(concept.id);
    setEditingLabel(concept.label);
    setError(null);
  }

  async function handleSaveEdit() {
    const label = editingLabel.trim();
    if (!editingId || !label) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateInvoiceConcept(
        { conceptId: editingId, label },
        { errNoBusiness: dict.errNoBusiness, errSaveFailed: dict.errSaveFailed }
      );
      if (!result.ok) {
        setError(result.error);
      } else {
        setConcepts((prev) =>
          prev.map((c) => (c.id === result.concept.id ? result.concept : c)).sort((a, b) => a.label.localeCompare(b.label))
        );
        setEditingId(null);
      }
    } catch (e) {
      reportClientError("updateInvoiceConcept", e);
      setError(dict.errSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(conceptId: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await removeInvoiceConcept(conceptId, { errNoBusiness: dict.errNoBusiness, errSaveFailed: dict.errSaveFailed });
      if (!result.ok) {
        setError(result.error);
      } else {
        setConcepts((prev) => prev.filter((c) => c.id !== conceptId));
      }
    } catch (e) {
      reportClientError("removeInvoiceConcept", e);
      setError(dict.errSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-[15px] font-semibold text-ink">{dict.conceptsSectionTitle}</h2>
      <p className="mt-1.5 text-[13.5px] text-ink-soft">{dict.conceptsSectionSubtitle}</p>

      {error && (
        <div className="mt-3 rounded-lg border border-error bg-error-weak px-3 py-2 text-[13px] text-error">{error}</div>
      )}

      {concepts.length === 0 ? (
        <p className="mt-4 text-[13px] text-ink-soft">{dict.conceptsEmpty}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {concepts.map((concept) =>
            editingId === concept.id ? (
              <div key={concept.id} className="flex items-center gap-2">
                <input
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  autoFocus
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
                />
                <Btn variant="outline" size="sm" type="button" onClick={handleSaveEdit} disabled={busy}>
                  {dict.conceptsSave}
                </Btn>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  disabled={busy}
                  className="text-[12.5px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
                >
                  {dict.conceptsCancel}
                </button>
              </div>
            ) : (
              <div key={concept.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3.5 py-2.5">
                <span className="truncate text-[13.5px] text-ink">{concept.label}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startEditing(concept)}
                    disabled={busy}
                    className="text-[12.5px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
                  >
                    {dict.conceptsEdit}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(concept.id)}
                    disabled={busy}
                    className="text-ink-soft hover:text-error disabled:opacity-50"
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          placeholder={dict.conceptsAddPlaceholder}
          className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink"
        />
        <Btn variant="outline" size="sm" type="button" onClick={handleAdd} disabled={busy || !newLabel.trim()}>
          {dict.conceptsAdd}
        </Btn>
      </div>
    </div>
  );
}
