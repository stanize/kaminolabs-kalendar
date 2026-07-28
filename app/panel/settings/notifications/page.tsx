import { getLocale } from "@/lib/i18n/server";
import { getSettingsDictionary } from "@/lib/i18n/dictionaries/settings";

export default async function NotificationsSettingsPage() {
  const locale = await getLocale();
  const dict = getSettingsDictionary(locale);

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold text-ink">{dict.placeholder.title}</h2>
      <p className="mt-2 text-sm text-ink-soft">{dict.placeholder.body}</p>
    </div>
  );
}
