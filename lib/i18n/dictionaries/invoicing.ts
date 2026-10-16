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
    // draw-signature — alternative to uploading an image file: sign with
    // mouse/touch/stylus directly in the browser.
    signatureDrawButton: string;
    signatureDrawHint: string;
    signatureDrawClear: string;
    signatureDrawSave: string;
    signatureDrawCancel: string;
    errSignatureEmpty: string;
    numberingSectionTitle: string;
    numberingSectionSubtitle: string;
    numberingNextLabel: string;
    numberingNextHint: string;
    numberingInputPlaceholder: string;
    numberingSave: string;
    numberingSaving: string;
    numberingClear: string;
    errNoBusiness: string;
    errInvalidFile: string;
    errInvalidNumber: string;
    errSaveFailed: string;
  };
  confirmModal: {
    title: string;
    yesGenerateAndSend: string;
    yesGenerateOnly: string;
    no: string;
    sendEmailCheckboxLabel: string;
    alternateEmailLabel: string;
    alternateEmailPlaceholder: string;
    missingEmailLabel: string;
    missingEmailPlaceholder: string;
    // client-identity-for-invoicing — required on the factura, pre-filled
    // and editable when already on file, otherwise blank and mandatory.
    dniLabel: string;
    dniPlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    sending: string;
    errEmailRequired: string;
    errInvalidEmail: string;
    errClientIdentityRequired: string;
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
    signatureDrawButton: "Dibujar firma",
    signatureDrawHint: "Firma con el ratón, el dedo o un lápiz óptico.",
    signatureDrawClear: "Borrar",
    signatureDrawSave: "Guardar firma",
    signatureDrawCancel: "Cancelar",
    errSignatureEmpty: "Dibuja tu firma antes de guardar.",
    numberingSectionTitle: "Numeración de facturas",
    numberingSectionSubtitle:
      "El siguiente número se calcula automáticamente. Si vienes de otro sistema a mitad de año, indica aquí el número con el que debe continuar tu próxima factura.",
    numberingNextLabel: "Próxima factura",
    numberingNextHint: "Marca a partir de qué número debe continuar tu numeración — las facturas siguientes seguirán la secuencia desde ahí.",
    numberingInputPlaceholder: "ej. 48",
    numberingSave: "Guardar",
    numberingSaving: "Guardando…",
    numberingClear: "Quitar",
    errNoBusiness: "No se encontró tu negocio.",
    errInvalidFile: "Sube una imagen PNG, JPG o WEBP de hasta 2MB.",
    errInvalidNumber: "Indica un número de factura válido.",
    errSaveFailed: "No se pudo guardar el cambio.",
  },
  confirmModal: {
    title: "¿Quieres generar una factura?",
    yesGenerateAndSend: "Generar y mandar correo",
    yesGenerateOnly: "Solo generar",
    no: "No",
    sendEmailCheckboxLabel: "Enviar factura al cliente por email",
    alternateEmailLabel: "¿Enviar a otro email? (opcional)",
    alternateEmailPlaceholder: "otro@email.com",
    missingEmailLabel: "Este cliente no tiene email. Indica uno para enviar la factura:",
    missingEmailPlaceholder: "cliente@email.com",
    dniLabel: "DNI del cliente",
    dniPlaceholder: "12345678A",
    addressLabel: "Domicilio del cliente",
    addressPlaceholder: "Calle Mayor 5, 28001 Madrid",
    sending: "Enviando…",
    errEmailRequired: "Indica un email para enviar la factura.",
    errInvalidEmail: "Indica un email válido.",
    errClientIdentityRequired: "Indica el DNI y el domicilio del cliente.",
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
    signatureDrawButton: "Draw signature",
    signatureDrawHint: "Sign with your mouse, finger, or a stylus.",
    signatureDrawClear: "Clear",
    signatureDrawSave: "Save signature",
    signatureDrawCancel: "Cancel",
    errSignatureEmpty: "Draw your signature before saving.",
    numberingSectionTitle: "Invoice numbering",
    numberingSectionSubtitle:
      "The next number is calculated automatically. If you're switching from another system mid-year, set the number your next invoice should continue from.",
    numberingNextLabel: "Next invoice",
    numberingNextHint: "Sets the starting point for your numbering — every invoice after that will continue the sequence from here.",
    numberingInputPlaceholder: "e.g. 48",
    numberingSave: "Save",
    numberingSaving: "Saving…",
    numberingClear: "Clear",
    errNoBusiness: "Business not found.",
    errInvalidFile: "Upload a PNG, JPG, or WEBP image up to 2MB.",
    errInvalidNumber: "Enter a valid invoice number.",
    errSaveFailed: "Couldn't save the change.",
  },
  confirmModal: {
    title: "Generate an invoice?",
    yesGenerateAndSend: "Generate and send email",
    yesGenerateOnly: "Generate only",
    no: "No",
    sendEmailCheckboxLabel: "Email the invoice to the client",
    alternateEmailLabel: "Send to a different email? (optional)",
    alternateEmailPlaceholder: "other@email.com",
    missingEmailLabel: "This client has no email on file. Enter one to send the invoice:",
    missingEmailPlaceholder: "client@email.com",
    dniLabel: "Client's DNI",
    dniPlaceholder: "12345678A",
    addressLabel: "Client's address",
    addressPlaceholder: "Calle Mayor 5, 28001 Madrid",
    sending: "Sending…",
    errEmailRequired: "Enter an email to send the invoice.",
    errInvalidEmail: "Enter a valid email.",
    errClientIdentityRequired: "Enter the client's DNI and address.",
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
