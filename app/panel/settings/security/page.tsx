import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { getSettingsDictionary } from "@/lib/i18n/dictionaries/settings";

export default async function SecuritySettingsPage() {
  const locale = await getLocale();
  const dict = getSettingsDictionary(locale);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold text-ink">{dict.placeholder.title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{dict.placeholder.body}</p>
      </div>

      {/* Legal links (2026-09) — real/functional, unlike the placeholder
          above (which is specifically about security FEATURES not built
          yet, e.g. password change / 2FA). Kept as a separate section so
          this doesn't read as "the whole tab is a stub". returnTo brings
          the visitor back here rather than to legal-page.tsx's "/"
          default — same pattern as every other link site
          (sanitizeReturnTo, components/legal/legal-page.tsx). Plain
          in-page nav, not a new tab: unlike the sign-up/booking flows,
          there's no in-progress form here to lose by navigating away. */}
      <div className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-sm font-semibold text-ink">{dict.legal.title}</h2>
        <div className="mt-3 flex flex-col gap-2">
          <Link href="/legal/privacy?returnTo=%2Fpanel%2Fsettings%2Fsecurity" className="text-sm text-brand underline hover:text-brand-ink">
            {dict.legal.privacy}
          </Link>
          <Link href="/legal/terms?returnTo=%2Fpanel%2Fsettings%2Fsecurity" className="text-sm text-brand underline hover:text-brand-ink">
            {dict.legal.terms}
          </Link>
        </div>
      </div>
    </div>
  );
}
