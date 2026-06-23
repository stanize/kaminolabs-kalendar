import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kalendar — Software de reservas para profesionales",
  description:
    "Kalendar es el software de reservas online para psicólogos, nutricionistas, fisioterapeutas y clínicas. Crea tu página de reservas gratis en menos de 2 minutos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${bricolage.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-bg font-ui text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
