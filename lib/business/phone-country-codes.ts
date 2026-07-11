// Small curated list of international dialing codes for the business contact
// phone field. Not locale-translated — country names are shown in Spanish
// since the initial market is Spain-only; revisit if/when other markets are
// added. Kept as a flat, static list (no external API) — same philosophy as
// the postal-code dataset.

export interface PhoneCountryCode {
  code: string; // e.g. "+34"
  label: string; // e.g. "España (+34)"
}

export const PHONE_COUNTRY_CODES: PhoneCountryCode[] = [
  { code: "+34", label: "España (+34)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+33", label: "Francia (+33)" },
  { code: "+376", label: "Andorra (+376)" },
  { code: "+39", label: "Italia (+39)" },
  { code: "+49", label: "Alemania (+49)" },
  { code: "+44", label: "Reino Unido (+44)" },
  { code: "+1", label: "EE. UU. / Canadá (+1)" },
  { code: "+52", label: "México (+52)" },
  { code: "+54", label: "Argentina (+54)" },
  { code: "+57", label: "Colombia (+57)" },
];

export const DEFAULT_PHONE_COUNTRY_CODE = "+34";
