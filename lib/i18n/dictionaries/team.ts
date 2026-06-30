import type { Locale } from "../config";

/**
 * Dictionary for the Equipo (team) panel page: the page itself, TeamManager
 * (solo/team mode selector, member list, inline editor), and the user-facing
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
    edit: string;
    delete: string;
    addMember: string;
    continueButton: string;
    nameLabel: string;
    nameYouHint: string;
    namePlaceholder: string;
    roleLabel: string;
    roleOptionalHint: string;
    rolePlaceholder: string;
    save: string;
    saving: string;
    cancel: string;
    errUnexpected: string;
    errDeleteFailed: string;
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
    soloTitle: "En solitario",
    soloSub: "Solo tú atiendes las citas",
    teamTitle: "En equipo",
    teamSub: "Varias personas atienden citas",
    you: "Tú",
    edit: "Editar",
    delete: "Eliminar",
    addMember: "Añadir miembro",
    continueButton: "Continuar",
    nameLabel: "Nombre",
    nameYouHint: "(tú)",
    namePlaceholder: "Nombre y apellido",
    roleLabel: "Rol",
    roleOptionalHint: "(opcional)",
    rolePlaceholder: "Fisioterapeuta",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    errUnexpected: "Ocurrió un error inesperado. Inténtalo de nuevo.",
    errDeleteFailed: "No se pudo eliminar. Inténtalo de nuevo.",
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
    soloTitle: "Solo",
    soloSub: "Only you handle appointments",
    teamTitle: "As a team",
    teamSub: "Several people handle appointments",
    you: "You",
    edit: "Edit",
    delete: "Delete",
    addMember: "Add member",
    continueButton: "Continue",
    nameLabel: "Name",
    nameYouHint: "(you)",
    namePlaceholder: "First and last name",
    roleLabel: "Role",
    roleOptionalHint: "(optional)",
    rolePlaceholder: "Physiotherapist",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    errUnexpected: "An unexpected error occurred. Please try again.",
    errDeleteFailed: "Couldn't delete. Please try again.",
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
  },
  ownerFallbackName: "Me",
};

const TEAM_DICTIONARIES: Record<Locale, TeamDictionary> = { es, en };

export function getTeamDictionary(locale: Locale): TeamDictionary {
  return TEAM_DICTIONARIES[locale];
}
