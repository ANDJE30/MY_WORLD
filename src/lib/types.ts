export type OffreCode = 'CRN' | 'SPT' | 'INF'
export type PrestationType = 'matiere' | 'activite' | 'module'
export type SessionStatut = 'ouverte' | 'fermee' | 'brouillon'
export type Operateur = 'MTN' | 'ORANGE'
export type PaiementStatut = 'INITIEE' | 'EN_ATTENTE' | 'REUSSIE' | 'ECHOUEE' | 'EXPIREE' | 'REMBOURSEE'
export type CommandeStatut = 'BROUILLON' | 'EN_ATTENTE_PAIEMENT' | 'CONFIRMEE' | 'EXPIREE' | 'ANNULEE' | 'LISTE_ATTENTE'
export type InscriptionStatut = 'RESERVEE' | 'CONFIRMEE' | 'LISTE_ATTENTE' | 'LIBEREE' | 'ANNULEE'
export type Role = 'admin' | 'economat' | 'resp_crn' | 'resp_spt' | 'resp_inf'

export interface Offre {
  code: OffreCode
  libelle: string
}

export interface Session {
  id: string
  offre: OffreCode
  intitule: string
  debut: string // ISO 8601
  fin: string
  limite: string
  statut: SessionStatut
}

export interface Prestation {
  id: string
  sessionId: string
  type: PrestationType
  libelle: string
  description?: string
  tarif: number
  places: number // effectif maximal par groupe
  creneau?: string // code de créneau
  creneauLibelle?: string
  prerequis?: string // id de prestation
  duree?: number
  niveaux?: string[] // CRN : classes préparées concernées
  categories?: string[] // SPT : catégories ouvertes
  sexe?: 'F' | 'M' // SPT : activité réservée
  code?: string
}

export interface CategorieAge {
  code: string
  min: number
  max: number
  libelle: string
}

export interface Parametres {
  forfaitPlafondCRN: number
  remiseINF: { minModules: number; pct: number }
  frais: { mode: 'absorbes' | 'ajoutes'; pct: number }
  certificatMedical: boolean
  delaiPaiementMin: number
  reservationMin: number
}

export interface Participant {
  id: string
  offre: OffreCode
  nom: string
  prenoms: string
  sexe: 'F' | 'M' | ''
  naissance: string // JJ/MM/AAAA (saisie)
  // CRN
  eleveCollege?: 'oui' | 'non' | ''
  matricule?: string
  etablissement?: string
  classePrecedente?: string
  classePreparee?: string
  observations?: string
  // parent (CRN, SPT, INF élève)
  parentNom: string
  parentTel: string
  parentEmail: string
  // SPT
  urgenceNom?: string
  urgenceTel?: string
  autorisation?: boolean
  certificat?: { nom: string; taille: number } | null
  // INF
  tel?: string
  email?: string
  profession?: 'eleve' | 'etudiant' | 'enseignant' | 'autre' | ''
  classe?: string
  discipline?: string
  professionExercee?: string
  // choix
  choix: string[]
}

export interface LigneCommande {
  participantId: string
  participantNom: string
  prestationId: string | null
  libelle: string
  detail?: string
  qte: number
  pu: number
  montant: number
  kind: 'ligne' | 'remise'
  attente?: boolean
}

export interface Devis {
  lignes: LigneCommande[]
  sousTotal: number
  remises: number
  total: number
  frais: number
  aPayer: number
  attente: LigneCommande[]
}

export interface Payeur {
  nom: string
  tel: string
  email: string
}

export interface Commande {
  id: string
  payeur: Payeur
  participants: Participant[]
  devis: Devis
  offres: OffreCode[]
  statut: CommandeStatut
  creeLe: string
  expireLe: string
  sessionIds: string[]
  consentement: { cgu: boolean; donnees: boolean; horodatage: string }
}

export interface Paiement {
  id: string
  commandeId: string
  operateur: Operateur
  numero: string // E.164
  referenceInterne: string
  referenceOperateur?: string
  montant: number
  statut: PaiementStatut
  creeLe: string
  expireLe: string
  misAJourLe: string
  motifEchec?: string
  notifications: number
}

export interface Facture {
  id: string
  numero: string
  commandeId: string
  paiementId: string
  montant: number
  date: string
  code: string
  offre: OffreCode | 'MUL'
  duplicata?: number
}

export interface Avoir {
  id: string
  numero: string
  factureNumero: string
  montant: number
  motif: string
  utilisateur: string
  date: string
}

export interface Utilisateur {
  id: string
  nom: string
  email: string
  role: Role
  actif: boolean
  motDePasse: string
  derniereConnexion?: string
}

export interface AuditEntry {
  id: string
  date: string
  utilisateur: string
  action: string
  objet: string
  avant?: string
  apres?: string
}

export interface SmsLog {
  id: string
  date: string
  canal: 'SMS' | 'EMAIL'
  destinataire: string
  message: string
}

export interface TarifHistorique {
  prestationId: string
  ancien: number
  nouveau: number
  date: string
  utilisateur: string
}

export interface Rapprochement {
  date: string
  transactions: number
  ecarts: { reference: string; detail: string }[]
}

export const OFFRES: Record<OffreCode, Offre> = {
  CRN: { code: 'CRN', libelle: 'Cours de remise à niveau' },
  SPT: { code: 'SPT', libelle: 'VOGT Sport' },
  INF: { code: 'INF', libelle: 'Formation en informatique' },
}
