import type { Locale } from "../config";

/**
 * Dictionary for the Negocio (business settings) panel page: the page itself,
 * BusinessForm, and the user-facing error messages from its server actions
 * (saveBusinessSettings, checkSlugAvailability) and from slug FORMAT validation
 * (lib/business/slug-screen.ts's validateSlugFormat, which takes this dict's
 * errSlug* keys as a parameter so the shared utility has no hardcoded language).
 */
export interface BusinessDictionary {
  page: {
    titleNew: string;
    titleEdit: string;
    subtitleNew: string;
    subtitleEdit: string;
  };
  form: {
    nameLabel: string;
    namePlaceholder: string;
    typeLabel: string;
    cityLabel: string;
    cityHint: string;
    cityPlaceholder: string;
    slugLabel: string;
    slugPlaceholder: string;
    slugImmutableNew: string;
    slugImmutableEdit: string;
    slugChecking: string;
    slugAvailable: string;
    slugTaken: string;
    saved: string;
    createButton: string;
    saveButton: string;
    saving: string;
    statusActive: string;
    statusPending: string;
    statusRejected: string;
    // client-side validation
    errName: string;
    errType: string;
    errSlugRequired: string;
    errSlugTaken: string;
    errUnexpected: string;
  };
  errors: {
    // from saveBusinessSettings / checkSlugAvailability
    errSlugReserved: string;
    errSlugFlagged: string;
    errSlugTaken: string;
    errSaveFailed: string; // prefix; server detail appended
    errCreateFailed: string; // prefix; server detail appended
    // slug FORMAT validation (lib/business/slug-screen.ts validateSlugFormat).
    // {min}/{max} are placeholder tokens replaced with the actual numbers.
    errSlugTooShort: string;
    errSlugTooLong: string;
    errSlugInvalidChars: string;
  };
}

const es: BusinessDictionary = {
  page: {
    titleNew: "Configura tu negocio",
    titleEdit: "Configura tu negocio",
    subtitleNew: "Cuéntanos de tu negocio. Así te verán tus clientes al reservar.",
    subtitleEdit: "Edita los datos de tu negocio.",
  },
  form: {
    nameLabel: "Nombre del negocio",
    namePlaceholder: "Centro Bienestar Serena",
    typeLabel: "Tipo de negocio",
    cityLabel: "Ciudad",
    cityHint: "(opcional)",
    cityPlaceholder: "Valencia",
    slugLabel: "Enlace de tu página de reservas",
    slugPlaceholder: "centro-bienestar",
    slugImmutableNew:
      "Este enlace es permanente: no podrás cambiarlo más adelante. Todos los enlaces se revisan antes de activarse por completo.",
    slugImmutableEdit: "El enlace es permanente. Si necesitas cambiarlo, contacta con soporte.",
    slugChecking: "Comprobando disponibilidad…",
    slugAvailable: "Disponible",
    slugTaken: "Ya está en uso. Prueba otra variación.",
    saved: "Guardado correctamente.",
    createButton: "Crear negocio",
    saveButton: "Guardar cambios",
    saving: "Guardando…",
    statusActive: "Activo",
    statusPending: "En revisión",
    statusRejected: "Rechazado",
    errName: "El nombre del negocio es obligatorio.",
    errType: "Selecciona el tipo de negocio.",
    errSlugRequired: "Elige un enlace para tu página de reservas.",
    errSlugTaken: "Ese enlace ya está en uso. Elige otro.",
    errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
  },
  errors: {
    errSlugReserved: "Ese enlace está reservado. Elige otro.",
    errSlugFlagged: "Ese enlace podría no estar permitido y quedará pendiente de revisión.",
    errSlugTaken: "Ese enlace ya está en uso. Elige otro.",
    errSaveFailed: "No se pudo guardar:",
    errCreateFailed: "No se pudo crear el negocio:",
    errSlugTooShort: "El enlace debe tener al menos {min} caracteres.",
    errSlugTooLong: "El enlace no puede superar los {max} caracteres.",
    errSlugInvalidChars: "Usa solo minúsculas, números y guiones (sin espacios ni guiones al inicio o final).",
  },
};

const en: BusinessDictionary = {
  page: {
    titleNew: "Set up your business",
    titleEdit: "Set up your business",
    subtitleNew: "Tell us about your business. This is how clients will see you when booking.",
    subtitleEdit: "Edit your business details.",
  },
  form: {
    nameLabel: "Business name",
    namePlaceholder: "Serena Wellness Center",
    typeLabel: "Business type",
    cityLabel: "City",
    cityHint: "(optional)",
    cityPlaceholder: "Valencia",
    slugLabel: "Your booking page link",
    slugPlaceholder: "wellness-center",
    slugImmutableNew:
      "This link is permanent: you won't be able to change it later. All links are reviewed before going fully live.",
    slugImmutableEdit: "This link is permanent. If you need to change it, contact support.",
    slugChecking: "Checking availability…",
    slugAvailable: "Available",
    slugTaken: "Already taken. Try another variation.",
    saved: "Saved successfully.",
    createButton: "Create business",
    saveButton: "Save changes",
    saving: "Saving…",
    statusActive: "Active",
    statusPending: "Under review",
    statusRejected: "Rejected",
    errName: "The business name is required.",
    errType: "Select a business type.",
    errSlugRequired: "Choose a link for your booking page.",
    errSlugTaken: "That link is already taken. Choose another.",
    errUnexpected: "An unexpected error occurred. Please try again.",
  },
  errors: {
    errSlugReserved: "That link is reserved. Choose another.",
    errSlugFlagged: "That link may not be allowed and will be left pending review.",
    errSlugTaken: "That link is already taken. Choose another.",
    errSaveFailed: "Couldn't save:",
    errCreateFailed: "Couldn't create the business:",
    errSlugTooShort: "The link must be at least {min} characters.",
    errSlugTooLong: "The link can't be more than {max} characters.",
    errSlugInvalidChars: "Use only lowercase letters, numbers, and hyphens (no spaces or leading/trailing hyphens).",
  },
};

const BUSINESS_DICTIONARIES: Record<Locale, BusinessDictionary> = { es, en };

export function getBusinessDictionary(locale: Locale): BusinessDictionary {
  return BUSINESS_DICTIONARIES[locale];
}
