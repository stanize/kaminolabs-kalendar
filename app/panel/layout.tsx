import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PanelSidebar } from "@/components/panel/sidebar";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/onboarding");

  return (
    <div className="flex min-h-screen bg-bg">
      <PanelSidebar user={session.user} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
