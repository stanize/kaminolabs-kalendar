import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getLocale } from "@/lib/i18n/server";
import { getBusinessDictionary } from "@/lib/i18n/dictionaries/business";
import { getWhatsappConfig } from "@/lib/actions/whatsapp";
import { WhatsappSettings } from "@/components/panel/whatsapp-settings";

// Moved here from /panel/business (2026-10) — WhatsApp booking config is an
// app-wide setting, not part of the business profile form.
export default async function WhatsappSettingsPage() {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);
  if (!business) redirect("/panel/business?from=home");

  const locale = await getLocale();
  const dict = getBusinessDictionary(locale);
  const whatsappConfig = await getWhatsappConfig();

  return <WhatsappSettings initial={whatsappConfig} dict={dict.whatsapp} />;
}
