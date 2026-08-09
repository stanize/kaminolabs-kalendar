"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const navLinkClass =
  "text-[13px] font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-50";

export function PatientLogoutLink() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={signingOut} className={navLinkClass}>
      {signingOut ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
