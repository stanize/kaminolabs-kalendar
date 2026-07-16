import { Icon } from "@/components/ui/icon";
import { Btn } from "@/components/ui/button";
import Link from "next/link";
import { requireSession } from "@/lib/auth-session";
import { getSetupProgress } from "@/lib/business/data";
import { getPreferredName } from "@/lib/account/data";
import { bookingPath, bookingUrlDisplay } from "@/lib/business/booking-url";
import { SetupCompleteBanner } from "@/components/panel/setup-complete-banner";
import { EditableGreetingName } from "@/components/panel/editable-greeting-name";
import { getPanelShellServerDictionary, getLocale } from "@/lib/i18n/server";
import { getTodayStats } from "@/lib/booking/owner-data";
import { getCalendarDictionary } from "@/lib/i18n/dictionaries/calendar";
import { TodayStatsWidget } from "@/components/panel/today-stats-widget";

export default async function PanelHomePage() {
  const session = await requireSession();
  const { business, hasServices, hasActiveHours, hasTeam } = await getSetupProgress(
    session.user.id
  );

  const { dict } = await getPanelShellServerDictionary();
  const h = dict.home;

  const locale = await getLocale();
  const { totalToday } = await getTodayStats(session.user.id);
  const calendarDict = getCalendarDictionary(locale);

  const preferredName = await getPreferredName(session.user.id);
  const firstName = preferredName || session.user.name?.split(" ")[0] || "";

  const setupItems = [
    {
      id:    "business",
      label: h.step1Label,
      sub:   h.step1Sub,
      done:  !!business,
      href:  "/panel/business?from=home",
      icon:  "building",
    },
    {
      id:    "services",
      label: h.step2Label,
      sub:   h.step2Sub,
      done:  hasServices,
      href:  "/panel/services?from=home",
      icon:  "sparkles",
    },
    {
      id:    "team",
      label: h.step3Label,
      sub:   h.step3Sub,
      done:  hasTeam,
      href:  "/panel/team?from=home",
      icon:  "users",
    },
    {
      id:    "schedule",
      label: h.step4Label,
      sub:   h.step4Sub,
      done:  hasActiveHours,
      href:  "/panel/availability?from=home",
      icon:  "clock",
    },
  ];

  const completedCount = setupItems.filter((i) => i.done).length;
  const percentage     = Math.round((completedCount / setupItems.length) * 100);
  const allDone        = completedCount === setupItems.length;

  const quickLinks = [
    { label: dict.sidebar.services,      href: "/panel/services",      icon: "sparkles" },
    { label: dict.sidebar.availability, href: "/panel/availability", icon: "clock" },
    { label: dict.sidebar.team,         href: "/panel/team",         icon: "users" },
    { label: dict.sidebar.settings,        href: "/panel/settings",        icon: "settings" },
  ];

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-8">
        <h1 className="mb-1 text-[24px]">
          <EditableGreetingName
            initialName={firstName}
            prefix={h.greetingPrefix}
            fallback={h.greetingFallback}
            editHint={h.greetingEditHint}
            errRequired={h.greetingErrRequired}
            errTooLong={h.greetingErrTooLong}
            errSaveFailed={h.greetingErrSaveFailed}
          />
        </h1>
        <p className="text-[15px] text-ink-soft">{h.subtitle}</p>
      </div>

      {!allDone && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[17px]">{h.setupCardTitle}</h2>
            <span className="text-[14px] font-semibold text-ink-soft">{percentage}%</span>
          </div>
          <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex flex-col gap-2">
            {setupItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3.5 rounded-xl border border-line px-4 py-3.5 transition-all duration-150 hover:border-brand-line hover:bg-brand-weak"
              >
                <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${item.done ? "bg-brand text-white" : "border-2 border-line bg-surface"}`}>
                  {item.done && <Icon name="check" size={13} strokeWidth={2.5} />}
                </div>
                <div className="flex-1">
                  <p className={`text-[14px] font-semibold ${item.done ? "text-ink-soft" : "text-ink"}`}>
                    {item.label}
                  </p>
                  <p className="text-[12.5px] text-ink-soft">{item.sub}</p>
                </div>
                {!item.done && <Icon name="arrowRight" size={16} className="shrink-0 text-ink-soft" />}
              </Link>
            ))}
          </div>
        </div>
      )}

      {allDone && !business?.onboarding_completed_at && (
        <div className="mb-6">
          <SetupCompleteBanner
            title={h.setupComplete}
            subtitle={h.setupCompleteSub}
          />
        </div>
      )}

      {/* Widget tile grid — Hoy/Citas comes first (top-left); more widgets
          get added here later, each as its own tile alongside it. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <TodayStatsWidget totalToday={totalToday} dict={calendarDict.widget} />

        {business?.slug && (
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="mb-1 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
              {h.bookingPageTitle}
            </p>
            <p className="mb-3 truncate text-[14px] font-semibold text-ink">
              {bookingUrlDisplay(business.slug)}
            </p>
            <Link href={bookingPath(business.slug)} target="_blank">
              <Btn variant="outline" size="sm" full>
                <Icon name="externalLink" size={14} /> {h.viewPage}
              </Btn>
            </Link>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <p className="mb-1 text-[12px] font-bold uppercase tracking-[.05em] text-ink-soft">
            {h.quickAccess}
          </p>
          <div className="mt-3 flex flex-col gap-1">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Icon name={item.icon} size={15} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
