import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { Btn } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export default async function PanelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/onboarding");
  }

  const { data: negocio } = await supabase
    .from("businesses")
    .select("nombre, slug")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-[480px] rounded-2xl border border-line bg-surface p-8 text-center shadow-[0_12px_40px_rgba(15,31,46,.09)]">
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
  );
}
