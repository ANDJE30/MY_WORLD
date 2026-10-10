/**
 * Règles métier de la plateforme (chapitres 6, 7 et 9 de la spécification).
 * Fonctions pures sur un objet `DB` : elles tournent aujourd'hui dans le navigateur (API simulée) et se
 * transposent telles quelles côté serveur Laravel.
 */
import type {
  Avoir, Commande, Devis, Facture, OffreCode, Operateur, Paiement, Participant, Payeur,
} from '../lib/types'
import { calculerDevis, groupeKey, nomComplet, sessionDe, type Catalogue } from '../lib/rules'
import { frToIso, parseFrDate } from '../lib/age'
import { toE164 } from '../lib/phone'
import { fcfa } from '../lib/money'
import type { DB, InscriptionRow } from './db'

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
const iso = (d: Date) => d.toISOString()
const plusMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000)

export const SITE = {
  nom: 'Collège Mgr François-Xavier Vogt',
  bp: 'B.P. 703 Yaoundé, Cameroun',
  tel: '+237 222 00 00 00',
  email: 'inscriptions@collegevogt.cm',
  niu: 'M0123 4567 8901 A',
}

export function catalogueOf(d: DB): Catalogue {
  return { sessions: d.sessions, prestations: d.prestations, categories: d.categories, params: d.params }
}

export function log(d: DB, utilisateur: string, action: string, objet: string, avant?: string, apres?: string, now = new Date()) {
  d.audit.unshift({ id: uid('aud'), date: iso(now), utilisateur, action, objet, avant, apres })
}

export function sms(d: DB, canal: 'SMS' | 'EMAIL', destinataire: string, message: string, now = new Date()) {
  d.messages.unshift({ id: uid('msg'), date: iso(now), canal, destinataire, message })
}

/* ------------------------------ Disponibilités ------------------------------ */

export function inscritsConfirmes(d: DB, key: string): number {
  return (d.base[key] ?? 0) + d.inscriptions.filter((i) => i.groupe === key && i.statut === 'CONFIRMEE').length
}
export function reserves(d: DB, key: string, now = new Date()): number {
  return d.holds.filter((h) => h.key === key && new Date(h.expireLe) > now).length
}
export function restantes(d: DB, key: string, max: number, now = new Date()): number {
  return Math.max(0, max - inscritsConfirmes(d, key) - reserves(d, key, now))
}

/** Fournit un test « groupe complet » qui tient compte des lignes déjà prises dans la commande en cours. */
export function makeComplet(d: DB, now = new Date()) {
  const prises: Record<string, number> = {}
  return (key: string, pr: { places: number }) => {
    const left = restantes(d, key, pr.places, now) - (prises[key] ?? 0)
    if (left <= 0) return true
    prises[key] = (prises[key] ?? 0) + 1
    return false
  }
}

export function devisPour(d: DB, participants: Participant[], now = new Date()): Devis {
  return calculerDevis(participants, catalogueOf(d), makeComplet(d, now))
}

/* ------------------------------ Expirations ------------------------------ */

function liberer(d: DB, commandeId: string) {
  d.holds = d.holds.filter((h) => h.commandeId !== commandeId)
  d.inscriptions.forEach((i) => {
    if (i.commandeId === commandeId && i.statut === 'RESERVEE') i.statut = 'LIBEREE'
  })
}

/** Applique les expirations de paiement (5 min) et de réservation (15 min) — RG-08. */
export function tick(d: DB, now = new Date()) {
  for (const p of d.paiements) {
    if (p.statut === 'EN_ATTENTE' && new Date(p.expireLe) <= now) {
      p.statut = 'EXPIREE'
      p.motifEchec = 'Aucune réponse du payeur dans le délai.'
      p.misAJourLe = iso(now)
      const c = d.commandes.find((x) => x.id === p.commandeId)
      if (c && c.statut !== 'CONFIRMEE') {
        liberer(d, c.id)
        c.statut = 'EXPIREE'
      }
    }
  }
  for (const c of d.commandes) {
    if (c.statut === 'EN_ATTENTE_PAIEMENT' && new Date(c.expireLe) <= now) {
      const pending = d.paiements.some((p) => p.commandeId === c.id && p.statut === 'EN_ATTENTE')
      if (!pending) {
        liberer(d, c.id)
        c.statut = 'EXPIREE'
      }
    }
  }
}

/* ------------------------------ Commande ------------------------------ */

export interface CommandeInput {
  payeur: Payeur
  participants: Participant[]
  consentement: { cgu: boolean; donnees: boolean }
}

export function creerCommande(d: DB, input: CommandeInput, now = new Date()): Commande {
  tick(d, now)
  const cat = catalogueOf(d)
  const participants = JSON.parse(JSON.stringify(input.participants)) as Participant[]
  const devis = devisPour(d, participants, now)
  if (devis.lignes.filter((l) => l.kind === 'ligne').length === 0 && devis.attente.length === 0) {
    throw new Error('Aucun choix dans la commande.')
  }
  const id = uid('cmd')
  const offres = [...new Set(participants.map((p) => p.offre))] as OffreCode[]
  const onlyWait = devis.lignes.filter((l) => l.kind === 'ligne').length === 0
  const commande: Commande = {
    id,
    payeur: { nom: input.payeur.nom.trim(), tel: toE164(input.payeur.tel), email: input.payeur.email.trim() },
    participants,
    devis,
    offres,
    statut: onlyWait ? 'LISTE_ATTENTE' : 'EN_ATTENTE_PAIEMENT',
    creeLe: iso(now),
    expireLe: iso(plusMin(now, d.params.reservationMin)),
    sessionIds: offres.map((o) => sessionDe(cat, o)?.id ?? ''),
    consentement: { ...input.consentement, horodatage: iso(now) },
  }
  for (const l of [...devis.lignes.filter((x) => x.kind === 'ligne'), ...devis.attente]) {
    const p = participants.find((x) => x.id === l.participantId)!
    const pr = d.prestations.find((x) => x.id === l.prestationId)!
    const session = d.sessions.find((s) => s.id === pr.sessionId)
    const key = groupeKey(p, pr, cat, session)
    const row: InscriptionRow = {
      id: uid('ins'), commandeId: id, participantId: p.id, prestationId: pr.id, groupe: key, prix: l.pu,
      statut: l.attente ? 'LISTE_ATTENTE' : 'RESERVEE', creeLe: iso(now),
      doublon: d.inscriptions.some((i) => {
        if (i.statut !== 'CONFIRMEE' && i.statut !== 'RESERVEE') return false
        const o = d.commandes.find((c) => c.id === i.commandeId)?.participants.find((x) => x.id === i.participantId)
        return !!o && o.nom.toUpperCase() === p.nom.toUpperCase() && o.prenoms.toLowerCase() === p.prenoms.toLowerCase() &&
          frToIso(o.naissance ?? '') === frToIso(p.naissance ?? '') && i.prestationId === pr.id
      }),
    }
    d.inscriptions.push(row)
    if (!l.attente) d.holds.push({ key, commandeId: id, expireLe: commande.expireLe })
  }
  d.commandes.unshift(commande)
  return commande
}

/* ------------------------------ Paiement ------------------------------ */

export function lancerPaiement(d: DB, commandeId: string, operateur: Operateur, numero: string, now = new Date()): Paiement {
  tick(d, now)
  const c = d.commandes.find((x) => x.id === commandeId)
  if (!c) throw new Error('Commande introuvable.')
  if (c.statut === 'CONFIRMEE') throw new Error('Cette commande est déjà payée.')
  if (c.statut === 'LISTE_ATTENTE') throw new Error('Aucun paiement n’est demandé pour une liste d’attente.')
  const enCours = d.paiements.find((p) => p.commandeId === commandeId && p.statut === 'EN_ATTENTE')
  if (enCours) return enCours
  if (c.statut === 'EXPIREE') {
    // nouvel essai : on tente de réserver à nouveau les places libérées
    const cat = catalogueOf(d)
    const rows = d.inscriptions.filter((i) => i.commandeId === c.id && i.statut === 'LIBEREE')
    for (const r of rows) {
      const pr = d.prestations.find((x) => x.id === r.prestationId)!
      if (restantes(d, r.groupe, pr.places, now) <= 0) throw new Error('PLACE_PRISE')
    }
    for (const r of rows) {
      r.statut = 'RESERVEE'
      d.holds.push({ key: r.groupe, commandeId: c.id, expireLe: iso(plusMin(now, d.params.reservationMin)) })
    }
    c.statut = 'EN_ATTENTE_PAIEMENT'
    c.expireLe = iso(plusMin(now, d.params.reservationMin))
    void cat
  }
  const p: Paiement = {
    id: uid('pay'),
    commandeId,
    operateur,
    numero: toE164(numero),
    referenceInterne: `CFXV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    montant: c.devis.aPayer,
    statut: 'EN_ATTENTE',
    creeLe: iso(now),
    expireLe: iso(plusMin(now, d.params.delaiPaiementMin)),
    misAJourLe: iso(now),
    notifications: 0,
  }
  d.paiements.unshift(p)
  return p
}

function nextCounter(d: DB, key: string): number {
  d.compteurs[key] = (d.compteurs[key] ?? 0) + 1
  return d.compteurs[key]
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function codeVerif(): string {
  let s = ''
  for (let i = 0; i < 10; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]
  return s
}

/** Confirme un paiement vérifié : inscription confirmée et une seule facture (EF-28, RG-09). */
export function confirmerPaiement(d: DB, p: Paiement, now = new Date()): Facture {
  const existing = d.factures.find((f) => f.paiementId === p.id)
  p.notifications += 1
  if (existing) return existing
  const c = d.commandes.find((x) => x.id === p.commandeId)!
  p.statut = 'REUSSIE'
  p.referenceOperateur = `${p.operateur === 'MTN' ? 'MP' : 'OM'}${String(now.getFullYear()).slice(2)}${Math.random().toString(10).slice(2, 12)}`
  p.misAJourLe = iso(now)
  c.statut = 'CONFIRMEE'
  d.holds = d.holds.filter((h) => h.commandeId !== c.id)
  d.inscriptions.forEach((i) => {
    if (i.commandeId === c.id && (i.statut === 'RESERVEE' || i.statut === 'LIBEREE')) i.statut = 'CONFIRMEE'
  })
  const year = now.getFullYear()
  const offre: OffreCode | 'MUL' = c.offres.length > 1 ? 'MUL' : c.offres[0]
  const n = nextCounter(d, `FAC-${year}`)
  const f: Facture = {
    id: uid('fac'),
    numero: `CFXV-${year}-${offre}-${String(n).padStart(5, '0')}`,
    commandeId: c.id,
    paiementId: p.id,
    montant: p.montant,
    date: iso(now),
    code: codeVerif(),
    offre,
  }
  d.factures.unshift(f)
  const lien = `${typeof location !== 'undefined' ? location.origin : ''}/facture/${f.code}`
  sms(d, 'SMS', c.payeur.tel, `Collège Vogt : paiement de ${fcfa(p.montant)} reçu. Facture ${f.numero} : ${lien}`, now)
  if (c.payeur.email) sms(d, 'EMAIL', c.payeur.email, `Facture ${f.numero} en pièce jointe (PDF A5 paysage).`, now)
  return f
}

export function echouerPaiement(d: DB, p: Paiement, motif: string, now = new Date()) {
  if (p.statut === 'REUSSIE') return
  p.statut = 'ECHOUEE'
  p.motifEchec = motif
  p.misAJourLe = iso(now)
}

/** Webhook du prestataire : signature vérifiée, puis statut confirmé par appel API avant toute écriture (EF-27). */
export function traiterWebhook(
  d: DB,
  evt: { reference: string; statut: 'SUCCESS' | 'FAILED'; motif?: string; signatureValide: boolean },
  now = new Date(),
): { ok: boolean; message: string } {
  if (!evt.signatureValide) {
    log(d, 'système', 'WEBHOOK_REJETE', evt.reference, undefined, 'Signature invalide', now)
    return { ok: false, message: 'Signature invalide : notification rejetée et inscrite au journal d’audit.' }
  }
  const p = d.paiements.find((x) => x.referenceInterne === evt.reference)
  if (!p) return { ok: false, message: 'Référence inconnue.' }
  if (p.statut === 'REUSSIE') {
    p.notifications += 1
    return { ok: true, message: 'Notification déjà traitée : aucune nouvelle facture n’est émise.' }
  }
  if (evt.statut === 'SUCCESS') {
    confirmerPaiement(d, p, now)
    return { ok: true, message: 'Statut confirmé auprès du prestataire : inscription confirmée, facture émise.' }
  }
  echouerPaiement(d, p, evt.motif ?? 'Paiement refusé.', now)
  return { ok: true, message: 'Échec enregistré.' }
}

/* ------------------------------ Avoirs ------------------------------ */

export function emettreAvoir(d: DB, numeroFacture: string, montant: number, motif: string, utilisateur: string, now = new Date()): Avoir {
  const f = d.factures.find((x) => x.numero === numeroFacture)
  if (!f) throw new Error('Facture introuvable.')
  const deja = d.avoirs.filter((a) => a.factureNumero === numeroFacture).reduce((s, a) => s + a.montant, 0)
  if (montant <= 0 || montant + deja > f.montant) throw new Error(`Le montant doit être compris entre 1 et ${f.montant - deja} FCFA.`)
  if (!motif.trim()) throw new Error('Le motif est obligatoire.')
  const year = now.getFullYear()
  const a: Avoir = {
    id: uid('avo'), numero: `AV-${year}-${String(nextCounter(d, `AV-${year}`)).padStart(5, '0')}`,
    factureNumero: numeroFacture, montant, motif: motif.trim(), utilisateur, date: iso(now),
  }
  d.avoirs.unshift(a)
  if (montant + deja >= f.montant) {
    const p = d.paiements.find((x) => x.id === f.paiementId)
    if (p) p.statut = 'REMBOURSEE'
    d.inscriptions.forEach((i) => {
      if (i.commandeId === f.commandeId && i.statut === 'CONFIRMEE') i.statut = 'ANNULEE'
    })
  }
  log(d, utilisateur, 'AVOIR_EMIS', a.numero, undefined, `${montant} XAF sur ${numeroFacture}`, now)
  return a
}

export function nomParticipant(p: Participant): string {
  return nomComplet(p)
}

export function ageDe(p: Participant): number | null {
  const dt = parseFrDate(p.naissance)
  if (!dt) return null
  return Math.floor((Date.now() - dt.getTime()) / (365.25 * 86400000))
}
