import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // In the browser, route auth through our own domain proxy (Next.js rewrite)
  // so the Google OAuth consent screen shows kalendar.kaminolabs.dev.
  // On the server, keep using the direct Supabase URL.
  const supabaseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
      },
    }
  );
}
