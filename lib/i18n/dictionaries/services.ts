import type { Locale } from "../config";

/**
 * Dictionary for the Servicios (services) panel page: the page itself, the
 * ServicesManager component (list, inline editor, template picker, staged
 * drafts), validateService's messages (lib/services/constants.ts, which takes
 * this dict's validation keys as a parameter — same pattern as slug-screen.ts),
 * and the user-facing error messages from lib/actions/services.ts.
 */
export interface ServicesDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  manager: {
    edit: string;
    delete: string;
    addService: string;
    addSelected: string;
    customizeCount: string; // contains "{n}"
    confirmCount: string; // contains "{n}"
    adding: string;
    saving: string;
    cancel: string;
    save: string;
    nameLabel: string;
    namePlaceholder: string;
    durationLabel: string;
    durationOther: string;
    durationUnit: string;
    priceLabel: string;
    priceFree: string;
    priceLower: string; // aria-label, contains "{step}"
    priceRaise: string; // aria-label, contains "{step}"
    templatesTitle: string;
    templatesSubtitle: string;
    errUnexpected: string;
    errDeleteFailed: string;
  };
  validation: {
    // validateService (lib/services/constants.ts)
    errNameRequired: string;
    errNameTooLong: string; // contains "{max}"
    errDurationRange: string; // contains "{min}" and "{max}"
    errPriceInvalid: string;
  };
  errors: {
    // lib/actions/services.ts
    errNoBusiness: string;
    errNoneToAdd: string;
    errCreateFailed: string; // prefix; server detail appended
    errCreateManyFailed: string; // prefix; server detail appended
    errSaveFailed: string; // prefix; server detail appended
    errDeleteFailed: string; // prefix; server detail appended
    errReorderFailed: string; // prefix; server detail appended
  };
}

const es: ServicesDictionary = {
  page: {
    title: "Tus servicios",
    subtitle: "Define lo que tus clientes podrán reservar contigo.",
  },
  manager: {
    edit: "Editar",
    delete: "Eliminar",
    addService: "Añadir servicio",
    addSelected: "Añadir seleccionados",
    customizeCount: "Personalizar {n}",
    confirmCount: "Confirmar {n}",
    adding: "Añadiendo…",
    saving: "Guardando…",
    cancel: "Cancelar",
    save: "Guardar",
    nameLabel: "Nombre del servicio",
    namePlaceholder: "Primera consulta",
    durationLabel: "Duración",
    durationOther: "Otra",
    durationUnit: "min",
    priceLabel: "Precio",
    priceFree: "Gratis",
    priceLower: "Bajar {step} €",
    priceRaise: "Subir {step} €",
    templatesTitle: "¿No sabes por dónde empezar?",
    templatesSubtitle: "Elige los servicios habituales de tu tipo de negocio y ajústalos a tus necesidades.",
    errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
    errDeleteFailed: "No se pudo eliminar. Inténtalo de nuevo.",
  },
  validation: {
    errNameRequired: "El nombre del servicio es obligatorio.",
    errNameTooLong: "El nombre no puede superar los {max} caracteres.",
    errDurationRange: "La duración debe estar entre {min} y {max} minutos.",
    errPriceInvalid: "El precio no es válido.",
  },
  errors: {
    errNoBusiness: "Primero configura tu negocio.",
    errNoneToAdd: "No hay servicios que añadir.",
    errCreateFailed: "No se pudo crear el servicio:",
    errCreateManyFailed: "No se pudieron añadir los servicios:",
    errSaveFailed: "No se pudo guardar:",
    errDeleteFailed: "No se pudo eliminar:",
    errReorderFailed: "No se pudo reordenar:",
  },
};

const en: ServicesDictionary = {
  page: {
    title: "Your services",
    subtitle: "Define what your clients will be able to book with you.",
  },
  manager: {
    edit: "Edit",
    delete: "Delete",
    addService: "Add service",
    addSelected: "Add selected",
    customizeCount: "Customize {n}",
    confirmCount: "Confirm {n}",
    adding: "Adding…",
    saving: "Saving…",
    cancel: "Cancel",
    save: "Save",
    nameLabel: "Service name",
    namePlaceholder: "First consultation",
    durationLabel: "Duration",
    durationOther: "Other",
    durationUnit: "min",
    priceLabel: "Price",
    priceFree: "Free",
    priceLower: "Lower {step} €",
    priceRaise: "Raise {step} €",
    templatesTitle: "Not sure where to start?",
    templatesSubtitle: "Pick the services common for your business type and adjust them to your needs.",
    errUnexpected: "An unexpected error occurred. Please try again.",
    errDeleteFailed: "Couldn't delete. Please try again.",
  },
  validation: {
    errNameRequired: "The service name is required.",
    errNameTooLong: "The name can't be more than {max} characters.",
    errDurationRange: "Duration must be between {min} and {max} minutes.",
    errPriceInvalid: "Invalid price.",
  },
  errors: {
    errNoBusiness: "Set up your business first.",
    errNoneToAdd: "There are no services to add.",
    errCreateFailed: "Couldn't create the service:",
    errCreateManyFailed: "Couldn't add the services:",
    errSaveFailed: "Couldn't save:",
    errDeleteFailed: "Couldn't delete:",
    errReorderFailed: "Couldn't reorder:",
  },
};

const SERVICES_DICTIONARIES: Record<Locale, ServicesDictionary> = { es, en };

export function getServicesDictionary(locale: Locale): ServicesDictionary {
  return SERVICES_DICTIONARIES[locale];
}
