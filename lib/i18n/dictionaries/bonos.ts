import type { Locale } from "../config";

export interface BonosDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  tabs: {
    types: string;
    sold: string;
  };
  types: {
    emptyTitle: string;
    emptySubtitle: string;
    addNew: string;
    nameLabel: string;
    namePlaceholder: string;
    sessionsLabel: string;
    priceLabel: string;
    save: string;
    saving: string;
    cancel: string;
    edit: string;
    deactivate: string;
    activate: string;
    inactiveLabel: string;
    sessionsUnit: string;
  };
  sold: {
    emptyTitle: string;
    emptySubtitle: string;
    sellNew: string;
    clientLabel: string;
    clientPlaceholder: string;
    bonoTypeLabel: string;
    bonoTypePlaceholder: string;
    confirm: string;
    confirming: string;
    cancel: string;
    remaining: string;
    purchasedOn: string;
    noActiveBonoTypes: string;
  };
  errors: {
    errNoBusiness: string;
    errNotFound: string;
    errNameRequired: string;
    errInvalidSessionCount: string;
    errInvalidPrice: string;
    errSaveFailed: string;
    errClientRequired: string;
    errBonoTypeRequired: string;
    errBonoTypeInactive: string;
  };
}

const es: BonosDictionary = {
  page: { title: "Bonos", subtitle: "Vende y gestiona bonos de sesiones prepagadas." },
  tabs: { types: "Tipos de bono", sold: "Bonos vendidos" },
  types: {
    emptyTitle: "Todavía no tienes tipos de bono",
    emptySubtitle: "Crea uno para poder empezar a venderlos.",
    addNew: "Nuevo tipo de bono",
    nameLabel: "Nombre",
    namePlaceholder: "Ej. Bono 10 sesiones",
    sessionsLabel: "Sesiones",
    priceLabel: "Precio (€)",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    edit: "Editar",
    deactivate: "Desactivar",
    activate: "Activar",
    inactiveLabel: "Inactivo",
    sessionsUnit: "sesiones",
  },
  sold: {
    emptyTitle: "Todavía no has vendido ningún bono",
    emptySubtitle: "Los bonos que vendas aparecerán aquí.",
    sellNew: "Vender bono",
    clientLabel: "Cliente",
    clientPlaceholder: "Buscar por nombre, email o teléfono...",
    bonoTypeLabel: "Tipo de bono",
    bonoTypePlaceholder: "Elige un tipo de bono",
    confirm: "Confirmar venta",
    confirming: "Guardando…",
    cancel: "Cancelar",
    remaining: "{used}/{total} sesiones usadas",
    purchasedOn: "Vendido el {date}",
    noActiveBonoTypes: "No hay tipos de bono activos. Crea uno primero en la pestaña Tipos de bono.",
  },
  errors: {
    errNoBusiness: "No hay negocio.",
    errNotFound: "No encontrado.",
    errNameRequired: "Indica un nombre para el bono.",
    errInvalidSessionCount: "El número de sesiones debe ser mayor que 0.",
    errInvalidPrice: "Indica un precio válido.",
    errSaveFailed: "No se pudo guardar el cambio.",
    errClientRequired: "Elige un cliente.",
    errBonoTypeRequired: "Elige un tipo de bono.",
    errBonoTypeInactive: "Este tipo de bono ya no está disponible.",
  },
};

const en: BonosDictionary = {
  page: { title: "Bonos", subtitle: "Sell and manage prepaid session packages." },
  tabs: { types: "Bono types", sold: "Sold bonos" },
  types: {
    emptyTitle: "No bono types yet",
    emptySubtitle: "Create one to start selling them.",
    addNew: "New bono type",
    nameLabel: "Name",
    namePlaceholder: "E.g. 10-session bono",
    sessionsLabel: "Sessions",
    priceLabel: "Price (€)",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    edit: "Edit",
    deactivate: "Deactivate",
    activate: "Activate",
    inactiveLabel: "Inactive",
    sessionsUnit: "sessions",
  },
  sold: {
    emptyTitle: "No bonos sold yet",
    emptySubtitle: "Bonos you sell will show up here.",
    sellNew: "Sell bono",
    clientLabel: "Client",
    clientPlaceholder: "Search by name, email, or phone...",
    bonoTypeLabel: "Bono type",
    bonoTypePlaceholder: "Choose a bono type",
    confirm: "Confirm sale",
    confirming: "Saving…",
    cancel: "Cancel",
    remaining: "{used}/{total} sessions used",
    purchasedOn: "Sold on {date}",
    noActiveBonoTypes: "No active bono types. Create one first in the Bono types tab.",
  },
  errors: {
    errNoBusiness: "No business found.",
    errNotFound: "Not found.",
    errNameRequired: "Enter a name for the bono.",
    errInvalidSessionCount: "Session count must be greater than 0.",
    errInvalidPrice: "Enter a valid price.",
    errSaveFailed: "Couldn't save the change.",
    errClientRequired: "Choose a client.",
    errBonoTypeRequired: "Choose a bono type.",
    errBonoTypeInactive: "This bono type is no longer available.",
  },
};

const BONOS_DICTIONARIES: Record<Locale, BonosDictionary> = { es, en };

export function getBonosDictionary(locale: Locale): BonosDictionary {
  return BONOS_DICTIONARIES[locale];
}
