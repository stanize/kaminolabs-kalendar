import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  // Use the service role key server-side so writes bypass RLS.
  // Better Auth manages auth — there is no Supabase JWT in the request context,
  // so RLS policies that check jwt.sub would always fail with the anon key.
  // This client is only ever instantiated in Server Components and Server Actions
  // (never shipped to the browser), so using the service role key is safe.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore, middleware handles refresh.
          }
        },
      },
    }
  );
}
