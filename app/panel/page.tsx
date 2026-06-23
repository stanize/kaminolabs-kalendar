import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";

export default async function PanelPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/onboarding");

  const supabase = await createClient();

  const { data: negocio } = await supabase
    .from("kalendar_businesses")
    .select("nombre, slug")
    .eq("owner_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("kalendar_profiles")
    .select("onboarding_skipped_at")
    .eq("id", session.user.id)
    .maybeSingle();

  const setupPendiente = !!profile?.onboarding_skipped_at;

  return (
    <div className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-[480px]">

        {/* Complete your setup banner */}
        {setupPendiente && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand-line bg-brand-weak px-4 py-4">
            <Icon name="sparkles" size={18} className="mt-0.5 shrink-0 text-brand" />
            <div className="flex-1">
              <p className="mb-1 text-[14px] font-semibold text-brand-ink">
                Completa la configuración de tu negocio
              </p>
              <p className="mb-2.5 text-[13px] leading-relaxed text-brand-ink/80">
                Añade tus servicios, horario y equipo para que tus clientes puedan reservar.
              </p>
              <Link href="/onboarding">
                <Btn size="sm">
                  Completar ahora <Icon name="arrowRight" size={15} />
                </Btn>
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-[0_12px_40px_rgba(15,31,46,.09)]">
          <div className="mb-5 flex justify-center">
            <Logo size={22} />
          </div>
          <h1 className="mb-2 text-[22px]">Tu panel está en construcción</h1>
          <p className="m-0 mb-6 text-[15px] text-ink-soft">
            Estamos terminando el panel de control completo. Mientras tanto, tu página de
            reservas ya está activa.
          </p>

          {negocio?.slug && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3">
              <Icon name="calendar" size={16} className="shrink-0 text-brand" />
              <span className="flex-1 truncate text-left text-[14.5px] font-semibold text-ink">
                kalendar.app/{negocio.slug}
              </span>
            </div>
          )}

          <Link href="/">
            <Btn variant="outline" full>
              Volver al inicio
            </Btn>
          </Link>
        </div>
      </div>
    </div>
  );
}
