import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { confirmBooking } from "@/lib/actions/booking";
import { getBookingResultDictionary } from "@/lib/i18n/dictionaries/booking-result";

export default async function ConfirmBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await confirmBooking(token);

  const success = result.ok;
  const alreadyConfirmed = result.ok && result.status === "already";
  // The page's own language follows the booking's stored guest_locale (the
  // language the guest was using when they originally booked) — there is no
  // switcher here, since this page is reached only via a one-time email link.
  const dict = getBookingResultDictionary(result.ok ? result.guestLocale : "es").confirm;

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2 px-5 py-16">
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-surface p-8 text-center shadow-[0_12px_40px_rgba(15,31,46,.08)]">
        <div className="mb-6 flex justify-center">
          <Logo size={18} />
        </div>

        {success ? (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-brand-weak text-brand">
              <Icon name="check" size={26} strokeWidth={2.5} />
            </div>
            <h1 className="mb-1.5 text-[22px]">
              {alreadyConfirmed ? dict.alreadyTitle : dict.successTitle}
            </h1>
            <p className="m-0 text-[14.5px] text-ink-soft">
              {alreadyConfirmed ? dict.alreadyBody : dict.successBody}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="x" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">{dict.failTitle}</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">{result.error}</p>
          </>
        )}
      </div>
    </div>
  );
}
