import type { Locale } from "../config";

/**
 * Dictionary for /panel/support — the ticket submit form, the clinic's own
 * ticket list/detail/comment view, and the category/status labels shared
 * with the admin portal's reading of the same enums. See
 * workflows/support-ticketing.md.
 */
export interface SupportDictionary {
  pageTitle: string;
  pageSubtitle: string;
  newTicketButton: string;

  categories: {
    billing: string;
    technical: string;
    feature_request: string;
    account: string;
    other: string;
  };
  statuses: {
    open: string;
    in_progress: string;
    resolved: string;
    closed: string;
  };
  sources: {
    panel: string;
    whatsapp: string;
    email: string;
    phone: string;
    other: string;
  };

  // Submit form
  formTitle: string;
  categoryLabel: string;
  subjectLabel: string;
  subjectPlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  attachmentsLabel: string;
  attachmentsHint: string; // contains "{maxFiles}" and "{maxSizeMb}"
  attachButton: string;
  errSubjectRequired: string;
  errDescriptionRequired: string;
  errFileTooBig: string; // contains "{name}" and "{maxSizeMb}"
  errFileInvalidType: string; // contains "{name}"
  submitButton: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  newQueryButton: string;
  cancel: string;

  // Ticket list
  listTitle: string;
  listEmpty: string;
  listEmptyFiltered: string;
  filterAll: string;
  loggedByAdminNote: string; // shown on a ticket reported_via !== "panel"; contains "{channel}"
  commentCountTemplate: string; // "{n} comentario(s)"

  // Ticket detail panel
  detailClose: string;
  attachmentsSection: string;
  commentsSection: string;
  noComments: string;
  replyPlaceholder: string;
  replyButton: string;
  replySending: string;
  errReplyFailed: string;
  errEmptyReply: string;
  commentEdit: string;
  commentDelete: string;
  commentDeleteConfirm: string;
  commentSave: string;
  commentCancel: string;
  lightboxClose: string;
}

const es: SupportDictionary = {
  pageTitle: "Soporte",
  pageSubtitle: "¿Tienes alguna duda o problema? Cuéntanos y te ayudamos.",
  newTicketButton: "+ Nueva consulta",

  categories: {
    billing: "Facturación o pagos",
    technical: "Problema técnico",
    feature_request: "Sugerencia o mejora",
    account: "Mi cuenta",
    other: "Otro",
  },
  statuses: {
    open: "Abierto",
    in_progress: "En progreso",
    resolved: "Resuelto",
    closed: "Cerrado",
  },
  sources: {
    panel: "Panel",
    whatsapp: "WhatsApp",
    email: "Email",
    phone: "Teléfono",
    other: "Otro",
  },

  formTitle: "Nueva consulta",
  categoryLabel: "Tipo de consulta",
  subjectLabel: "Asunto",
  subjectPlaceholder: "Ej: No puedo acceder a mi cuenta",
  descriptionLabel: "Descripción",
  descriptionPlaceholder: "Explícanos con detalle qué está ocurriendo o qué necesitas...",
  attachmentsLabel: "Capturas de pantalla",
  attachmentsHint: "(opcional, máx. {maxFiles} imágenes de hasta {maxSizeMb} MB)",
  attachButton: "Adjuntar imagen",
  errSubjectRequired: "Por favor, escribe un asunto.",
  errDescriptionRequired: "Por favor, describe tu consulta.",
  errFileTooBig: "\"{name}\" supera los {maxSizeMb} MB permitidos.",
  errFileInvalidType: "\"{name}\" no es una imagen válida.",
  submitButton: "Enviar consulta",
  submitting: "Enviando…",
  successTitle: "¡Mensaje enviado!",
  successBody: "Hemos recibido tu consulta. Nuestro equipo la revisará y te responderemos pronto.",
  newQueryButton: "Enviar otra consulta",
  cancel: "Cancelar",

  listTitle: "Tus consultas",
  listEmpty: "Aún no has enviado ninguna consulta.",
  listEmptyFiltered: "No tienes consultas con este estado.",
  filterAll: "Todos",
  loggedByAdminNote: "Registrado por el equipo de Kalendar desde {channel}.",
  commentCountTemplate: "{n} comentario(s)",

  detailClose: "Cerrar",
  attachmentsSection: "Capturas de pantalla",
  commentsSection: "Comentarios",
  noComments: "Sin comentarios todavía.",
  replyPlaceholder: "Escribe una respuesta...",
  replyButton: "Enviar",
  replySending: "Enviando…",
  errReplyFailed: "No se pudo enviar el comentario.",
  errEmptyReply: "Escribe un mensaje o adjunta una imagen.",
  commentEdit: "Editar",
  commentDelete: "Eliminar",
  commentDeleteConfirm: "¿Eliminar este comentario?",
  commentSave: "Guardar",
  commentCancel: "Cancelar",
  lightboxClose: "Cerrar",
};

const en: SupportDictionary = {
  pageTitle: "Support",
  pageSubtitle: "Have a question or issue? Tell us and we'll help.",
  newTicketButton: "+ New query",

  categories: {
    billing: "Billing or payments",
    technical: "Technical issue",
    feature_request: "Suggestion or improvement",
    account: "My account",
    other: "Other",
  },
  statuses: {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Closed",
  },
  sources: {
    panel: "Panel",
    whatsapp: "WhatsApp",
    email: "Email",
    phone: "Phone",
    other: "Other",
  },

  formTitle: "New query",
  categoryLabel: "Query type",
  subjectLabel: "Subject",
  subjectPlaceholder: "E.g. I can't access my account",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Tell us in detail what's happening or what you need...",
  attachmentsLabel: "Screenshots",
  attachmentsHint: "(optional, up to {maxFiles} images, {maxSizeMb} MB each)",
  attachButton: "Attach image",
  errSubjectRequired: "Please enter a subject.",
  errDescriptionRequired: "Please describe your query.",
  errFileTooBig: "\"{name}\" is larger than the {maxSizeMb} MB limit.",
  errFileInvalidType: "\"{name}\" isn't a valid image.",
  submitButton: "Send query",
  submitting: "Sending…",
  successTitle: "Message sent!",
  successBody: "We've received your query. Our team will review it and get back to you soon.",
  newQueryButton: "Send another query",
  cancel: "Cancel",

  listTitle: "Your queries",
  listEmpty: "You haven't sent any queries yet.",
  listEmptyFiltered: "You have no queries with this status.",
  filterAll: "All",
  loggedByAdminNote: "Logged by the Kalendar team from {channel}.",
  commentCountTemplate: "{n} comment(s)",

  detailClose: "Close",
  attachmentsSection: "Screenshots",
  commentsSection: "Comments",
  noComments: "No comments yet.",
  replyPlaceholder: "Write a reply...",
  replyButton: "Send",
  replySending: "Sending…",
  errReplyFailed: "Couldn't send the comment.",
  errEmptyReply: "Write a message or attach an image.",
  commentEdit: "Edit",
  commentDelete: "Delete",
  commentDeleteConfirm: "Delete this comment?",
  commentSave: "Save",
  commentCancel: "Cancel",
  lightboxClose: "Close",
};

const SUPPORT_DICTIONARIES: Record<Locale, SupportDictionary> = { es, en };

export function getSupportDictionary(locale: Locale): SupportDictionary {
  return SUPPORT_DICTIONARIES[locale];
}
