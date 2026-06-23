import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Btn } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <Logo size={20} />

        <nav className="hidden items-center gap-8 text-[14.5px] font-medium text-ink-soft md:flex">
          <a href="#como-funciona" className="transition-colors hover:text-ink">
            Cómo funciona
          </a>
          <a href="#para-quien" className="transition-colors hover:text-ink">
            Para quién es
          </a>
          <a href="#precios" className="transition-colors hover:text-ink">
            Precios
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {/* TODO: enlazar a una página de inicio de sesión dedicada cuando exista el panel */}
          <Link
            href="/onboarding"
            className="hidden text-[14.5px] font-semibold text-ink-soft transition-colors hover:text-ink sm:inline"
          >
            Iniciar sesión
          </Link>
          <Link href="/onboarding">
            <Btn size="sm">Empezar gratis</Btn>
          </Link>
        </div>
      </div>
    </header>
  );
}
