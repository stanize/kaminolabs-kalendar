import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { businessTypeLabel } from "@/lib/onboarding/data";
import type { BusinessType } from "@/lib/onboarding/types";

export default async function BusinessPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("kalendar_businesses")
    .select("nombre, tipo, ciudad")
    .eq("slug", slug)
    .maybeSingle();

  if (!business) notFound();

  return (
    <div className="grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-[480px] rounded-2xl border border-line bg-surface p-8 text-center shadow-[0_12px_40px_rgba(15,31,46,.09)]">
        <div className="mb-6 flex justify-center">
          <Logo size={20} />
        </div>
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-brand-weak text-brand">
          <Icon name="calendar" size={24} />
        </div>
        <h1 className="mb-1.5 text-[22px]">{business.nombre}</h1>
        <p className="m-0 mb-6 text-[14.5px] text-ink-soft">
          {businessTypeLabel(business.tipo as BusinessType)}
          {business.ciudad ? ` · ${business.ciudad}` : ""}
        </p>
        <p className="m-0 rounded-xl bg-surface-2 px-4 py-3 text-[14px] text-ink-soft">
          La página de reservas online de este negocio estará disponible muy pronto.
        </p>
      </div>
    </div>
  );
}
