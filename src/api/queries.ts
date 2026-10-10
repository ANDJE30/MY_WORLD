import { db } from './db'
import { ageDe } from './domain'
import type { InscriptionRow } from './db'
import type { Commande, Facture, OffreCode, Paiement, Participant, Prestation } from '../lib/types'
import { categorieParticipant, nomComplet } from '../lib/rules'
import { catalogueOf } from './domain'

export interface Ligne {
  ins: InscriptionRow
  commande: Commande
  participant: Participant
  prestation: Prestation
  offre: OffreCode
  paiement?: Paiement
  facture?: Facture
  groupeLabel: string
  nom: string
}

export function lignes(offres: OffreCode[]): Ligne[] {
  const cat = catalogueOf(db)
  const out: Ligne[] = []
  for (const ins of db.inscriptions) {
    const commande = db.commandes.find((c) => c.id === ins.commandeId)
    const prestation = db.prestations.find((p) => p.id === ins.prestationId)
    const participant = commande?.participants.find((p) => p.id === ins.participantId)
    if (!commande || !prestation || !participant) continue
    const session = db.sessions.find((s) => s.id === prestation.sessionId)
    const offre = participant.offre
    if (!offres.includes(offre)) continue
    const paiements = db.paiements.filter((p) => p.commandeId === commande.id)
    const paiement = paiements.find((p) => p.statut === 'REUSSIE' || p.statut === 'REMBOURSEE') ?? paiements[0]
    const facture = db.factures.find((f) => f.commandeId === commande.id)
    let groupeLabel = prestation.libelle
    if (offre === 'CRN') groupeLabel = `${participant.classePreparee} · ${prestation.libelle}`
    if (offre === 'SPT') groupeLabel = `${categorieParticipant(participant, session, cat)?.categorie?.code ?? '?'} · ${prestation.libelle}`
    out.push({ ins, commande, participant, prestation, offre, paiement, facture, groupeLabel, nom: nomComplet(participant) })
  }
  return out.sort((a, b) => b.ins.creeLe.localeCompare(a.ins.creeLe))
}

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

/** Encaissements par offre : somme des lignes de chaque offre, remises comprises. */
export function recettes(offres: OffreCode[]) {
  const rows: { date: Date; offre: OffreCode; montant: number; operateur: string; commandeId: string }[] = []
  for (const p of db.paiements) {
    if (p.statut !== 'REUSSIE' && p.statut !== 'REMBOURSEE') continue
    const c = db.commandes.find((x) => x.id === p.commandeId)
    if (!c) continue
    for (const o of c.offres) {
      if (!offres.includes(o)) continue
      const m = c.devis.lignes.filter((l) => c.participants.find((x) => x.id === l.participantId)?.offre === o).reduce((a, l) => a + l.montant, 0)
      const fraisPart = c.devis.frais && c.devis.total ? Math.round((c.devis.frais * m) / c.devis.total) : 0
      rows.push({ date: new Date(p.misAJourLe), offre: o, montant: m + fraisPart, operateur: p.operateur, commandeId: c.id })
    }
  }
  return rows
}

export function restantesGroupe(key: string, max: number) {
  const used = (db.base[key] ?? 0) + db.inscriptions.filter((i) => i.groupe === key && i.statut === 'CONFIRMEE').length
  return { used, max, left: Math.max(0, max - used) }
}

export function groupes(offre: OffreCode) {
  const cat = catalogueOf(db)
  const ses = db.sessions.find((s) => s.offre === offre)
  const out: { key: string; label: string; prestation: Prestation; max: number; used: number }[] = []
  if (!ses) return out
  for (const pr of db.prestations.filter((p) => p.sessionId === ses.id)) {
    const subs = offre === 'CRN' ? (pr.niveaux ?? []) : offre === 'SPT' ? (pr.categories ?? []) : ['']
    for (const s of subs) {
      const key = offre === 'INF' ? pr.id : `${pr.id}|${s}`
      const g = restantesGroupe(key, pr.places)
      out.push({ key, label: offre === 'INF' ? pr.libelle : offre === 'CRN' ? `${s} · ${pr.libelle}` : `${s} · ${pr.libelle}`, prestation: pr, max: pr.places, used: g.used })
    }
  }
  void cat
  return out
}

export { ageDe }
