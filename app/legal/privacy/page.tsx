import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalPage, sanitizeReturnTo } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad · Kalendar",
};

export default async function PrivacyPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const backHref = sanitizeReturnTo(returnTo);
  const markdown = fs.readFileSync(path.join(process.cwd(), "content/legal/privacy.md"), "utf-8");
  return (
    <LegalPage
      title="Política de privacidad"
      markdown={markdown}
      {...(backHref ? { backHref, backLabel: "← Volver" } : {})}
    />
  );
}
