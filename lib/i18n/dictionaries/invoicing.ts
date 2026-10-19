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
    // invoice-concepts-list: Settings > Facturación's add/rename/delete
    // section for the clinic's own list of billing line-item descriptions.
    conceptsSectionTitle: string;
    conceptsSectionSubtitle: string;
    conceptsEmpty: string;
    conceptsAddPlaceholder: string;
    conceptsAdd: string;
    conceptsEdit: string;
    conceptsSave: string;
    conceptsCancel: string;
  };
  confirmModal: {
    title: string;
    // invoice-concepts-list: `serviceLabel` shows the booking's own
    // appointment type (always the invoice's first line, read-only here);
    // `conceptLabel`/`conceptPlaceholder` are for the OPTIONAL extra line
    // on top — picked from the business's list or typed fresh (auto-added
    // to the list either way).
    serviceLabel: string;
    conceptLabel: string;
    conceptPlaceholder: string;
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
    // free-text-invoice-search: matches across the whole invoice record
    // (client, service + any additional concept, payment method, amount,
    // invoice number) instead of one field at a time.
    filterSearch: string;
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
    // facturas-pending-tab (2026-10): Generadas/Pendientes split — a paid
    // booking with no invoice yet (declined at Cobrar time, or from
    // before this feature existed) sits here until generated, instead of
    // disappearing once the post-Cobrar prompt is dismissed.
    tabGenerated: string;
    tabPending: string;
    pendingEmptyTitle: string;
    pendingEmptySubtitle: string;
    generateInvoice: string;
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
    conceptsSectionTitle: "Conceptos de factura",
    conceptsSectionSubtitle: "La lista de conceptos que puedes elegir al generar una factura. Añade, modifica o elimina los que necesites.",
    conceptsEmpty: "Todavía no has añadido ningún concepto.",
    conceptsAddPlaceholder: "Nuevo concepto…",
    conceptsAdd: "Añadir",
    conceptsEdit: "Editar",
    conceptsSave: "Guardar",
    conceptsCancel: "Cancelar",
  },
  confirmModal: {
    title: "¿Quieres generar una factura?",
    serviceLabel: "Servicio",
    conceptLabel: "Concepto de factura adicional (opcional)",
    conceptPlaceholder: "ej. Quiropodia",
    yesGenerateAndSend: "Generar y mandar correo",
    yesGenerateOnly: "Solo generar",
    no: "No",
    sendEmailCheckboxLabel: "Enviar factura al cliente por email",
    alternateEmailLabel: "¿Enviar a otro email? (opcional)",
    alternateEmailPlaceholder: "otro@email.com",
    missingEmailLabel: "Este cliente no tiene email. Indica uno para enviar la factura:",
    missingEmailPlaceholder: "cliente@email.com",
    dniLabel: "DNI del cliente",
    dniPlaceholder: "",
    addressLabel: "Domicilio del cliente",
    addressPlaceholder: "",
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
    filterSearch: "Buscar en la factura...",
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
    tabGenerated: "Generadas",
    tabPending: "Pendientes",
    pendingEmptyTitle: "No hay facturas pendientes",
    pendingEmptySubtitle: "Las citas pagadas sin factura generada aparecerán aquí.",
    generateInvoice: "Generar factura",
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
    conceptsSectionTitle: "Invoice concepts",
    conceptsSectionSubtitle: "The list of concepts you can pick from when generating an invoice. Add, edit, or remove them as needed.",
    conceptsEmpty: "You haven't added any concepts yet.",
    conceptsAddPlaceholder: "New concept…",
    conceptsAdd: "Add",
    conceptsEdit: "Edit",
    conceptsSave: "Save",
    conceptsCancel: "Cancel",
  },
  confirmModal: {
    title: "Generate an invoice?",
    serviceLabel: "Service",
    conceptLabel: "Additional invoice concept (optional)",
    conceptPlaceholder: "e.g. Chiropody",
    yesGenerateAndSend: "Generate and send email",
    yesGenerateOnly: "Generate only",
    no: "No",
    sendEmailCheckboxLabel: "Email the invoice to the client",
    alternateEmailLabel: "Send to a different email? (optional)",
    alternateEmailPlaceholder: "other@email.com",
    missingEmailLabel: "This client has no email on file. Enter one to send the invoice:",
    missingEmailPlaceholder: "client@email.com",
    dniLabel: "Client's DNI",
    dniPlaceholder: "",
    addressLabel: "Client's address",
    addressPlaceholder: "",
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
    filterSearch: "Search the invoice...",
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
    tabGenerated: "Generated",
    tabPending: "Pending",
    pendingEmptyTitle: "No pending invoices",
    pendingEmptySubtitle: "Paid appointments with no invoice yet will show up here.",
    generateInvoice: "Generate invoice",
  },
};

const INVOICING_DICTIONARIES: Record<Locale, InvoicingDictionary> = { es, en };

export function getInvoicingDictionary(locale: Locale): InvoicingDictionary {
  return INVOICING_DICTIONARIES[locale];
}
