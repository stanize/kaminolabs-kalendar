import { Logo } from "@/components/ui/logo";

/**
 * Next.js renders this automatically (App Router's loading.tsx convention)
 * while /panel and its nested routes are still fetching server data — no
 * custom navigation/JS needed. This is specifically what closes the "login
 * succeeds, then the screen just sits there for a beat" gap: previously
 * nothing rendered during that window because there was no loading.tsx for
 * this segment at all, so the browser showed the previous (blank/login)
 * page until /panel's server component fully resolved.
 */
export default function PanelLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-2">
      <div className="flex flex-col items-center gap-4">
        <Logo size={28} showText={false} />
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    </div>
  );
}
