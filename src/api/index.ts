/**
 * Façade de l'API REST (§11.4). Chaque fonction correspond à un point d'accès de la spécification ;
 * ici elle s'appuie sur une base locale de démonstration. Pour passer au serveur Laravel, seul ce fichier change.
 */
import { db, resetDemo } from './db'
import {
  catalogueOf, confirmerPaiement, creerCommande, devisPour, echouerPaiement, emettreAvoir, lancerPaiement, log, restantes,
  sms, tick, traiterWebhook, type CommandeInput,
} from './domain'
import type { Commande, Facture, Operateur, Paiement, Participant, Role, Utilisateur } from '../lib/types'
import { nationalDigits, toE164 } from '../lib/phone'
import { groupeKey, sessionDe } from '../lib/rules'

const wait = (ms = 280) => new Promise((r) => setTimeout(r, ms))

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

/* ------------------------------ Public ------------------------------ */

/** GET /api/v1/offres */
export async function getOffres() {
  await wait(180)
  tick(db)
  const cat = catalogueOf(db)
  return cat.sessions
    .filter((s) => s.statut === 'ouverte')
    .map((s) => {
      const prestations = db.prestations.filter((p) => p.sessionId === s.id)
      // places restantes : somme des groupes connus (indicatif) ou capacité des modules/activités
      let places = 0
      let capacite = 0
      for (const p of prestations) {
        const keys = Object.keys(db.base).filter((k) => k === p.id || k.startsWith(`${p.id}|`))
        const groupes = p.type === 'module' ? [p.id] : p.type === 'matiere' ? (p.niveaux ?? []).map((n) => `${p.id}|${n}`) : (p.categories ?? []).map((c) => `${p.id}|${c}`)
        void keys
        for (const g of groupes) {
          capacite += p.places
          places += restantes(db, g, p.places)
        }
      }
      return { session: s, prestations, places, capacite }
    })
}

export function disponibilite(prestationId: string, participant: Participant): { restantes: number; max: number; complet: boolean } {
  const pr = db.prestations.find((x) => x.id === prestationId)!
  const cat = catalogueOf(db)
  const session = sessionDe(cat, participant.offre)
  const key = groupeKey(participant, pr, cat, session)
  const left = restantes(db, key, pr.places)
  return { restantes: left, max: pr.places, complet: left <= 0 }
}

export function devis(participants: Participant[]) {
  return devisPour(db, participants)
}

export function doublon(p: Participant): boolean {
  const key = (x: Participant) => `${x.nom.trim().toUpperCase()}|${x.prenoms.trim().toLowerCase()}|${x.naissance}`
  return db.commandes.some(
    (c) => (c.statut === 'CONFIRMEE' || c.statut === 'EN_ATTENTE_PAIEMENT') && c.participants.some((x) => x.offre === p.offre && x.offre !== 'INF' && key(x) === key(p)),
  )
}

/** POST /api/v1/commandes */
export async function postCommande(input: CommandeInput): Promise<Commande> {
  await wait(450)
  try {
    return creerCommande(db, input)
  } catch (e) {
    throw new ApiError('COMMANDE', (e as Error).message)
  }
}

export function getCommande(id: string): Commande | undefined {
  tick(db)
  return db.commandes.find((c) => c.id === id)
}

/** POST /api/v1/commandes/{id}/paiement */
export async function postPaiement(commandeId: string, operateur: Operateur, numero: string): Promise<Paiement> {
  await wait(700)
  try {
    return lancerPaiement(db, commandeId, operateur, numero)
  } catch (e) {
    const m = (e as Error).message
    if (m === 'PLACE_PRISE') throw new ApiError('PLACE_PRISE', 'Une place a été attribuée à une autre personne pendant l’attente. Aucun débit n’a été effectué.')
    throw new ApiError('PAIEMENT', m)
  }
}

/** GET /api/v1/paiements/{reference} */
export function getPaiement(id: string): Paiement | undefined {
  tick(db)
  return db.paiements.find((p) => p.id === id)
}

/** Bac à sable : simule la réponse de l'opérateur sur le téléphone du payeur. */
export async function sandboxOperateur(paiementId: string, action: 'accept' | 'refuse' | 'ignore', motif = 'Solde insuffisant.') {
  await wait(500)
  const p = db.paiements.find((x) => x.id === paiementId)
  if (!p || p.statut !== 'EN_ATTENTE') return
  if (action === 'accept') {
    // webhook signé reçu, puis statut vérifié par l'API du prestataire
    traiterWebhook(db, { reference: p.referenceInterne, statut: 'SUCCESS', signatureValide: true })
  } else if (action === 'refuse') {
    traiterWebhook(db, { reference: p.referenceInterne, statut: 'FAILED', motif, signatureValide: true })
  } else {
    p.expireLe = new Date(Date.now() - 1000).toISOString()
    tick(db)
  }
}

/** POST /api/v1/webhooks/paiement (bac à sable : rejeu et signature falsifiée). */
export async function sandboxWebhook(paiementId: string, kind: 'rejeu' | 'falsifie') {
  await wait(400)
  const p = db.paiements.find((x) => x.id === paiementId)
  if (!p) return { ok: false, message: 'Paiement introuvable.' }
  return traiterWebhook(db, { reference: p.referenceInterne, statut: 'SUCCESS', signatureValide: kind === 'rejeu' })
}

export function getFacturePack(codeOuNumero: string) {
  const f = db.factures.find((x) => x.code === codeOuNumero || x.numero === codeOuNumero)
  if (!f) return null
  const commande = db.commandes.find((c) => c.id === f.commandeId)!
  const paiement = db.paiements.find((p) => p.id === f.paiementId)!
  const avoirs = db.avoirs.filter((a) => a.factureNumero === f.numero)
  return { facture: f, commande, paiement, avoirs, session: db.sessions }
}

export function getFacturePourPaiement(paiementId: string): Facture | undefined {
  return db.factures.find((f) => f.paiementId === paiementId)
}

/** GET /verifier/{code} — aucune donnée personnelle. */
export async function verifier(code: string) {
  await wait(350)
  const f = db.factures.find((x) => x.code === code.trim().toUpperCase() || x.numero === code.trim().toUpperCase())
  if (!f) return null
  const rembourse = db.avoirs.filter((a) => a.factureNumero === f.numero).reduce((s, a) => s + a.montant, 0)
  return { numero: f.numero, date: f.date, montant: f.montant, statut: rembourse >= f.montant ? 'REMBOURSEE' : 'PAYEE', avoir: rembourse }
}

/* ------------------------------ Mon espace ------------------------------ */

const otps = new Map<string, { code: string; expire: number; essais: number }>()
export const DEMO_OTP = '123456'

/** POST /api/v1/espace/code */
export async function demanderCode(tel: string) {
  await wait(500)
  const e164 = toE164(tel)
  otps.set(e164, { code: DEMO_OTP, expire: Date.now() + 5 * 60000, essais: 0 })
  sms(db, 'SMS', e164, `Collège Vogt : votre code de connexion est ${DEMO_OTP}. Valable 5 minutes.`)
  return { envoye: true }
}

export async function verifierCode(tel: string, code: string) {
  await wait(450)
  const e164 = toE164(tel)
  const o = otps.get(e164)
  if (!o || o.expire < Date.now()) throw new ApiError('OTP_EXPIRE', 'Le code a expiré. Demandez-en un nouveau.')
  o.essais += 1
  if (o.essais > 5) throw new ApiError('OTP_TROP', 'Trop de tentatives. Demandez un nouveau code.')
  if (o.code !== code.trim()) throw new ApiError('OTP_FAUX', 'Code incorrect. Vérifiez le SMS reçu.')
  otps.delete(e164)
  return espaceDe(e164)
}

export function espaceDe(e164: string) {
  tick(db)
  const n = nationalDigits(e164)
  const commandes = db.commandes.filter((c) => nationalDigits(c.payeur.tel) === n)
  const factures = db.factures.filter((f) => commandes.some((c) => c.id === f.commandeId))
  return { tel: e164, commandes, factures }
}

/* ------------------------------ Back-office ------------------------------ */

const tentatives = new Map<string, { n: number; jusque?: number }>()
export const DEMO_TOTP = '123456'

export async function adminLogin(email: string, motDePasse: string, code: string): Promise<Utilisateur> {
  await wait(600)
  const key = email.trim().toLowerCase()
  const t = tentatives.get(key) ?? { n: 0 }
  if (t.jusque && t.jusque > Date.now()) throw new ApiError('VERROU', 'Trop de tentatives. Réessayez dans une minute.')
  const u = db.utilisateurs.find((x) => x.email === key && x.actif)
  const bad = !u || u.motDePasse !== motDePasse
  if (bad || code.trim() !== DEMO_TOTP) {
    t.n += 1
    if (t.n >= 5) { t.jusque = Date.now() + 60000; t.n = 0 }
    tentatives.set(key, t)
    log(db, key, 'CONNEXION_ECHEC', 'Back-office', undefined, bad ? 'Identifiants invalides' : 'Second facteur invalide')
    if (!bad && !code.trim()) throw new ApiError('DOUBLE_AUTH', 'Le second facteur est obligatoire : accès refusé.')
    throw new ApiError('IDENTIFIANTS', bad ? 'E-mail ou mot de passe incorrect.' : 'Code de double authentification incorrect.')
  }
  tentatives.delete(key)
  u!.derniereConnexion = new Date().toISOString()
  log(db, u!.nom, 'CONNEXION', 'Back-office')
  return u!
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrateur', economat: 'Économat', resp_crn: 'Responsable CRN', resp_spt: 'Responsable VOGT Sport', resp_inf: 'Responsable informatique',
}

export { db, resetDemo, confirmerPaiement, echouerPaiement, emettreAvoir, log, restantes }
