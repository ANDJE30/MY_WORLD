// Référentiels et libellés partagés (serveur et navigateur).

export const APP_NAME = 'SVTC Répétitions';
export const TIMEZONE = 'Africa/Douala';

export const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'] as const;
export const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] as const;

export const ROLE_LABELS = { ADMIN: 'Administrateur', ENCADREUR: 'Encadreur', PARENT: 'Parent' } as const;

export const SEANCE_STATUS = {
  PLANIFIEE: { label: 'Planifiée', tone: 'slate' },
  EN_COURS: { label: 'En cours', tone: 'blue' },
  TERMINEE: { label: 'Terminée', tone: 'green' },
  ANNULEE: { label: 'Annulée', tone: 'red' },
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT: { label: 'Présent', short: 'P', tone: 'green' },
  RETARD: { label: 'En retard', short: 'R', tone: 'amber' },
  ABSENT: { label: 'Absent', short: 'A', tone: 'red' },
  EXCUSE: { label: 'Absence justifiée', short: 'J', tone: 'slate' },
} as const;

export const PAYMENT_METHODS = {
  ESPECES: 'Espèces',
  MTN_MOMO: 'MTN Mobile Money',
  ORANGE_MONEY: 'Orange Money',
  VIREMENT: 'Virement bancaire',
  AUTRE: 'Autre',
} as const;

export const PAYMENT_TYPES = { INSCRIPTION: "Frais d'inscription", MENSUALITE: 'Mensualité', AUTRE: 'Autre frais' } as const;

export const EXPENSE_CATEGORIES = {
  LOCATION_SALLE: 'Location des salles',
  SALAIRE: 'Salaires des encadreurs',
  FOURNITURES: 'Fournitures et impressions',
  COMMUNICATION: 'Communication (SMS, internet, crédit)',
  TRANSPORT: 'Transport',
  ENTRETIEN: 'Entretien et matériel',
  AUTRE: 'Autres dépenses',
} as const;

export const DOCUMENT_TYPES = {
  FICHE_TD: 'Fiche de TD',
  CORRIGE: 'Corrigé',
  COURS: 'Support de cours',
  EPREUVE: 'Épreuve / sujet d’examen',
  AUTRE: 'Autre document',
} as const;

export const DOCUMENT_STATUS = {
  SOUMIS: { label: 'À examiner', tone: 'amber' },
  APPROUVE: { label: 'Approuvé', tone: 'green' },
  A_REVOIR: { label: 'À revoir', tone: 'red' },
} as const;

export const EVALUATION_TYPES = {
  TD: 'Travaux dirigés',
  TP: 'Travaux pratiques',
  INTERROGATION: 'Interrogation',
  DEVOIR: 'Devoir surveillé',
  EXAMEN_BLANC: 'Examen blanc',
} as const;

export const MESSAGE_CATEGORIES = {
  INFO: { label: 'Information', tone: 'blue' },
  RAPPEL_PAIEMENT: { label: 'Rappel de paiement', tone: 'amber' },
  ABSENCE: { label: 'Absence', tone: 'red' },
  SUIVI: { label: 'État de suivi', tone: 'green' },
  REUNION: { label: 'Réunion', tone: 'violet' },
  URGENT: { label: 'Urgent', tone: 'red' },
} as const;

export const STUDENT_STATUS = {
  ACTIF: { label: 'Actif', tone: 'green' },
  SUSPENDU: { label: 'Suspendu', tone: 'amber' },
  ABANDON: { label: 'A quitté le centre', tone: 'slate' },
} as const;

export const SALARY_MODES = {
  PRORATA: 'Salaire mensuel au prorata des heures effectuées',
  HORAIRE: 'Taux horaire × heures effectuées',
} as const;

/** Modèles de messages proposés à l'administrateur ({parent}, {eleve}, {classe}, {solde}, {centre}, {telephone}). */
export const MESSAGE_TEMPLATES: { key: string; category: keyof typeof MESSAGE_CATEGORIES; subject: string; body: string }[] = [
  {
    key: 'rappel',
    category: 'RAPPEL_PAIEMENT',
    subject: 'Rappel de paiement',
    body: 'Bonjour {parent}, sauf erreur de notre part, il reste {solde} à régler pour les répétitions de {eleve} ({classe}). Merci de régulariser au plus vite. {centre} — {telephone}',
  },
  {
    key: 'reunion',
    category: 'REUNION',
    subject: 'Réunion des parents',
    body: 'Bonjour {parent}, vous êtes cordialement invité(e) à la réunion des parents du {centre} le [date] à [heure] au Centre Éducatif TYRANNUS (Biyem-Assi Lac). Votre présence est importante.',
  },
  {
    key: 'absence',
    category: 'ABSENCE',
    subject: 'Absence aux répétitions',
    body: 'Bonjour {parent}, nous vous informons que {eleve} ({classe}) était absent(e) à la dernière séance de répétition. Merci de nous contacter au {telephone}.',
  },
  {
    key: 'info',
    category: 'INFO',
    subject: 'Information',
    body: 'Bonjour {parent}, ',
  },
  {
    key: 'examens',
    category: 'INFO',
    subject: 'Préparation aux examens officiels',
    body: 'Bonjour {parent}, les séances intensives de préparation aux examens officiels démarrent bientôt pour {eleve} ({classe}). Programme disponible dans votre espace parent. {centre}',
  },
];
