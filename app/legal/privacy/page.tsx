import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad · Kalendar",
};

export default function PrivacyPolicyPage() {
  const markdown = fs.readFileSync(path.join(process.cwd(), "content/legal/privacy.md"), "utf-8");
  return <LegalPage title="Política de privacidad" markdown={markdown} />;
}
