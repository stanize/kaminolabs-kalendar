import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Internal, read-only endpoint that serves the current contents of the two
 * schema SQL files. Exists solely so the admin portal's (temporary,
 * dev-phase-only) schema-reset feature can run whatever is CURRENTLY
 * deployed here, without storing a GitHub PAT or a manually-synced copy.
 *
 * IMPORTANT: this route has NO database credentials and cannot execute
 * anything — it only reads and returns file text. The actual execution
 * privilege (DIRECT_DATABASE_URL) lives solely in the admin portal's own
 * environment. Worst case if INTERNAL_SCHEMA_API_SECRET leaks: someone can
 * read table/column names — not touch the database.
 *
 * Remove this route (and INTERNAL_SCHEMA_API_SECRET) once the admin
 * portal's schema-reset feature is retired ahead of onboarding real
 * customers — see kaminolabs-kalendar-admin's schema-reset feature notes.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SCHEMA_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [betterAuth, main] = await Promise.all([
      readFile(
        path.join(process.cwd(), "supabase", "schema_better_auth_001.sql"),
        "utf-8"
      ),
      readFile(path.join(process.cwd(), "supabase", "schema_001.sql"), "utf-8"),
    ]);

    return NextResponse.json({ betterAuth, main });
  } catch {
    return NextResponse.json({ error: "Could not read schema files" }, { status: 500 });
  }
}
