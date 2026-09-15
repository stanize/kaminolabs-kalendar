import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Logo } from "@/components/ui/logo";

/**
 * Validates a `returnTo` query param before ever using it as a Link href —
 * must be an in-app relative path. Rejects anything that could send
 * someone off-site (a full URL, or a protocol-relative "//evil.com" which
 * looks like a path but isn't), falling back to null (caller then uses
 * LegalPage's own "/" default) rather than guessing.
 */
export function sanitizeReturnTo(raw: string | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return null;
  return raw;
}

/**
 * Shared shell for /legal/privacy and /legal/terms — a minimal header
 * (logo + back link, not the full marketing Navbar with its
 * how-it-works/pricing anchors, which don't belong on a legal subpage)
 * plus the markdown content itself, styled via targeted child selectors
 * since this app has no @tailwindcss/typography plugin installed.
 *
 * Content source (2026-09, legal-compliance.md): plain .md files under
 * content/legal/ — placeholder text until Arun uploads the
 * legally-reviewed final copy, at which point this is a content-only
 * swap, no changes needed here.
 *
 * backHref/backLabel (2026-09, bug fix): these pages are always opened in
 * a NEW TAB from every link site (clinic sign-up, patient sign-up,
 * mid-booking registration) — deliberately, so clicking the terms/privacy
 * link never loses whatever's already typed in that form. But that meant
 * a hardcoded "back to home" link inside this new tab always went to the
 * marketing landing page regardless of where you actually came from — not
 * useful if you arrived from, say, the patient sign-up page. Each legal
 * page route (app/legal/privacy/page.tsx, app/legal/terms/page.tsx) now
 * reads a `returnTo` query param the LINKING page supplies and passes it
 * through here; only the plain footer link (no query param, nothing to
 * return to but home) still gets the "/" + "Volver al inicio" default.
 */
export function LegalPage({
  title,
  markdown,
  backHref = "/",
  backLabel = "← Volver al inicio",
}: {
  title: string;
  markdown: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line/70 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[720px] items-center justify-between">
          <Link href="/">
            <Logo size={20} />
          </Link>
          <Link href={backHref} className="text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink">
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-12 sm:px-8 sm:py-16">
        <h1 className="text-[26px] leading-tight sm:text-[30px]">{title}</h1>
        <div
          className="
            mt-8 text-[15px] leading-[1.7] text-ink-soft
            [&_h1]:mt-8 [&_h1]:text-[19px] [&_h1]:font-semibold [&_h1]:text-ink
            [&_h2]:mt-8 [&_h2]:text-[19px] [&_h2]:font-semibold [&_h2]:text-ink
            [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0
            [&_p]:mt-4 [&_p:first-child]:mt-0
            [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5
            [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5
            [&_li]:mt-1.5
            [&_a]:text-brand [&_a]:underline [&_a]:hover:text-brand-ink
            [&_strong]:font-semibold [&_strong]:text-ink
          "
        >
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </main>
    </div>
  );
}
