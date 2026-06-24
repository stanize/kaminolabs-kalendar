/**
 * Turns a business name into a URL-safe slug.
 * "Centro Bienestar Serena" -> "centro-bienestar-serena"
 * Falls back to "my-business" when the input produces nothing usable.
 */
export function slugify(input: string): string {
  const s = (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return s || "my-business";
}
