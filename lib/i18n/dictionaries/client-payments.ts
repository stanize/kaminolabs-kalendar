import type { Locale } from "../config";

/**
 * Dictionary for /panel/payments — this route is about payments Kalendar
 * clinics COLLECT FROM their own clients/patients (deposits, no-show
 * charges, etc.), distinct from the Kalendar SaaS subscription itself,
 * which now lives at /panel/settings/subscription. Placeholder only for
 * now — see MODULES.md.
 */
export interface ClientPaymentsDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  placeholder: {
    title: string;
    body: string;
  };
}

const es: ClientPaymentsDictionary = {
  page: {
    title: "Pagos",
    subtitle: "Cobros y pagos de tus clientes.",
  },
  placeholder: {
    title: "Próximamente",
    body: "Aquí podrás ver y gestionar los cobros a tus clientes: depósitos, cargos por ausencia y el estado de pago de cada cita.",
  },
};

const en: ClientPaymentsDictionary = {
  page: {
    title: "Payments",
    subtitle: "Payments and charges from your clients.",
  },
  placeholder: {
    title: "Coming soon",
    body: "Here you'll be able to see and manage charges to your clients: deposits, no-show fees, and each appointment's payment status.",
  },
};

const CLIENT_PAYMENTS_DICTIONARIES: Record<Locale, ClientPaymentsDictionary> = { es, en };

export function getClientPaymentsDictionary(locale: Locale): ClientPaymentsDictionary {
  return CLIENT_PAYMENTS_DICTIONARIES[locale];
}
