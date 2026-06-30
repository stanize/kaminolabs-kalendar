import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { getBookingByToken } from "@/lib/actions/booking";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { getBookingResultDictionary } from "@/lib/i18n/dictionaries/booking-result";

export default async function CancelBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getBookingByToken(token);

  const notFound = !result.ok;
  const already = result.ok && result.booking.status === "cancelled";
  const tooLate = result.ok && !["pending_confirmation", "confirmed"].includes(result.booking.status);

  // The page's own language follows the booking's stored guest_locale — no
  // switcher here, since this page is reached only via a one-time email link.
  const guestLocale = result.ok ? result.booking.guestLocale : "es";
  const dict = getBookingResultDictionary(guestLocale).cancel;

  return (
    <div className="grid min-h-screen place-items-center bg-surface-2 px-5 py-16">
      <div className="w-full max-w-[460px] rounded-2xl border border-line bg-surface p-8 text-center shadow-[0_12px_40px_rgba(15,31,46,.08)]">
        <div className="mb-6 flex justify-center">
          <Logo size={18} />
        </div>

        {notFound && (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="x" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">{dict.notFoundTitle}</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">{result.error}</p>
          </>
        )}

        {result.ok && already && (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="check" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">{dict.alreadyTitle}</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">{dict.alreadyBody}</p>
          </>
        )}

        {result.ok && !already && tooLate && (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="x" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">{dict.tooLateTitle}</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">{dict.tooLateBody}</p>
          </>
        )}

        {result.ok && !already && !tooLate && (
          <>
            <h1 className="mb-1.5 text-[22px]">{dict.confirmTitle}</h1>
            <p className="m-0 mb-5 text-[14.5px] text-ink-soft">
              {result.booking.businessName}
            </p>
            <div className="mb-6 rounded-xl bg-surface-2 px-4 py-3 text-left text-[14px]">
              <p className="font-semibold text-ink">{result.booking.serviceName}</p>
              <p className="capitalize text-ink-soft">{result.booking.whenLabel}</p>
              {result.booking.providerName && (
                <p className="text-ink-soft">{result.booking.providerName}</p>
              )}
            </div>
            <CancelBookingButton token={token} dict={dict} />
          </>
        )}
      </div>
    </div>
  );
}
