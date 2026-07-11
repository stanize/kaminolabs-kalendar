import postalCodes from "./postal-codes-es.json";

// Static Spanish postal-code → {city, province} lookup, sourced from a public
// INE-derived dataset (~11k postal codes). Server-only: used by the
// /api/postal-lookup route to autofill city + province while the user types
// a postal code in the business address form. Free, no external API calls,
// no rate limits — trades full street-level autocomplete for zero cost.
// Data occasionally uses bilingual province names (e.g. "Araba/Álava") since
// the source dataset is bilingual for some autonomous communities; the field
// stays user-editable, so this is a starting point, not an authority.

type PostalCodeEntry = { city: string; province: string };

const POSTAL_CODES = postalCodes as Record<string, PostalCodeEntry>;

export function lookupPostalCode(rawCp: string): PostalCodeEntry | null {
  const cp = rawCp.trim();
  if (!/^\d{5}$/.test(cp)) return null;
  return POSTAL_CODES[cp] ?? null;
}
