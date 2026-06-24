import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Kalendar",
};

export default async function LoginPage() {
  // Already logged in — go straight to panel
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && session?.session?.id) {
      redirect("/panel");
    }
  } catch {
    // No session — show login
  }

  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={22} />
          <div>
            <h1 className="text-[24px]">Bienvenido de nuevo</h1>
            <p className="mt-1 text-[15px] text-ink-soft">Inicia sesión en tu cuenta de Kalendar.</p>
          </div>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-[13px] text-ink-soft">
          ¿No tienes cuenta?{" "}
          <Link href="/onboarding" className="font-medium text-brand hover:underline">
            Crear una gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
