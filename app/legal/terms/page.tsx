import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalPage, sanitizeReturnTo } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Términos de servicio · Kalendar",
};

export default async function TermsOfServicePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const backHref = sanitizeReturnTo(returnTo);
  const markdown = fs.readFileSync(path.join(process.cwd(), "content/legal/terms.md"), "utf-8");
  return (
    <LegalPage
      title="Términos de servicio"
      markdown={markdown}
      {...(backHref ? { backHref, backLabel: "← Volver" } : {})}
    />
  );
}
