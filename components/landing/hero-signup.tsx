"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface HeroSignupProps {
  emailPlaceholder: string;
  ctaLabel: string;
}

// Combined email input + CTA rendered as a single pill (GitHub-style hero
// control). Submitting sends the visitor to /onboarding with the email
// prefilled via query param — the onboarding form reads it and fills the
// email field in the register view.
export function HeroSignup({ emailPlaceholder, ctaLabel }: HeroSignupProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function handleSubmit() {
    const trimmed = email.trim();
    router.push(trimmed ? `/signup?email=${encodeURIComponent(trimmed)}` : "/signup");
  }

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-2 rounded-2xl border border-line bg-surface p-1 sm:flex-row sm:items-center sm:gap-1 sm:rounded-full">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder={emailPlaceholder}
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[14px] text-ink placeholder:text-ink-soft focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full shrink-0 whitespace-nowrap rounded-xl bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:brightness-[1.06] sm:w-auto sm:rounded-full"
      >
        {ctaLabel}
      </button>
    </div>
  );
}
