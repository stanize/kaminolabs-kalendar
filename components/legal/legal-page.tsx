import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Logo } from "@/components/ui/logo";

/**
 * Shared shell for /legal/privacy and /legal/terms — a minimal header
 * (logo + back-to-home, not the full marketing Navbar with its
 * how-it-works/pricing anchors, which don't belong on a legal subpage)
 * plus the markdown content itself, styled via targeted child selectors
 * since this app has no @tailwindcss/typography plugin installed.
 *
 * Content source (2026-09, legal-compliance.md): plain .md files under
 * content/legal/ — placeholder text until Arun uploads the
 * legally-reviewed final copy, at which point this is a content-only
 * swap, no changes needed here.
 */
export function LegalPage({ title, markdown }: { title: string; markdown: string }) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line/70 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[720px] items-center justify-between">
          <Link href="/">
            <Logo size={20} />
          </Link>
          <Link href="/" className="text-[13.5px] font-medium text-ink-soft transition-colors hover:text-ink">
            ← Volver al inicio
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
