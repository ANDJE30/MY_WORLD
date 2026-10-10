import type { CategorieAge, Devis, LigneCommande, Parametres, Participant, Prestation, Session } from './types'
import { ageRevolu, categorieDe, parseFrDate } from './age'

export interface Catalogue {
  sessions: Session[]
  prestations: Prestation[]
  categories: CategorieAge[]
  params: Parametres
}

export function sessionDe(cat: Catalogue, offre: string): Session | undefined {
  return cat.sessions.find((s) => s.offre === offre && s.statut === 'ouverte')
}

/** Catégorie VOGT Sport : âge révolu au premier jour de la session, et lui seul (RG-04). */
export function categorieParticipant(p: Participant, session: Session | undefined, cat: Catalogue) {
  const d = parseFrDate(p.naissance)
  if (!d || !session) return null
  const age = ageRevolu(d, session.debut)
  return { age, categorie: categorieDe(age, cat.categories) }
}

/** Clé du groupe dont l'effectif est contrôlé (EF-10, EF-16, RG-07). */
export function groupeKey(p: Participant, pr: Prestation, cat: Catalogue, session?: Session): string {
  if (pr.type === 'matiere') return `${pr.id}|${p.classePreparee ?? ''}`
  if (pr.type === 'activite') {
    const c = categorieParticipant(p, session, cat)?.categorie
    return `${pr.id}|${c?.code ?? ''}`
  }
  return pr.id
}

/** Prestations proposées à un participant (EF-08, EF-15). */
export function prestationsPour(p: Participant, cat: Catalogue, session?: Session): Prestation[] {
  const list = cat.prestations.filter((x) => x.sessionId === session?.id)
  if (p.offre === 'CRN') return list.filter((x) => !!p.classePreparee && x.niveaux?.includes(p.classePreparee))
  if (p.offre === 'SPT') {
    const code = categorieParticipant(p, session, cat)?.categorie?.code
    return list.filter((x) => !!code && !!x.categories?.includes(code) && (!x.sexe || x.sexe === p.sexe))
  }
  return list
}

export function conflitsCreneau(choix: string[], cat: Catalogue): [Prestation, Prestation][] {
  const items = choix.map((id) => cat.prestations.find((x) => x.id === id)).filter(Boolean) as Prestation[]
  const out: [Prestation, Prestation][] = []
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (items[i].creneau && items[i].creneau === items[j].creneau) out.push([items[i], items[j]])
  return out
}

export function prerequisManquants(choix: string[], cat: Catalogue): { module: Prestation; prerequis: Prestation }[] {
  const out: { module: Prestation; prerequis: Prestation }[] = []
  for (const id of choix) {
    const m = cat.prestations.find((x) => x.id === id)
    if (!m?.prerequis || choix.includes(m.prerequis)) continue
    const pr = cat.prestations.find((x) => x.id === m.prerequis)
    if (pr) out.push({ module: m, prerequis: pr })
  }
  return out
}

export function nomComplet(p: Pick<Participant, 'nom' | 'prenoms'>): string {
  return `${p.nom.trim().toUpperCase()} ${p.prenoms.trim()}`.trim()
}

/**
 * Calcule le devis : somme des lignes, forfait plafond CRN, remise INF, arrondi au franc (RG-03).
 * `complet(key)` indique si le groupe est complet : la ligne passe alors en liste d'attente, sans paiement (RG-07).
 */
export function calculerDevis(
  participants: Participant[],
  cat: Catalogue,
  complet: (key: string, pr: Prestation, p: Participant) => boolean = () => false,
): Devis {
  const lignes: LigneCommande[] = []
  const attente: LigneCommande[] = []
  let remises = 0
  for (const p of participants) {
    const session = cat.sessions.find((s) => s.offre === p.offre && s.statut === 'ouverte')
    const mine: LigneCommande[] = []
    for (const id of p.choix) {
      const pr = cat.prestations.find((x) => x.id === id)
      if (!pr) continue
      const ligne: LigneCommande = {
        participantId: p.id, participantNom: nomComplet(p), prestationId: pr.id, libelle: pr.libelle,
        detail: p.offre === 'CRN' ? p.classePreparee : p.offre === 'SPT' ? categorieParticipant(p, session, cat)?.categorie?.code : undefined,
        qte: 1, pu: pr.tarif, montant: pr.tarif, kind: 'ligne',
      }
      if (complet(groupeKey(p, pr, cat, session), pr, p)) attente.push({ ...ligne, attente: true })
      else mine.push(ligne)
    }
    lignes.push(...mine)
    const sous = mine.reduce((a, l) => a + l.montant, 0)
    if (p.offre === 'CRN' && sous > cat.params.forfaitPlafondCRN) {
      const eco = sous - cat.params.forfaitPlafondCRN
      remises += eco
      lignes.push({ participantId: p.id, participantNom: nomComplet(p), prestationId: null, libelle: 'Forfait plafond CRN', qte: 1, pu: -eco, montant: -eco, kind: 'remise' })
    }
    if (p.offre === 'INF' && mine.length >= cat.params.remiseINF.minModules && cat.params.remiseINF.pct > 0) {
      const eco = Math.round((sous * cat.params.remiseINF.pct) / 100)
      remises += eco
      lignes.push({ participantId: p.id, participantNom: nomComplet(p), prestationId: null, libelle: `Remise ${cat.params.remiseINF.pct} % (${cat.params.remiseINF.minModules} modules et plus)`, qte: 1, pu: -eco, montant: -eco, kind: 'remise' })
    }
  }
  const brut = lignes.filter((l) => l.kind === 'ligne').reduce((a, l) => a + l.montant, 0)
  const total = Math.max(0, Math.round(brut - remises))
  const frais = cat.params.frais.mode === 'ajoutes' ? Math.round((total * cat.params.frais.pct) / 100) : 0
  return { lignes, sousTotal: brut, remises, total, frais, aPayer: total + frais, attente }
}
