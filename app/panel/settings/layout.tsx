import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-session";
import { getBusinessForUser } from "@/lib/business/data";
import { getLocale } from "@/lib/i18n/server";
import { getSettingsDictionary } from "@/lib/i18n/dictionaries/settings";
import { SettingsTabs } from "@/components/panel/settings-tabs";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const business = await getBusinessForUser(session.user.id);

  if (!business) {
    redirect("/panel/business?from=home");
  }

  const locale = await getLocale();
  const dict = getSettingsDictionary(locale);

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6">
        <h1 className="mb-1 text-[24px] text-ink">{dict.page.title}</h1>
        <p className="text-[15px] text-ink-soft">{dict.page.subtitle}</p>
      </div>

      <SettingsTabs dict={dict} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
