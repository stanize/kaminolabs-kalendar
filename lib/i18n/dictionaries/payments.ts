import type { Locale } from "../config";

/**
 * Dictionary for the Pagos (payments) panel page — subscription status,
 * checkout, and Stripe Customer Portal entry point. See
 * docs/specs/stripe-subscription-billing-spec.md.
 */
export interface PaymentsDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  status: {
    incomplete: string;
    trialing: string;
    active: string;
    past_due: string;
    cancelled: string;
    unpaid: string;
  };
  priceLabel: string; // contains "{price}"
  discountLabel: string; // contains "{percent}"
  subscribe: string;
  subscribing: string;
  manageBilling: string;
  opening: string;
  confirming: string;
  renewsOn: string; // contains "{date}"
  cancelsOn: string; // contains "{date}"
  errUnexpected: string;
  errNoBusiness: string;
  paymentMethod: {
    title: string;
    update: string;
    none: string;
  };
  invoices: {
    title: string;
    date: string;
    total: string;
    status: string;
    actions: string;
    view: string;
    empty: string;
    statusLabels: {
      paid: string;
      open: string;
      void: string;
      uncollectible: string;
      draft: string;
    };
  };
  cancellation: {
    title: string;
    cancelPlan: string;
    confirmPrompt: string; // contains "{date}"
    confirmButton: string;
    backButton: string;
    cancelling: string;
    resume: string;
    resuming: string;
  };
}

const es: PaymentsDictionary = {
  page: {
    title: "Pagos",
    subtitle: "Gestiona tu suscripción a Kalendar.",
  },
  status: {
    incomplete: "Sin suscripción activa",
    trialing: "En periodo de prueba",
    active: "Suscripción activa",
    past_due: "Pago pendiente",
    cancelled: "Suscripción cancelada",
    unpaid: "Impago",
  },
  priceLabel: "{price} €/mes",
  discountLabel: "{percent}% de descuento aplicado",
  subscribe: "Suscribirse",
  subscribing: "Redirigiendo a Stripe...",
  manageBilling: "Ver todo en Stripe",
  opening: "Abriendo...",
  confirming: "Confirmando tu suscripción...",
  renewsOn: "Se renueva el {date}",
  cancelsOn: "Se cancelará el {date}",
  errUnexpected: "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
  errNoBusiness: "Configura primero tu negocio.",
  paymentMethod: {
    title: "Método de pago",
    update: "Actualizar",
    none: "No hay ningún método de pago registrado.",
  },
  invoices: {
    title: "Facturas",
    date: "Fecha",
    total: "Total",
    status: "Estado",
    actions: "Acciones",
    view: "Ver",
    empty: "Todavía no hay facturas.",
    statusLabels: {
      paid: "Pagada",
      open: "Pendiente",
      void: "Anulada",
      uncollectible: "Incobrable",
      draft: "Borrador",
    },
  },
  cancellation: {
    title: "Cancelación",
    cancelPlan: "Cancelar plan",
    confirmPrompt: "Tu suscripción seguirá activa hasta el {date}. ¿Seguro que quieres cancelarla?",
    confirmButton: "Sí, cancelar",
    backButton: "Volver",
    cancelling: "Cancelando...",
    resume: "Reanudar suscripción",
    resuming: "Reanudando...",
  },
};

const en: PaymentsDictionary = {
  page: {
    title: "Payments",
    subtitle: "Manage your Kalendar subscription.",
  },
  status: {
    incomplete: "No active subscription",
    trialing: "Trialing",
    active: "Subscription active",
    past_due: "Payment past due",
    cancelled: "Subscription cancelled",
    unpaid: "Unpaid",
  },
  priceLabel: "€{price}/mo",
  discountLabel: "{percent}% discount applied",
  subscribe: "Subscribe",
  subscribing: "Redirecting to Stripe...",
  manageBilling: "View everything on Stripe",
  opening: "Opening...",
  confirming: "Confirming your subscription...",
  renewsOn: "Renews on {date}",
  cancelsOn: "Cancels on {date}",
  errUnexpected: "An unexpected error occurred. Please try again.",
  errNoBusiness: "Set up your business first.",
  paymentMethod: {
    title: "Payment method",
    update: "Update",
    none: "No payment method on file.",
  },
  invoices: {
    title: "Invoices",
    date: "Date",
    total: "Total",
    status: "Status",
    actions: "Actions",
    view: "View",
    empty: "No invoices yet.",
    statusLabels: {
      paid: "Paid",
      open: "Open",
      void: "Void",
      uncollectible: "Uncollectible",
      draft: "Draft",
    },
  },
  cancellation: {
    title: "Cancellation",
    cancelPlan: "Cancel plan",
    confirmPrompt: "Your subscription stays active until {date}. Are you sure you want to cancel?",
    confirmButton: "Yes, cancel",
    backButton: "Back",
    cancelling: "Cancelling...",
    resume: "Resume subscription",
    resuming: "Resuming...",
  },
};

const PAYMENTS_DICTIONARIES: Record<Locale, PaymentsDictionary> = { es, en };

export function getPaymentsDictionary(locale: Locale): PaymentsDictionary {
  return PAYMENTS_DICTIONARIES[locale];
}
