import type { Locale } from "../config";

/**
 * Dictionary for pdf-invoicing.md's Facturación settings tab
 * (/panel/settings/invoicing), the post-Cobrar invoice confirm modal
 * (invoice-on-payment-trigger), and the Facturas page (facturas-page).
 */
export interface InvoicingDictionary {
  settings: {
    templateSectionTitle: string;
    templateSectionSubtitle: string;
    templateVatExemptLabel: string;
    autoInvoiceLabel: string;
    autoInvoiceHint: string;
    autoInvoiceSaving: string;
    signatureSectionTitle: string;
    signatureSectionSubtitle: string;
    signatureUpload: string;
    signatureChange: string;
    signatureRemove: string;
    signatureUploading: string;
    errNoBusiness: string;
    errInvalidFile: string;
    errSaveFailed: string;
  };
  confirmModal: {
    title: string;
    yes: string;
    no: string;
    alternateEmailLabel: string;
    alternateEmailPlaceholder: string;
    missingEmailLabel: string;
    missingEmailPlaceholder: string;
    sending: string;
    errEmailRequired: string;
    errInvalidEmail: string;
    errCreateFailed: string;
    errSendFailed: string;
  };
  page: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptySubtitle: string;
    filterDateFrom: string;
    filterDateTo: string;
    filterService: string;
    filterServiceAll: string;
    filterPaymentMethod: string;
    filterPaymentMethodAll: string;
    filterPatientName: string;
    filterInvoiceNumber: string;
    colNumber: string;
    colClient: string;
    colService: string;
    colPaymentMethod: string;
    colAmount: string;
    colSentAt: string;
    download: string;
    resend: string;
    resending: string;
    noResults: string;
    paymentMethodCash: string;
    paymentMethodCard: string;
    paymentMethodBono: string;
    neverSent: string;
  };
}

const es: InvoicingDictionary = {
  settings: {
    templateSectionTitle: "Plantilla de factura",
    templateSectionSubtitle: "Elige la plantilla que se usará al generar tus facturas.",
    templateVatExemptLabel: "Exento de IVA",
    autoInvoiceLabel: "Factura automática",
    autoInvoiceHint:
      "Genera y envía la factura automáticamente al marcar una cita como pagada, sin preguntar cada vez.",
    autoInvoiceSaving: "Guardando…",
    signatureSectionTitle: "Firma",
    signatureSectionSubtitle: "Se muestra en tus facturas cuando la subes. Si no subes ninguna, esa zona queda en blanco.",
    signatureUpload: "Subir firma",
    signatureChange: "Cambiar firma",
    signatureRemove: "Quitar",
    signatureUploading: "Subiendo…",
    errNoBusiness: "No se encontró tu negocio.",
    errInvalidFile: "Sube una imagen PNG, JPG o WEBP de hasta 2MB.",
    errSaveFailed: "No se pudo guardar el cambio.",
  },
  confirmModal: {
    title: "¿Quieres generar una factura?",
    yes: "Sí, generar",
    no: "No",
    alternateEmailLabel: "¿Enviar a otro email? (opcional)",
    alternateEmailPlaceholder: "otro@email.com",
    missingEmailLabel: "Este cliente no tiene email. Indica uno para enviar la factura:",
    missingEmailPlaceholder: "cliente@email.com",
    sending: "Enviando…",
    errEmailRequired: "Indica un email para enviar la factura.",
    errInvalidEmail: "Indica un email válido.",
    errCreateFailed: "No se pudo crear la factura.",
    errSendFailed: "La factura se creó pero no se pudo enviar. Puedes reenviarla desde Facturas.",
  },
  page: {
    title: "Facturas",
    subtitle: "Todas las facturas generadas para tus clientes.",
    emptyTitle: "Todavía no has generado ninguna factura",
    emptySubtitle: "Las facturas que generes desde el Calendario aparecerán aquí.",
    filterDateFrom: "Desde",
    filterDateTo: "Hasta",
    filterService: "Servicio",
    filterServiceAll: "Todos",
    filterPaymentMethod: "Método de pago",
    filterPaymentMethodAll: "Todos",
    filterPatientName: "Buscar por cliente...",
    filterInvoiceNumber: "Buscar por nº de factura...",
    colNumber: "Nº",
    colClient: "Cliente",
    colService: "Servicio",
    colPaymentMethod: "Pago",
    colAmount: "Importe",
    colSentAt: "Enviada",
    download: "Descargar",
    resend: "Reenviar",
    resending: "Enviando…",
    noResults: "Ninguna factura coincide con los filtros.",
    paymentMethodCash: "Efectivo",
    paymentMethodCard: "Tarjeta",
    paymentMethodBono: "Bono",
    neverSent: "—",
  },
};

const en: InvoicingDictionary = {
  settings: {
    templateSectionTitle: "Invoice template",
    templateSectionSubtitle: "Choose the template used to generate your invoices.",
    templateVatExemptLabel: "VAT-exempt",
    autoInvoiceLabel: "Auto-invoice",
    autoInvoiceHint: "Generate and send the invoice automatically when an appointment is marked as paid, with no prompt.",
    autoInvoiceSaving: "Saving…",
    signatureSectionTitle: "Signature",
    signatureSectionSubtitle: "Shown on your invoices once uploaded. If none is uploaded, that area stays blank.",
    signatureUpload: "Upload signature",
    signatureChange: "Change signature",
    signatureRemove: "Remove",
    signatureUploading: "Uploading…",
    errNoBusiness: "Business not found.",
    errInvalidFile: "Upload a PNG, JPG, or WEBP image up to 2MB.",
    errSaveFailed: "Couldn't save the change.",
  },
  confirmModal: {
    title: "Generate an invoice?",
    yes: "Yes, generate",
    no: "No",
    alternateEmailLabel: "Send to a different email? (optional)",
    alternateEmailPlaceholder: "other@email.com",
    missingEmailLabel: "This client has no email on file. Enter one to send the invoice:",
    missingEmailPlaceholder: "client@email.com",
    sending: "Sending…",
    errEmailRequired: "Enter an email to send the invoice.",
    errInvalidEmail: "Enter a valid email.",
    errCreateFailed: "Couldn't create the invoice.",
    errSendFailed: "The invoice was created but couldn't be sent. You can resend it from Invoices.",
  },
  page: {
    title: "Invoices",
    subtitle: "Every invoice generated for your clients.",
    emptyTitle: "No invoices yet",
    emptySubtitle: "Invoices you generate from Calendar will show up here.",
    filterDateFrom: "From",
    filterDateTo: "To",
    filterService: "Service",
    filterServiceAll: "All",
    filterPaymentMethod: "Payment method",
    filterPaymentMethodAll: "All",
    filterPatientName: "Search by client...",
    filterInvoiceNumber: "Search by invoice number...",
    colNumber: "No.",
    colClient: "Client",
    colService: "Service",
    colPaymentMethod: "Payment",
    colAmount: "Amount",
    colSentAt: "Sent",
    download: "Download",
    resend: "Resend",
    resending: "Sending…",
    noResults: "No invoices match the filters.",
    paymentMethodCash: "Cash",
    paymentMethodCard: "Card",
    paymentMethodBono: "Bono",
    neverSent: "—",
  },
};

const INVOICING_DICTIONARIES: Record<Locale, InvoicingDictionary> = { es, en };

export function getInvoicingDictionary(locale: Locale): InvoicingDictionary {
  return INVOICING_DICTIONARIES[locale];
}
