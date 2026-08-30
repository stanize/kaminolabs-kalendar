"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import {
  createBonoType,
  updateBonoType,
  setBonoTypeActive,
  recordBonoPurchase,
} from "@/lib/actions/bonos";
import { searchClients, type ClientSearchResult } from "@/lib/actions/clients";
import { reportClientError } from "@/lib/report-client-error";
import type { BonoType, SoldBono } from "@/lib/bonos/data";
import type { BonosDictionary } from "@/lib/i18n/dictionaries/bonos";
import type { Locale } from "@/lib/i18n/config";

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand";

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric", month: "short", year: "numeric",
  }).format(new Date(iso));
}

export function BonosManager({
  initialBonoTypes, activeBonoTypes, initialSoldBonos, dict, locale,
}: {
  initialBonoTypes: BonoType[];
  activeBonoTypes: BonoType[];
  initialSoldBonos: SoldBono[];
  dict: BonosDictionary;
  locale: Locale;
}) {
  const [tab, setTab] = useState<"types" | "sold">("types");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <TabBtn active={tab === "types"} onClick={() => setTab("types")} label={dict.tabs.types} />
        <TabBtn active={tab === "sold"} onClick={() => setTab("sold")} label={dict.tabs.sold} />
      </div>

      {tab === "types" ? (
        <BonoTypesTab initialBonoTypes={initialBonoTypes} dict={dict} />
      ) : (
        <SoldBonosTab activeBonoTypes={activeBonoTypes} initialSoldBonos={initialSoldBonos} dict={dict} locale={locale} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition-colors ${
        active ? "bg-brand text-white" : "bg-surface text-ink-soft hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function BonoTypesTab({ initialBonoTypes, dict }: { initialBonoTypes: BonoType[]; dict: BonosDictionary }) {
  const router = useRouter();
  const t = dict.types;
  const [types, setTypes] = useState(initialBonoTypes);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggleActive(id: string, active: boolean) {
    setBusyId(id);
    setError(null);
    const prev = types;
    setTypes((l) => l.map((x) => (x.id === id ? { ...x, active } : x)));
    try {
      const res = await setBonoTypeActive({ bonoTypeId: id, active }, dict.errors);
      if (!res.ok) { setTypes(prev); setError(res.error); }
      else router.refresh();
    } catch (e) {
      reportClientError("setBonoTypeActive", e);
      setTypes(prev);
      setError(dict.errors.errSaveFailed);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-[13px] text-error">{error}</p>}

      {types.length === 0 && !adding ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
            <Icon name="creditCard" size={22} />
          </div>
          <p className="text-[14.5px] font-semibold text-ink">{t.emptyTitle}</p>
          <p className="mt-1 text-[13px] text-ink-soft">{t.emptySubtitle}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {types.map((bt, i) => (
            editingId === bt.id ? (
              <BonoTypeForm
                key={bt.id}
                dict={dict}
                initial={bt}
                bordered={i > 0}
                onCancel={() => setEditingId(null)}
                onSaved={(updated) => {
                  setTypes((l) => l.map((x) => (x.id === bt.id ? updated : x)));
                  setEditingId(null);
                  router.refresh();
                }}
              />
            ) : (
              <div key={bt.id} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-[14px] font-semibold text-ink">
                    {bt.name}
                    {!bt.active && (
                      <span className="shrink-0 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                        {t.inactiveLabel}
                      </span>
                    )}
                  </p>
                  <p className="text-[12.5px] text-ink-soft">
                    {bt.sessionCount} {t.sessionsUnit} · {bt.price.toFixed(2)} €
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditingId(bt.id)}
                    className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink"
                  >
                    {t.edit}
                  </button>
                  <button
                    onClick={() => handleToggleActive(bt.id, !bt.active)}
                    disabled={busyId === bt.id}
                    className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    {bt.active ? t.deactivate : t.activate}
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {adding ? (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <BonoTypeForm
            dict={dict}
            onCancel={() => setAdding(false)}
            onSaved={(created) => {
              setTypes((l) => [created, ...l]);
              setAdding(false);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <Btn variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} /> {t.addNew}
        </Btn>
      )}
    </div>
  );
}

function BonoTypeForm({
  dict, initial, bordered, onCancel, onSaved,
}: {
  dict: BonosDictionary;
  initial?: BonoType;
  bordered?: boolean;
  onCancel: () => void;
  onSaved: (bt: BonoType) => void;
}) {
  const t = dict.types;
  const [name, setName] = useState(initial?.name ?? "");
  const [sessionCount, setSessionCount] = useState(String(initial?.sessionCount ?? ""));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const sc = Number(sessionCount);
    const p = Number(price);
    if (!name.trim()) { setError(dict.errors.errNameRequired); return; }
    if (!Number.isInteger(sc) || sc <= 0) { setError(dict.errors.errInvalidSessionCount); return; }
    if (!Number.isFinite(p) || p < 0) { setError(dict.errors.errInvalidPrice); return; }

    setSaving(true);
    try {
      if (initial) {
        const res = await updateBonoType({ bonoTypeId: initial.id, name: name.trim(), sessionCount: sc, price: p }, dict.errors);
        if (!res.ok) { setError(res.error); setSaving(false); return; }
        onSaved({ id: initial.id, name: name.trim(), sessionCount: sc, price: p, active: initial.active });
      } else {
        const res = await createBonoType({ name: name.trim(), sessionCount: sc, price: p }, dict.errors);
        if (!res.ok) { setError(res.error); setSaving(false); return; }
        onSaved({ id: res.bonoTypeId, name: name.trim(), sessionCount: sc, price: p, active: true });
      }
    } catch (e) {
      reportClientError(initial ? "updateBonoType" : "createBonoType", e);
      setError(dict.errors.errSaveFailed);
      setSaving(false);
    }
  }

  return (
    <div className={`flex flex-col gap-3 p-4 ${bordered ? "border-t border-line" : ""}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className="mb-1 block text-[12px] font-medium text-ink-soft">{t.nameLabel}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePlaceholder} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-ink-soft">{t.sessionsLabel}</label>
          <input
            value={sessionCount}
            onChange={(e) => setSessionCount(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-ink-soft">{t.priceLabel}</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            className={inputClass}
          />
        </div>
      </div>
      {error && <p className="text-[12.5px] text-error">{error}</p>}
      <div className="flex items-center gap-2">
        <Btn size="sm" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</Btn>
        <Btn size="sm" variant="ghost" onClick={onCancel} disabled={saving}>{t.cancel}</Btn>
      </div>
    </div>
  );
}

function SoldBonosTab({
  activeBonoTypes, initialSoldBonos, dict, locale,
}: {
  activeBonoTypes: BonoType[];
  initialSoldBonos: SoldBono[];
  dict: BonosDictionary;
  locale: Locale;
}) {
  const router = useRouter();
  const t = dict.sold;
  const [sold, setSold] = useState(initialSoldBonos);
  const [selling, setSelling] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {sold.length === 0 && !selling ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-ink-soft">
            <Icon name="creditCard" size={22} />
          </div>
          <p className="text-[14.5px] font-semibold text-ink">{t.emptyTitle}</p>
          <p className="mt-1 text-[13px] text-ink-soft">{t.emptySubtitle}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {sold.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{s.clientName}</p>
                <p className="truncate text-[12.5px] text-ink-soft">
                  {s.bonoTypeName ?? "—"} · {t.remaining.replace("{used}", String(s.sessionsUsed)).replace("{total}", String(s.sessionsTotal))}
                </p>
                <p className="text-[11.5px] text-ink-soft">{t.purchasedOn.replace("{date}", formatDate(s.purchasedAt, locale))}</p>
              </div>
              <p className="shrink-0 text-[13.5px] font-semibold text-ink">{s.pricePaid.toFixed(2)} €</p>
            </div>
          ))}
        </div>
      )}

      {selling ? (
        <SellBonoForm
          dict={dict}
          activeBonoTypes={activeBonoTypes}
          onCancel={() => setSelling(false)}
          onSold={(newSold) => {
            setSold((l) => [newSold, ...l]);
            setSelling(false);
            router.refresh();
          }}
        />
      ) : (
        <Btn variant="outline" size="sm" onClick={() => setSelling(true)}>
          <Icon name="plus" size={14} /> {t.sellNew}
        </Btn>
      )}
    </div>
  );
}

function SellBonoForm({
  dict, activeBonoTypes, onCancel, onSold,
}: {
  dict: BonosDictionary;
  activeBonoTypes: BonoType[];
  onCancel: () => void;
  onSold: (s: SoldBono) => void;
}) {
  const t = dict.sold;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [bonoTypeId, setBonoTypeId] = useState(activeBonoTypes[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) { setResults([]); setShowResults(false); return; }
      try {
        const r = await searchClients(q);
        setResults(r);
        setShowResults(r.length > 0);
      } catch (e) {
        reportClientError("searchClients:bonos", e);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function handleConfirm() {
    setError(null);
    if (!selectedClient) { setError(dict.errors.errClientRequired); return; }
    if (!bonoTypeId) { setError(dict.errors.errBonoTypeRequired); return; }

    setSaving(true);
    try {
      const res = await recordBonoPurchase({ clientId: selectedClient.id, bonoTypeId }, dict.errors);
      if (!res.ok) { setError(res.error); setSaving(false); return; }
      const bonoType = activeBonoTypes.find((bt) => bt.id === bonoTypeId);
      onSold({
        id: res.purchaseId,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        bonoTypeName: bonoType?.name ?? null,
        sessionsTotal: bonoType?.sessionCount ?? 0,
        sessionsUsed: 0,
        pricePaid: bonoType?.price ?? 0,
        purchasedAt: new Date().toISOString(),
      });
    } catch (e) {
      reportClientError("recordBonoPurchase", e);
      setError(dict.errors.errSaveFailed);
      setSaving(false);
    }
  }

  if (activeBonoTypes.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="mb-3 text-[13px] text-ink-soft">{t.noActiveBonoTypes}</p>
        <Btn size="sm" variant="ghost" onClick={onCancel}>{t.cancel}</Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="relative">
        <label className="mb-1 block text-[12px] font-medium text-ink-soft">{t.clientLabel}</label>
        <input
          value={selectedClient ? selectedClient.name : query}
          onChange={(e) => { setQuery(e.target.value); setSelectedClient(null); }}
          onFocus={() => setShowResults(results.length > 0)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder={t.clientPlaceholder}
          className={inputClass}
          autoComplete="off"
        />
        {showResults && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-lg border border-line bg-surface shadow-lg">
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setSelectedClient(c); setQuery(c.name); setShowResults(false); }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-surface-2"
              >
                <span className="text-[13.5px] font-semibold text-ink">{c.name}</span>
                <span className="text-[12px] text-ink-soft">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[12px] font-medium text-ink-soft">{t.bonoTypeLabel}</label>
        <select value={bonoTypeId} onChange={(e) => setBonoTypeId(e.target.value)} className={inputClass}>
          {activeBonoTypes.map((bt) => (
            <option key={bt.id} value={bt.id}>
              {bt.name} · {bt.sessionCount} sesiones · {bt.price.toFixed(2)} €
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-[12.5px] text-error">{error}</p>}

      <div className="flex items-center gap-2">
        <Btn size="sm" onClick={handleConfirm} disabled={saving}>{saving ? t.confirming : t.confirm}</Btn>
        <Btn size="sm" variant="ghost" onClick={onCancel} disabled={saving}>{t.cancel}</Btn>
      </div>
    </div>
  );
}
