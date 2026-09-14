import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Términos de servicio · Kalendar",
};

export default function TermsOfServicePage() {
  const markdown = fs.readFileSync(path.join(process.cwd(), "content/legal/terms.md"), "utf-8");
  return <LegalPage title="Términos de servicio" markdown={markdown} />;
}
