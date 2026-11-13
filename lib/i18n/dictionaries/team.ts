import type { Locale } from "../config";

/**
 * Dictionary for the Equipo (team) panel page: the page itself, TeamManager
 * (solo/team mode selector, inline-editable member rows, single commit), and the user-facing
 * error messages from lib/actions/team.ts. Also covers the fallback display
 * name used by ensureOwnerSeeded (lib/team/data.ts) when the owner's account
 * has no name set.
 */
export interface TeamDictionary {
  page: {
    title: string;
    subtitle: string;
  };
  manager: {
    howDoYouWork: string;
    soloTitle: string;
    soloSub: string;
    teamTitle: string;
    teamSub: string;
    you: string;
    edit: string; // aria-label on the edit-pencil button
    delete: string;
    addMember: string;
    saveTeam: string; // unused now that every action commits immediately; kept for a possible future bulk-edit mode
    disabledBadge: string; // "Desactivado" — shown on a member with bookings that was deleted-as-disabled
    reactivate: string;
    confirmDelete: string; // inline confirm prompt shown on the member's own row
    confirmDeleteYes: string;
    confirmDeleteNo: string;
    panelTitleNew: string;
    panelTitleEdit: string;
    panelClose: string; // aria-label
    panelCancel: string;
    panelSave: string;
    noRole: string; // shown on the list row when a member has no role set
    nameLabel: string;
    namePlaceholder: string;
    roleLabel: string;
    rolePlaceholder: string;
    professionalDataTitle: string;
    professionalDataSubtitle: string;
    // provider-invoicing-fields (pdf-invoicing.md, 2026-10): per-member DNI
    // + professional college number, shown on invoices generated for
    // bookings assigned to that member — moved here from a single
    // business-level field so each team member can have their own.
    dniLabel: string;
    dniPlaceholder: string;
    collegeNumberLabel: string;
    collegeNumberPlaceholder: string;
    // professional-title-on-invoice: printed above the DNI/Nº colegiada
    // line on the invoice, e.g. "Podóloga" — nullable, no fallback text.
    titleLabel: string;
    titlePlaceholder: string;
    // per-member-invoice-signature (schema_subset_040.sql, 2026-11): each
    // member's own signature, printed on invoices for bookings assigned to
    // them. Moved here from the old single business-level Settings field —
    // same upload/draw UI, just scoped per member now. Only shown when
    // editing an existing member (a brand-new one has no id to attach it
    // to yet).
    signatureSectionTitle: string;
    signatureSectionSubtitle: string;
    signatureUpload: string;
    signatureChange: string;
    signatureRemove: string;
    signatureUploading: string;
    signatureDrawButton: string;
    signatureDrawHint: string;
    signatureDrawClear: string;
    signatureDrawSave: string;
    signatureDrawCancel: string;
    errSignatureEmpty: string;
    saving: string;
    flashSuccess: string; // success flash shown in the save overlay
    errUnexpected: string;
  };
  errors: {
    // lib/actions/team.ts
    errInvalidMode: string;
    errNoBusiness: string;
    errCannotGoSolo: string;
    errSaveFailed: string; // prefix; server detail appended
    errTeamModeRequired: string;
    errNameRequired: string;
    errNameTooLong: string; // contains "{max}"
    errRoleTooLong: string; // contains "{max}"
    errAddFailed: string; // prefix; server detail appended
    errCannotDeleteOwner: string;
    errDeleteFailed: string; // prefix; server detail appended
    errReorderFailed: string; // prefix; server detail appended
    errInvalidFile: string; // signature upload
  };
  // Fallback display name for the owner when their account has no name set
  // (lib/team/data.ts ensureOwnerSeeded).
  ownerFallbackName: string;
}

const es: TeamDictionary = {
  page: {
    title: "Tu equipo",
    subtitle: "¿Trabajas en solitario o con un equipo? Configúralo aquí.",
  },
  manager: {
    howDoYouWork: "¿Cómo trabajas?",
    soloTitle: "Individual",
    soloSub: "Solo tú atiendes las citas",
    teamTitle: "Equipo",
    teamSub: "Varias personas atienden citas",
    you: "Tú",
    edit: "Editar",
    delete: "Eliminar",
    addMember: "Añadir miembro",
    saveTeam: "Guardar cambios",
    disabledBadge: "Desactivado",
    reactivate: "Reactivar",
    confirmDelete: "¿Eliminar?",
    confirmDeleteYes: "Eliminar",
    confirmDeleteNo: "Cancelar",
    panelTitleNew: "Nuevo miembro",
    panelTitleEdit: "Editar miembro",
    panelClose: "Cerrar",
    panelCancel: "Cancelar",
    panelSave: "Guardar",
    noRole: "Sin rol asignado",
    nameLabel: "Nombre",
    namePlaceholder: "Nombre y apellido",
    roleLabel: "Rol",
    rolePlaceholder: "Rol",
    professionalDataTitle: "Datos del profesional",
    professionalDataSubtitle: "Aparecen en las facturas y recordatorios de sus citas.",
    dniLabel: "DNI",
    dniPlaceholder: "12345678A",
    collegeNumberLabel: "Nº de colegiada/o",
    collegeNumberPlaceholder: "838282838",
    titleLabel: "Título profesional",
    titlePlaceholder: "Podóloga",
    signatureSectionTitle: "Firma",
    signatureSectionSubtitle: "Se muestra en las facturas de sus citas. Si no subes ninguna, esa zona queda en blanco.",
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
    saving: "Guardando…",
    flashSuccess: "¡Guardado correctamente!",
    errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
  },
  errors: {
    errInvalidMode: "Modo no válido.",
    errNoBusiness: "Primero configura tu negocio.",
    errCannotGoSolo: "Para cambiar a modo individual, elimina primero a los demás miembros.",
    errSaveFailed: "No se pudo guardar:",
    errTeamModeRequired: "Activa el modo equipo para añadir miembros.",
    errNameRequired: "El nombre del miembro es obligatorio.",
    errNameTooLong: "El nombre no puede superar los {max} caracteres.",
    errRoleTooLong: "El rol no puede superar los {max} caracteres.",
    errAddFailed: "No se pudo añadir el miembro:",
    errCannotDeleteOwner: "No puedes eliminar al propietario.",
    errDeleteFailed: "No se pudo eliminar:",
    errReorderFailed: "No se pudo reordenar:",
    errInvalidFile: "Sube una imagen PNG, JPG o WEBP de hasta 2MB.",
  },
  ownerFallbackName: "Yo",
};

const en: TeamDictionary = {
  page: {
    title: "Your team",
    subtitle: "Do you work alone or with a team? Set it up here.",
  },
  manager: {
    howDoYouWork: "How do you work?",
    soloTitle: "Individual",
    soloSub: "Only you handle appointments",
    teamTitle: "Team",
    teamSub: "Several people handle appointments",
    you: "You",
    edit: "Edit",
    delete: "Delete",
    addMember: "Add member",
    saveTeam: "Save changes",
    disabledBadge: "Disabled",
    reactivate: "Reactivate",
    confirmDelete: "Delete?",
    confirmDeleteYes: "Delete",
    confirmDeleteNo: "Cancel",
    panelTitleNew: "New member",
    panelTitleEdit: "Edit member",
    panelClose: "Close",
    panelCancel: "Cancel",
    panelSave: "Save",
    noRole: "No role set",
    nameLabel: "Name",
    namePlaceholder: "First and last name",
    roleLabel: "Role",
    rolePlaceholder: "Role",
    professionalDataTitle: "Professional details",
    professionalDataSubtitle: "Shown on invoices and reminders for their appointments.",
    dniLabel: "DNI",
    dniPlaceholder: "12345678A",
    collegeNumberLabel: "Professional college number",
    collegeNumberPlaceholder: "838282838",
    titleLabel: "Professional title",
    titlePlaceholder: "Podiatrist",
    signatureSectionTitle: "Signature",
    signatureSectionSubtitle: "Shown on invoices for their appointments. If none is uploaded, that area stays blank.",
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
    saving: "Saving…",
    flashSuccess: "Saved successfully!",
    errUnexpected: "An unexpected error occurred. Please try again.",
  },
  errors: {
    errInvalidMode: "Invalid mode.",
    errNoBusiness: "Set up your business first.",
    errCannotGoSolo: "To switch to solo mode, remove the other members first.",
    errSaveFailed: "Couldn't save:",
    errTeamModeRequired: "Turn on team mode to add members.",
    errNameRequired: "The member's name is required.",
    errNameTooLong: "The name can't be more than {max} characters.",
    errRoleTooLong: "The role can't be more than {max} characters.",
    errAddFailed: "Couldn't add the member:",
    errCannotDeleteOwner: "You can't delete the owner.",
    errDeleteFailed: "Couldn't delete:",
    errReorderFailed: "Couldn't reorder:",
    errInvalidFile: "Upload a PNG, JPG, or WEBP image up to 2MB.",
  },
  ownerFallbackName: "Me",
};

const TEAM_DICTIONARIES: Record<Locale, TeamDictionary> = { es, en };

export function getTeamDictionary(locale: Locale): TeamDictionary {
  return TEAM_DICTIONARIES[locale];
}
