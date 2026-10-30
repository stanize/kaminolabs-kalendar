import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";

/**
 * Internal, read-only endpoint that lists the current supabase/
 * schema_subset_*.sql files (name + contents) — powers the admin portal's
 * "Run migrations" tool, which lets Arun run a subset file against the live
 * DB without copying it out of GitHub by hand. Same shape/risk profile as
 * /api/internal/schema (that route serves the two full schema files for the
 * schema-reset tool): no database credentials here, read-only, can't
 * execute anything. The execution privilege (DIRECT_DATABASE_URL) lives
 * solely in the admin portal's own environment. Reuses that route's same
 * shared secret (INTERNAL_SCHEMA_API_SECRET) — identical trust boundary,
 * no reason for a second one.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SCHEMA_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const dir = path.join(process.cwd(), "supabase");
    const entries = await readdir(dir);
    const names = entries
      .filter((f) => /^schema_subset_\d+\.sql$/.test(f))
      .sort();

    const files = await Promise.all(
      names.map(async (name) => ({
        name,
        sql: await readFile(path.join(dir, name), "utf-8"),
      }))
    );

    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ error: "Could not read migration files" }, { status: 500 });
  }
}
