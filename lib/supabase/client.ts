import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
        // Route auth calls through our Next.js rewrite proxy so the Google
        // OAuth consent screen shows kalendar.kaminolabs.dev instead of
        // the raw Supabase project URL.
        ...(typeof window !== "undefined" && {
          url: `${window.location.origin}/auth/v1`,
        }),
      },
    }
  );
}
