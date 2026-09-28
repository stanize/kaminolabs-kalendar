import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPublicBookingData } from "@/lib/booking/data";
import { formatBusinessAddress, resolvePublicSlugRouting } from "@/lib/business/data";
import { WEEKDAY_ORDER } from "@/lib/availability/constants";
import { BookingPageShell } from "@/components/booking/booking-page-shell";
import { auth } from "@/lib/auth";
import { hasRole } from "@/lib/roles/data";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/config";

// INTERIM: the page always starts in Spanish. FUTURE: once kalendar_businesses
// has a `language` field, read it here (e.g. business.language) and use it as
// the initial locale instead. See memory for the planned Negocio field expansion.
const INITIAL_LOCALE: Locale = "es";

export default async function BusinessPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const routing = await resolvePublicSlugRouting(slug);
  if (routing.kind === "not_found") notFound();
  if (routing.kind === "retired") return <RetiredSlugMessage />;
  if (routing.kind === "inactive") return <SlugInactiveMessage />;

  const data = await getPublicBookingData(slug);
  if (!data) notFound();

  const { business, services, hoursByDay, members } = data;
  const openDays = WEEKDAY_ORDER.filter((d) => (hoursByDay[d]?.length ?? 0) > 0);
  const isTeam = business.team_mode === "team";

  // Check if there's an authenticated patient session. If so, pass their
  // profile down so the wizard can skip the auth gate and book immediately.
  let initialPatient: { id: string; name: string; email: string } | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      const isPatient = await hasRole(session.user.id, "patient");
      if (isPatient) {
        const supabase = await createClient();
        const { data: patient } = await supabase
          .from("kalendar_patients")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (patient) {
          initialPatient = {
            id: patient.id,
            name: session.user.name ?? "",
            email: session.user.email ?? "",
          };
        }
      }
    }
  } catch {
    // No session or error — treat as unauthenticated guest.
  }

  // Single-line display address for the booking page header — replaces the
  // business-type/city line, which isn't very useful to a patient deciding
  // whether to book.
  const addressLine = formatBusinessAddress(business);

  return (
    <BookingPageShell
      slug={slug}
      business={{
        name: business.name,
        address: addressLine,
        brand_color: business.brand_color,
        logo_url: business.logo_url,
      }}
      services={services}
      members={members}
      openDays={openDays}
      bookingWindowMonths={business.booking_window_months}
      isTeam={isTeam}
      initialLocale={INITIAL_LOCALE}
      initialPatient={initialPatient}
    />
  );
}

// ── Slug-lifecycle messaging (admin-portal-tools.md customer-dashboard,
// section 3 and section 4's slug_active flag) — deliberately distinct copy
// on purpose: "retired" is a link that's gone for good (old bookmark/
// business-card), "inactive" is a page that may come back (non-payment
// enforcement's public-page-down tier), so telling a visitor the link
// "doesn't exist" there would be actively misleading.

function MessagePage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-3 text-xl font-semibold text-ink">{title}</h1>
      <p className="text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function RetiredSlugMessage() {
  return (
    <MessagePage
      title="Este enlace ya no está activo"
      body="El enlace de reserva al que has accedido ya no corresponde a ningún negocio. Si lo tienes guardado de una tarjeta o publicación antigua, pide al negocio su enlace actual."
    />
  );
}

function SlugInactiveMessage() {
  return (
    <MessagePage
      title="Este negocio no está disponible temporalmente"
      body="La página de reservas de este negocio está temporalmente fuera de servicio. Vuelve a intentarlo más adelante."
    />
  );
}
