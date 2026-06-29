import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { getBookingByToken } from "@/lib/actions/booking";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";

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
            <h1 className="mb-1.5 text-[22px]">Reserva no encontrada</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">{result.error}</p>
          </>
        )}

        {result.ok && already && (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="check" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">Reserva ya cancelada</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">Esta reserva ya estaba cancelada.</p>
          </>
        )}

        {result.ok && !already && tooLate && (
          <>
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-ink-soft">
              <Icon name="x" size={24} />
            </div>
            <h1 className="mb-1.5 text-[22px]">No se puede cancelar</h1>
            <p className="m-0 text-[14.5px] text-ink-soft">Esta reserva ya no se puede cancelar.</p>
          </>
        )}

        {result.ok && !already && !tooLate && (
          <>
            <h1 className="mb-1.5 text-[22px]">¿Cancelar tu reserva?</h1>
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
            <CancelBookingButton token={token} />
          </>
        )}
      </div>
    </div>
  );
}
