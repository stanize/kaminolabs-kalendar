// Better Auth handles OAuth callbacks at /api/auth/callback/google automatically.
// This route is kept as a safety redirect in case old links are used.
import { redirect } from "next/navigation";

export function GET() {
  redirect("/panel");
}
