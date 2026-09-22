import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPublicBookingData } from "@/lib/booking/data";
import { getAvailableSlots, submitBookingInternal, type SlotDTO } from "@/lib/actions/booking";
import {
  parseServiceListId,
  parseDateListId,
  parseTimeListId,
  DATE_LIST_MORE_ROW_ID,
} from "@/lib/whatsapp/twilio-client";
import {
  loadOrResetSession,
  resetSession,
  updateSession,
  type WhatsappSessionRow,
} from "@/lib/whatsapp/session";

// Non-goals carried over from workflows/whatsapp-booking.md: new bookings
// only (no cancel/reschedule via WhatsApp), no free-text NLP — every step is
// "reply with the number of your choice", which we implement as parsing a
// plain-text digit out of the inbound message body.

// DAYS_AHEAD widened 14 -> 60 (2026-09-22, date-list pagination) so there is
// a real, wide-enough pool of open dates to paginate through — the whole
// window is fetched once (buildDateOptionsReply below) and paginated
// in-memory, DATE_PAGE_SIZE per page, rather than re-querying per page.
const DAYS_AHEAD = 60;
const DATE_PAGE_SIZE = 6; // real dates per date-list page; the 7th row is "Ver más fechas" when a next page exists
const MAX_TIME_OPTIONS = 9;

function parseChoice(body: string): number | null {
  const trimmed = body.trim();
  const n = Number(trimmed);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Confirm/Cancel choice at the awaiting_confirmation step. Accepts either a
 * native twilio/quick-reply button tap (ButtonPayload "confirm"/"cancel",
 * passed in as `buttonPayload`) or the legacy plain-text "1"/"2" digit reply
 * (kept for anyone still on a stale conversation from before this button
 * upgrade, or a client that doesn't render quick-reply buttons). */
function parseConfirmChoice(body: string, buttonPayload: string | null): "confirm" | "cancel" | null {
  if (buttonPayload === "confirm") return "confirm";
  if (buttonPayload === "cancel") return "cancel";
  const n = parseChoice(body);
  if (n === 1) return "confirm";
  if (n === 2) return "cancel";
  return null;
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function todayInBusinessTz(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

interface ConversationResult {
  reply: string;
  /** Present only at the awaiting_confirmation summary step — the caller
   * (the webhook route) sends this as a native twilio/quick-reply
   * Confirm/Cancel message instead of `reply` as plain text. `reply` is
   * still populated in that case as the body text substituted into the
   * template's {{1}} placeholder, and as a plain-text fallback value. */
  quickReplySummary?: string;
  /** Present whenever a service-selection prompt is being sent (initial
   * contact, or a re-prompt on an unrecognized reply) — the caller sends
   * this as a native whatsapp/card LIST message instead of `reply` as plain
   * text. `reply` is still populated in that case as the numbered-text
   * fallback value (used if the Content API send fails). */
  serviceListOptions?: { id: string; name: string; duration_min: number }[];
  /** Present whenever a date-selection prompt is being sent — the caller
   * sends this as a native whatsapp/card LIST message instead of `reply` as
   * plain text. `reply` is still populated as the numbered-text fallback.
   * `dates` is one page (up to DATE_PAGE_SIZE); `hasMore` says whether a
   * "Ver más fechas" row should be shown — see date-list-pagination
   * addition (2026-09-22, sixth pass). */
  dateListOptions?: { serviceName: string; dates: { id: string; label: string }[]; hasMore: boolean };
  /** Present whenever a time-selection prompt is being sent — same pattern
   * as dateListOptions above, for times. */
  timeListOptions?: { dateLabel: string; slots: { id: string; label: string }[] };
  /** Present only for the "requested a page beyond the last one" case — the
   * caller sends this as a separate plain-text WhatsApp message BEFORE the
   * (page-1) dateListOptions list that follows in the same result, so the
   * patient sees an explicit "no hay más fechas" notice rather than a
   * silent loop back to page 1. */
  plainTextBefore?: string;
}

/** Runs one turn of the WhatsApp booking conversation for a given business +
 * patient phone number, given the raw inbound message body. Never throws for
 * ordinary flow outcomes — always returns a reply string. */
export async function handleIncomingMessage(
  businessSlug: string,
  businessId: string,
  phoneNumber: string,
  body: string,
  buttonPayload: string | null = null,
  listId: string | null = null
): Promise<ConversationResult> {
  const data = await getPublicBookingData(businessSlug);
  if (!data) {
    return { reply: "Lo sentimos, este negocio no está disponible en este momento." };
  }

  const session = await loadOrResetSession(businessId, phoneNumber);

  switch (session.state) {
    case "awaiting_service":
      return awaitingService(session, businessSlug, data.services, body, listId);
    case "awaiting_date":
      return awaitingDate(session, businessSlug, data.services, body, listId);
    case "awaiting_time":
      return awaitingTime(session, businessSlug, data.services, body, listId);
    case "awaiting_confirmation":
      return awaitingConfirmation(session, businessSlug, data.business.id, data.services, body, buttonPayload);
    default:
      // completed / expired should never reach here — loadOrResetSession
      // resets those to awaiting_service before returning.
      return awaitingService(session, businessSlug, data.services, "", null);
  }
}

function listServicesMessage(services: { id: string; name: string; duration_min: number }[]): string {
  const lines = services.map((s, i) => `${i + 1}. ${s.name}`);
  return [
    "¡Hola! 👋 ¿Qué servicio te gustaría reservar? Responde con el número:",
    ...lines,
  ].join("\n");
}

async function awaitingService(
  session: WhatsappSessionRow,
  slug: string,
  services: { id: string; name: string; duration_min: number }[],
  body: string,
  listId: string | null
): Promise<ConversationResult> {
  // Native whatsapp/card LIST row tap: ListId carries the exact selected
  // service id directly, no digit-matching needed. Falls back to the
  // legacy numbered-text digit reply for a stale session predating this
  // upgrade, or a client that doesn't render list messages.
  const listServiceId = parseServiceListId(listId);
  const service = listServiceId
    ? services.find((s) => s.id === listServiceId)
    : (() => {
        const choice = parseChoice(body);
        return choice !== null && choice >= 1 && choice <= services.length
          ? services[choice - 1]
          : undefined;
      })();

  if (!service) {
    return { reply: listServicesMessage(services), serviceListOptions: services };
  }

  await updateSession(session.id, {
    state: "awaiting_date",
    selected_service_id: service.id,
    date_page: 0, // fresh service selection -> fresh date-list pagination
  });

  const page = await buildDateOptionsReply(slug, service.id, 0);
  return {
    reply: page.reply,
    dateListOptions:
      page.dates.length > 0
        ? {
            serviceName: service.name,
            dates: page.dates.map((d) => ({ id: d, label: formatDateLabel(d) })),
            hasMore: page.hasMore,
          }
        : undefined,
  };
}

interface DatePageResult {
  reply: string;
  /** This page's real dates (up to DATE_PAGE_SIZE), empty on failure, no
   * open dates at all, or an out-of-range page request. */
  dates: string[];
  /** Whether a further page exists beyond this one. */
  hasMore: boolean;
  /** True only when `page` was requested beyond the last real page (i.e.
   * there is nothing at all to show for it) — the caller must NOT render
   * this as a date list; it should show the "no hay más fechas" notice and
   * fall back to page 0 instead. */
  pageInvalid: boolean;
}

/** Fetches ALL open dates within the DAYS_AHEAD lookahead window in one call
 * (not re-queried per page), sorted ascending, and returns the requested
 * DATE_PAGE_SIZE-sized page plus pagination metadata. */
async function buildDateOptionsReply(slug: string, serviceId: string, page: number): Promise<DatePageResult> {
  const from = todayInBusinessTz();
  const to = addDays(from, DAYS_AHEAD);
  const result = await getAvailableSlots({
    slug,
    serviceId,
    providerId: null,
    dateFrom: from,
    dateTo: to,
  });

  if (!result.ok) {
    return {
      reply: "No se pudo comprobar la disponibilidad. Inténtalo de nuevo más tarde.",
      dates: [],
      hasMore: false,
      pageInvalid: false,
    };
  }

  const allOpenDates = Object.entries(result.slotsByDate)
    .filter(([, slots]) => slots.length > 0)
    .map(([date]) => date)
    .sort();

  if (allOpenDates.length === 0) {
    return {
      reply: "No hay fechas disponibles próximamente. Vuelve a intentarlo más adelante.",
      dates: [],
      hasMore: false,
      pageInvalid: false,
    };
  }

  const totalPages = Math.ceil(allOpenDates.length / DATE_PAGE_SIZE);
  if (page >= totalPages) {
    return { reply: "", dates: [], hasMore: false, pageInvalid: true };
  }

  const pageDates = allOpenDates.slice(page * DATE_PAGE_SIZE, page * DATE_PAGE_SIZE + DATE_PAGE_SIZE);
  const hasMore = page + 1 < totalPages;

  const lines = pageDates.map((d, i) => `${i + 1}. ${formatDateLabel(d)}`);
  if (hasMore) lines.push(`${pageDates.length + 1}. Ver más fechas`);

  return {
    reply: ["¿Qué día prefieres? Responde con el número:", ...lines].join("\n"),
    dates: pageDates,
    hasMore,
    pageInvalid: false,
  };
}

async function awaitingDate(
  session: WhatsappSessionRow,
  slug: string,
  services: { id: string; name: string; duration_min: number }[],
  body: string,
  listId: string | null
): Promise<ConversationResult> {
  const serviceId = session.selected_service_id;
  if (!serviceId) {
    await resetSession(session.business_id, session.phone_number);
    return { reply: listServicesMessage(services), serviceListOptions: services };
  }
  const service = services.find((s) => s.id === serviceId);
  const currentPage = session.date_page ?? 0;

  const page = await buildDateOptionsReply(slug, serviceId, currentPage);

  // Native whatsapp/card LIST row tap: ListId carries the raw date string
  // directly (see parseDateListId), or the "more" sentinel for the
  // pagination row (see DATE_LIST_MORE_ROW_ID). Falls back to the legacy
  // numbered-text digit reply for a stale session, a client that doesn't
  // render list messages, or a tap on one of the template's unused filler
  // rows (which never matches a real `dates` entry).
  const listDate = parseDateListId(listId);

  // "Ver más fechas" detection — a list-row tap on the sentinel id, or (no
  // list tap at all) the legacy numbered-text fallback digit, which is
  // always the row right after this page's real dates whenever a next page
  // exists (see buildDateOptionsReply's `lines.push` above).
  const moreDigit = page.hasMore ? page.dates.length + 1 : null;
  const isMoreTap =
    listDate === DATE_LIST_MORE_ROW_ID || (!listDate && moreDigit !== null && parseChoice(body) === moreDigit);

  if (isMoreTap) {
    const nextPage = currentPage + 1;
    const next = await buildDateOptionsReply(slug, serviceId, nextPage);

    if (next.pageInvalid) {
      // Requested a page beyond the last one — explicit notice, then reset
      // and show page 1 again (never a silent loop, never a dead end).
      await updateSession(session.id, { date_page: 0 });
      const first = await buildDateOptionsReply(slug, serviceId, 0);
      return {
        reply: first.reply,
        plainTextBefore: "No hay más fechas disponibles.",
        dateListOptions:
          first.dates.length > 0
            ? {
                serviceName: service?.name ?? "",
                dates: first.dates.map((d) => ({ id: d, label: formatDateLabel(d) })),
                hasMore: first.hasMore,
              }
            : undefined,
      };
    }

    await updateSession(session.id, { date_page: nextPage });
    return {
      reply: next.reply,
      dateListOptions:
        next.dates.length > 0
          ? {
              serviceName: service?.name ?? "",
              dates: next.dates.map((d) => ({ id: d, label: formatDateLabel(d) })),
              hasMore: next.hasMore,
            }
          : undefined,
    };
  }

  const selectedDate =
    listDate && page.dates.includes(listDate)
      ? listDate
      : (() => {
          const choice = parseChoice(body);
          return choice !== null && choice >= 1 && choice <= page.dates.length ? page.dates[choice - 1] : null;
        })();

  if (!selectedDate) {
    return {
      reply: page.reply,
      dateListOptions:
        page.dates.length > 0
          ? {
              serviceName: service?.name ?? "",
              dates: page.dates.map((d) => ({ id: d, label: formatDateLabel(d) })),
              hasMore: page.hasMore,
            }
          : undefined,
    };
  }

  await updateSession(session.id, { state: "awaiting_time", selected_date: selectedDate });

  const timesReply = await buildTimeOptionsReply(slug, serviceId, selectedDate);
  return {
    reply: timesReply.reply,
    timeListOptions:
      timesReply.slots.length > 0
        ? {
            dateLabel: formatDateLabel(selectedDate),
            slots: timesReply.slots.map((s) => ({ id: s.startIso, label: s.label })),
          }
        : undefined,
  };
}

async function buildTimeOptionsReply(
  slug: string,
  serviceId: string,
  date: string
): Promise<{ reply: string; slots: SlotDTO[] }> {
  const result = await getAvailableSlots({
    slug,
    serviceId,
    providerId: null,
    dateFrom: date,
    dateTo: date,
  });

  if (!result.ok) {
    return { reply: "No se pudo comprobar la disponibilidad. Inténtalo de nuevo más tarde.", slots: [] };
  }

  const slots = (result.slotsByDate[date] ?? []).slice(0, MAX_TIME_OPTIONS);
  if (slots.length === 0) {
    return {
      reply: "Ya no quedan huecos ese día. Responde con cualquier mensaje para elegir otra fecha.",
      slots: [],
    };
  }

  const lines = slots.map((s, i) => `${i + 1}. ${s.label}`);
  return { reply: ["¿A qué hora? Responde con el número:", ...lines].join("\n"), slots };
}

async function awaitingTime(
  session: WhatsappSessionRow,
  slug: string,
  services: { id: string; name: string; duration_min: number }[],
  body: string,
  listId: string | null
): Promise<ConversationResult> {
  const serviceId = session.selected_service_id;
  const date = session.selected_date;
  if (!serviceId || !date) {
    await resetSession(session.business_id, session.phone_number);
    return { reply: listServicesMessage(services), serviceListOptions: services };
  }

  const { reply, slots } = await buildTimeOptionsReply(slug, serviceId, date);

  if (slots.length === 0) {
    // No slots left for this date at all — bounce back to date selection,
    // keeping the patient's current date_page (this isn't a fresh service
    // selection or a session reset, so pagination state is preserved).
    await updateSession(session.id, { state: "awaiting_date", selected_date: null });
    const dateReply = await buildDateOptionsReply(slug, serviceId, session.date_page ?? 0);
    const service = services.find((s) => s.id === serviceId);
    return {
      reply: dateReply.reply,
      dateListOptions:
        dateReply.dates.length > 0
          ? {
              serviceName: service?.name ?? "",
              dates: dateReply.dates.map((d) => ({ id: d, label: formatDateLabel(d) })),
              hasMore: dateReply.hasMore,
            }
          : undefined,
    };
  }

  // Native whatsapp/card LIST row tap: ListId carries the slot's startIso
  // directly (see parseTimeListId). Falls back to the legacy numbered-text
  // digit reply, same pattern as awaitingDate above.
  const listTime = parseTimeListId(listId);
  const slot =
    (listTime ? slots.find((s) => s.startIso === listTime) : undefined) ??
    (() => {
      const choice = parseChoice(body);
      return choice !== null && choice >= 1 && choice <= slots.length ? slots[choice - 1] : undefined;
    })();

  if (!slot) {
    return {
      reply,
      timeListOptions: { dateLabel: formatDateLabel(date), slots: slots.map((s) => ({ id: s.startIso, label: s.label })) },
    };
  }

  await updateSession(session.id, { state: "awaiting_confirmation", selected_time: slot.startIso });

  const service = services.find((s) => s.id === serviceId);
  const summary = [
    "Resumen de tu reserva:",
    `Servicio: ${service?.name ?? ""}`,
    `Fecha: ${formatDateLabel(date)}`,
    `Hora: ${slot.label}`,
  ].join("\n");
  // Sent as a native twilio/quick-reply message (Confirm/Cancel buttons) by
  // the webhook route — `reply` doubles as the {{1}} body text for that
  // template and as a plain-text fallback value.
  return { reply: summary, quickReplySummary: summary };
}

async function awaitingConfirmation(
  session: WhatsappSessionRow,
  slug: string,
  businessId: string,
  services: { id: string; name: string; duration_min: number }[],
  body: string,
  buttonPayload: string | null
): Promise<ConversationResult> {
  const serviceId = session.selected_service_id;
  const startIso = session.selected_time; // stored as full ISO in selected_time, see awaitingTime above
  if (!serviceId || !startIso) {
    await resetSession(businessId, session.phone_number);
    return { reply: listServicesMessage(services), serviceListOptions: services };
  }

  const choice = parseConfirmChoice(body, buttonPayload);

  if (choice === "cancel") {
    // Cancel -> reset to awaiting_service, no resource was ever held
    // (hold-mechanics-correction, workflows/whatsapp-booking.md).
    await resetSession(businessId, session.phone_number);
    return { reply: listServicesMessage(services), serviceListOptions: services };
  }

  if (choice !== "confirm") {
    const service = services.find((s) => s.id === serviceId);
    const summary = [
      "Resumen de tu reserva:",
      `Servicio: ${service?.name ?? ""}`,
    ].join("\n");
    return { reply: summary, quickReplySummary: summary };
  }

  // Confirm -> create the kalendar_bookings row directly (same insert path
  // as a guest website booking, via submitBookingInternal). Guest identity
  // is minimal here (no name/email collected over WhatsApp in v1) — phone
  // number is the only identifying info we reliably have.
  const supabase = await createClient();
  const { data: businessRow } = await supabase
    .from("kalendar_businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();

  const result = await submitBookingInternal({
    slug,
    serviceId,
    providerId: null,
    startIso,
    clientName: `WhatsApp ${phoneDisplay(session.phone_number)}`,
    clientEmail: `${session.phone_number.replace(/[^0-9]/g, "")}@whatsapp.kalendar.dev`,
    clientPhone: session.phone_number,
    guestLocale: "es",
    matchByPhone: true,
  });

  if (!result.ok) {
    // Unique-index conflict (slot taken by someone else in the meantime) or
    // any other failure -> re-prompt with fresh times for the same date,
    // stay in awaiting_time (per conversation-flow step 5's race handling).
    await updateSession(session.id, { state: "awaiting_time", selected_time: null });
    const date = session.selected_date;
    if (date) {
      const retry = await buildTimeOptionsReply(slug, serviceId, date);
      return {
        reply: `${result.error} Elige otro horario:\n${retry.reply}`,
      };
    }
    return { reply: result.error };
  }

  await updateSession(session.id, { state: "completed" });
  return {
    reply: `¡Reserva confirmada! Te esperamos en ${businessRow?.name ?? "el negocio"}. Gracias por reservar por WhatsApp.`,
  };
}

function phoneDisplay(phone: string): string {
  return phone.replace(/^whatsapp:/, "");
}
