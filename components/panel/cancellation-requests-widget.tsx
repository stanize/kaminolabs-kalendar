import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * Only meant to be rendered when count > 0 — callers should check that
 * before mounting this (see app/panel/page.tsx), so a clinic with nothing
 * to review never sees an empty/zero widget taking up space.
 */
export function CancellationRequestsWidget({ count }: { count: number }) {
  return (
    <Link
      href="/panel/calendar?tab=cancellations"
      className="flex items-center gap-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 transition-colors hover:border-rose-300"
    >
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
          <Icon name="bell" size={17} />
        </div>
        <div className="text-[13px] font-semibold uppercase tracking-[.03em] text-rose-800">
          Cancelaciones
        </div>
      </div>
      <div className="h-8 w-px bg-rose-200" />
      <div className="flex flex-col">
        <span className="text-[20px] font-bold leading-tight text-rose-900">{count}</span>
        <span className="text-[12px] text-rose-700">
          {count === 1 ? "solicitud pendiente" : "solicitudes pendientes"}
        </span>
      </div>
    </Link>
  );
}
