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
    filterPlaceholder: string; // client-name filter, bono-usage-report
    sortLabel: string;
    sortRecent: string;
    sortRemaining: string; // "fewest sessions remaining first" — surfaces bonos close to running out
    lowRemainingBadge: string; // shown when 1 session remains and not yet exhausted
    exhaustedBadge: string;
    noResults: string; // filter matched nothing
    viewHistory: string; // "Ver historial" — expands a sold bono's usage history
    hideHistory: string;
    historyTitle: string;
    historyEmpty: string; // no sessions consumed yet from this bono
    reverseToCash: string; // button in a used-session row
    reverseToCard: string;
    reversing: string;
    confirmReverse: string; // window.confirm text before an irreversible-feeling switch
    reverseFailed: string;
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
    filterPlaceholder: "Filtrar por cliente...",
    sortLabel: "Ordenar",
    sortRecent: "Más recientes",
    sortRemaining: "Menos sesiones restantes",
    lowRemainingBadge: "Última sesión",
    exhaustedBadge: "Agotado",
    noResults: "Ningún bono coincide con el filtro.",
    viewHistory: "Ver historial",
    hideHistory: "Ocultar historial",
    historyTitle: "Sesiones consumidas",
    historyEmpty: "Todavía no se ha usado ninguna sesión de este bono.",
    reverseToCash: "Cambiar a efectivo",
    reverseToCard: "Cambiar a tarjeta",
    reversing: "Revirtiendo…",
    confirmReverse: "Esto devolverá la sesión al bono y cambiará el método de pago de la cita. ¿Continuar?",
    reverseFailed: "No se pudo revertir la sesión. Puede que ya se haya cambiado.",
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
    filterPlaceholder: "Filter by client...",
    sortLabel: "Sort",
    sortRecent: "Most recent",
    sortRemaining: "Fewest sessions left",
    lowRemainingBadge: "Last session",
    exhaustedBadge: "Exhausted",
    noResults: "No bonos match the filter.",
    viewHistory: "View history",
    hideHistory: "Hide history",
    historyTitle: "Sessions used",
    historyEmpty: "No sessions have been used from this bono yet.",
    reverseToCash: "Switch to cash",
    reverseToCard: "Switch to card",
    reversing: "Reversing…",
    confirmReverse: "This will return the session to the bono and change the appointment's payment method. Continue?",
    reverseFailed: "Couldn't reverse the session. It may have already changed.",
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
