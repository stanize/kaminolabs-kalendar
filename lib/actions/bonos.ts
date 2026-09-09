"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth-action";
import { createClient } from "@/lib/supabase/server";
import { getBusinessForUser } from "@/lib/business/data";
import { getActiveBonosForClient, getBonoUsageHistory, type ClientActiveBono, type BonoUsageSession } from "@/lib/bonos/data";

export interface BonoActionDict {
  errNoBusiness: string;
  errNotFound: string;
  errNameRequired: string;
  errInvalidSessionCount: string;
  errInvalidPrice: string;
  errSaveFailed: string;
  errClientRequired: string;
  errBonoTypeRequired: string;
  errBonoTypeInactive: string;
  errReverseFailed: string; // reverse_bono_session RPC failed or booking no longer bono-paid
}

const FALLBACK: BonoActionDict = {
  errNoBusiness: "No hay negocio.",
  errNotFound: "No encontrado.",
  errNameRequired: "Indica un nombre para el bono.",
  errInvalidSessionCount: "El número de sesiones debe ser mayor que 0.",
  errInvalidPrice: "Indica un precio válido.",
  errSaveFailed: "No se pudo guardar el cambio.",
  errClientRequired: "Elige un cliente.",
  errBonoTypeRequired: "Elige un tipo de bono.",
  errBonoTypeInactive: "Este tipo de bono ya no está disponible.",
  errReverseFailed: "No se pudo revertir la sesión. Puede que ya se haya cambiado.",
};

// ── Bono types (bono-types-schema-and-config) ───────────────────────────────

export type BonoTypeResult = { ok: true; bonoTypeId: string } | { ok: false; error: string };

export const createBonoType = authedAction(
  async (
    session,
    input: { name: string; sessionCount: number; price: number },
    dict?: Partial<BonoActionDict>
  ): Promise<BonoTypeResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const name = input.name.trim();
    if (!name) return { ok: false, error: t.errNameRequired };
    if (!Number.isInteger(input.sessionCount) || input.sessionCount <= 0) {
      return { ok: false, error: t.errInvalidSessionCount };
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
      return { ok: false, error: t.errInvalidPrice };
    }

    const supabase = await createClient();
    const { data: created, error } = await supabase
      .from("kalendar_bono_types")
      .insert({
        business_id: business.id,
        name,
        session_count: input.sessionCount,
        price: input.price,
      })
      .select("id")
      .single();

    if (error || !created) return { ok: false, error: t.errSaveFailed };

    revalidatePath("/panel/bonos");
    return { ok: true, bonoTypeId: created.id };
  }
);

export type UpdateResult = { ok: true } | { ok: false; error: string };

export const updateBonoType = authedAction(
  async (
    session,
    input: { bonoTypeId: string; name: string; sessionCount: number; price: number },
    dict?: Partial<BonoActionDict>
  ): Promise<UpdateResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const name = input.name.trim();
    if (!name) return { ok: false, error: t.errNameRequired };
    if (!Number.isInteger(input.sessionCount) || input.sessionCount <= 0) {
      return { ok: false, error: t.errInvalidSessionCount };
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
      return { ok: false, error: t.errInvalidPrice };
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("kalendar_bono_types")
      .select("id")
      .eq("id", input.bonoTypeId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: t.errNotFound };

    const { error } = await supabase
      .from("kalendar_bono_types")
      .update({ name, session_count: input.sessionCount, price: input.price })
      .eq("id", input.bonoTypeId)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: t.errSaveFailed };

    revalidatePath("/panel/bonos");
    return { ok: true };
  }
);

/**
 * Toggles a bono type active/inactive — never deletes (see schema comment:
 * deleting would orphan/cascade real sale history in
 * kalendar_bono_purchases). An inactive type just stops being offerable as
 * a new sale; already-sold bonos of that type are unaffected either way.
 */
export const setBonoTypeActive = authedAction(
  async (
    session,
    input: { bonoTypeId: string; active: boolean },
    dict?: Partial<BonoActionDict>
  ): Promise<UpdateResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("kalendar_bono_types")
      .select("id")
      .eq("id", input.bonoTypeId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!existing) return { ok: false, error: t.errNotFound };

    const { error } = await supabase
      .from("kalendar_bono_types")
      .update({ active: input.active })
      .eq("id", input.bonoTypeId)
      .eq("business_id", business.id);

    if (error) return { ok: false, error: t.errSaveFailed };

    revalidatePath("/panel/bonos");
    return { ok: true };
  }
);

// ── Bono purchases (bono-purchase-recording) ────────────────────────────────

export type RecordPurchaseResult = { ok: true; purchaseId: string } | { ok: false; error: string };

/**
 * Records a bono sale — NOT real payment processing (explicitly out of
 * scope), just recording that a sale happened. sessions_total/price_paid
 * are snapshotted from the bono type AT THIS MOMENT, so later edits to the
 * bono type's own name/session_count/price never retroactively change past
 * sales (see schema comment).
 */
export const recordBonoPurchase = authedAction(
  async (
    session,
    input: { clientId: string; bonoTypeId: string },
    dict?: Partial<BonoActionDict>
  ): Promise<RecordPurchaseResult> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };
    if (!input.clientId) return { ok: false, error: t.errClientRequired };
    if (!input.bonoTypeId) return { ok: false, error: t.errBonoTypeRequired };

    const supabase = await createClient();

    const [{ data: client }, { data: bonoType }] = await Promise.all([
      supabase
        .from("kalendar_clients")
        .select("id")
        .eq("id", input.clientId)
        .eq("business_id", business.id)
        .maybeSingle(),
      supabase
        .from("kalendar_bono_types")
        .select("id, session_count, price, active")
        .eq("id", input.bonoTypeId)
        .eq("business_id", business.id)
        .maybeSingle(),
    ]);

    if (!client) return { ok: false, error: t.errClientRequired };
    if (!bonoType) return { ok: false, error: t.errBonoTypeRequired };
    if (!bonoType.active) return { ok: false, error: t.errBonoTypeInactive };

    const { data: created, error } = await supabase
      .from("kalendar_bono_purchases")
      .insert({
        business_id: business.id,
        client_id: input.clientId,
        bono_type_id: input.bonoTypeId,
        sessions_total: bonoType.session_count,
        sessions_used: 0,
        price_paid: bonoType.price,
      })
      .select("id")
      .single();

    if (error || !created) return { ok: false, error: t.errSaveFailed };

    revalidatePath("/panel/bonos");
    revalidatePath(`/panel/clients/${input.clientId}`);
    return { ok: true, purchaseId: created.id };
  }
);

// ── Client active bonos (session-deduction-on-payment) ──────────────────────

/**
 * A single client's still-usable bonos, for the booking-detail modal's
 * payment-method dropdown. Business-scoping happens inside
 * getActiveBonosForClient itself; this wrapper just makes it callable from
 * a client component. Returns [] (not an error) if the business can't be
 * resolved or the client has none — the modal treats an empty list as "no
 * bono option to offer", not a failure.
 */
export const getActiveBonosForClientAction = authedAction(
  async (session, input: { clientId: string }): Promise<ClientActiveBono[]> => {
    if (!input.clientId) return [];
    return getActiveBonosForClient(session.user.id, input.clientId);
  }
);

// ── Bono session reversal (bono-session-reversal) ────────────────────────────

/**
 * The bookings currently consuming a specific bono's sessions, for the
 * usage-history view under "Bonos vendidos". Business-scoping happens
 * inside getBonoUsageHistory itself.
 */
export const getBonoUsageHistoryAction = authedAction(
  async (session, input: { bonoPurchaseId: string }): Promise<BonoUsageSession[]> => {
    if (!input.bonoPurchaseId) return [];
    return getBonoUsageHistory(session.user.id, input.bonoPurchaseId);
  }
);

/**
 * The ONLY place a bono-consumed session can be reversed (the booking
 * detail modal only allows switching INTO a bono, never away from one —
 * see updateBookingResult). Restores the session to the bono and switches
 * the booking's payment_method to cash/card via the reverse_bono_session
 * Postgres function, which does both writes atomically in one transaction
 * — unlike the forward deduction path, atomicity here is required per the
 * workflow spec, since a partial reversal would silently over-restore or
 * leave the booking pointing at a bono that no longer reflects it.
 */
export const reverseBonoSessionAction = authedAction(
  async (
    session,
    input: { bookingId: string; newPaymentMethod: "cash" | "card"; clientId?: string },
    dict?: Partial<BonoActionDict>
  ): Promise<{ ok: true } | { ok: false; error: string }> => {
    const t = { ...FALLBACK, ...dict };

    const business = await getBusinessForUser(session.user.id);
    if (!business) return { ok: false, error: t.errNoBusiness };

    const supabase = await createClient();
    const { error } = await supabase.rpc("reverse_bono_session", {
      p_booking_id: input.bookingId,
      p_business_id: business.id,
      p_new_payment_method: input.newPaymentMethod,
    });

    if (error) return { ok: false, error: t.errReverseFailed };

    revalidatePath("/panel/bonos");
    revalidatePath("/panel/calendar");
    if (input.clientId) revalidatePath(`/panel/clients/${input.clientId}`);
    return { ok: true };
  }
);
