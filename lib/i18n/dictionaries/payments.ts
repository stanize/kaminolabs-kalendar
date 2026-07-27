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
  errUnexpected: string;
  errNoBusiness: string;
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
  manageBilling: "Gestionar facturación",
  opening: "Abriendo...",
  confirming: "Confirmando tu suscripción...",
  renewsOn: "Se renueva el {date}",
  errUnexpected: "Ha ocurrido un error inesperado. Inténtalo de nuevo.",
  errNoBusiness: "Configura primero tu negocio.",
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
  manageBilling: "Manage billing",
  opening: "Opening...",
  confirming: "Confirming your subscription...",
  renewsOn: "Renews on {date}",
  errUnexpected: "An unexpected error occurred. Please try again.",
  errNoBusiness: "Set up your business first.",
};

const PAYMENTS_DICTIONARIES: Record<Locale, PaymentsDictionary> = { es, en };

export function getPaymentsDictionary(locale: Locale): PaymentsDictionary {
  return PAYMENTS_DICTIONARIES[locale];
}
