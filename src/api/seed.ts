import type { Participant, Utilisateur } from '../lib/types'
import { classeSuivante, CLASSES } from '../data/catalog'
import { categorieParticipant, prestationsPour, type Catalogue } from '../lib/rules'
import { conflitsCreneau } from '../lib/rules'
import { echouerPaiement, confirmerPaiement, creerCommande, emettreAvoir, lancerPaiement, log, sms, tick } from './domain'
import type { DB } from './db'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NOMS = ['NKENG', 'MBARGA', 'FOTSO', 'TCHOUA', 'ATANGANA', 'NGONO', 'EBOGO', 'KAMGA', 'MBALLA', 'ONANA', 'BELLA', 'ESSOMBA', 'NJOYA', 'TAGNE', 'DJOMO', 'MANGA', 'FOUDA', 'ABENA', 'EKANI', 'MOUKOURI', 'TALLA', 'ZOA', 'OWONA', 'BIYA MBOCK', 'NANA']
const PRENOMS_F = ['Marie-Claire', 'Aïcha', 'Estelle', 'Grâce', 'Sandrine', 'Prisca', 'Ornella', 'Laure', 'Flore', 'Christelle', 'Joëlle', 'Nadège']
const PRENOMS_M = ['Jean-Paul', 'Brice', 'Yannick', 'Patrick', 'Hervé', 'Landry', 'Cédric', 'Junior', 'Arnaud', 'Rodrigue', 'Félix', 'Wilfried']

export const DEMO_USERS: Utilisateur[] = [
  { id: 'u1', nom: 'Administrateur du système', email: 'admin@collegevogt.cm', role: 'admin', actif: true, motDePasse: 'Admin#2026' },
  { id: 'u2', nom: 'Économat · Mme NGUEMA', email: 'economat@collegevogt.cm', role: 'economat', actif: true, motDePasse: 'Eco#2026' },
  { id: 'u3', nom: 'Coordination CRN · M. TCHAMBA', email: 'crn@collegevogt.cm', role: 'resp_crn', actif: true, motDePasse: 'Crn#2026' },
  { id: 'u4', nom: 'Coordination sportive · M. ELOUNDOU', email: 'sport@collegevogt.cm', role: 'resp_spt', actif: true, motDePasse: 'Sport#2026' },
  { id: 'u5', nom: 'Coordination informatique · M. ANDJE', email: 'info@collegevogt.cm', role: 'resp_inf', actif: true, motDePasse: 'Info#2026' },
]

export function buildSeed(d: DB): DB {
  const r = rng(20261007)
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)]
  const now = new Date()
  const cat: Catalogue = { sessions: d.sessions, prestations: d.prestations, categories: d.categories, params: d.params }
  d.utilisateurs = DEMO_USERS.map((u) => ({ ...u }))

  // Places déjà attribuées hors plateforme (inscriptions sur place) : permet de montrer les groupes presque pleins.
  d.base['crn-math|Tle C'] = 35
  d.base['crn-math|3e'] = 33
  d.base['crn-pc|Tle D'] = 34
  d.base['spt-bask|U13'] = 19
  d.base['spt-foot|U11'] = 20
  d.base['spt-judo|U9'] = 18
  d.base['inf-mnt'] = 15
  d.base['inf-info'] = 21
  d.base['inf-web'] = 14

  const phone = () => `+2376${pick(['5', '7', '8', '9'])}${pick(['0', '1', '2', '3'])}${String(Math.floor(r() * 1e6)).padStart(6, '0')}`.slice(0, 13)
  const fr2 = (n: number) => String(n).padStart(2, '0')
  let pid = 0

  function parentFields(nom: string): Pick<Participant, 'parentNom' | 'parentTel' | 'parentEmail'> {
    const prenom = pick([...PRENOMS_F, ...PRENOMS_M])
    return { parentNom: `${prenom} ${nom}`, parentTel: phone().replace('+237', ''), parentEmail: r() > 0.55 ? `${prenom.toLowerCase().replace(/[^a-z]/g, '')}.${nom.toLowerCase().replace(/[^a-z]/g, '')}@example.cm` : '' }
  }

  function mk(offre: 'CRN' | 'SPT' | 'INF', nom: string): Participant {
    const f = r() > 0.5
    const base: Participant = {
      id: `p${++pid}`, offre, nom, prenoms: pick(f ? PRENOMS_F : PRENOMS_M), sexe: f ? 'F' : 'M', naissance: '',
      ...parentFields(nom), choix: [],
    }
    if (offre === 'CRN') {
      const prev = pick(CLASSES.slice(0, 13))
      base.classePrecedente = prev
      base.classePreparee = classeSuivante(prev)
      base.eleveCollege = r() > 0.35 ? 'oui' : 'non'
      if (base.eleveCollege === 'non') base.etablissement = pick(['Lycée de Mvog-Ada', 'Collège La Retraite', 'Institut Siantou', 'Lycée Leclerc'])
      const y = 2026 - (6 + CLASSES.indexOf(prev) + 5)
      base.naissance = `${fr2(1 + Math.floor(r() * 28))}/${fr2(1 + Math.floor(r() * 12))}/${y}`
      const subs = prestationsPour(base, cat, d.sessions[0])
      const n = 1 + Math.floor(r() * Math.min(6, subs.length))
      base.choix = [...subs].sort(() => r() - 0.5).slice(0, n).map((s) => s.id)
    } else if (offre === 'SPT') {
      const y = 2010 + Math.floor(r() * 12)
      base.naissance = `${fr2(1 + Math.floor(r() * 28))}/${fr2(1 + Math.floor(r() * 12))}/${y}`
      if (y === 2010) base.naissance = '20/11/2010'
      if (y === 2022) base.naissance = '10/01/2022'
      base.urgenceNom = `${pick(PRENOMS_F)} ${pick(NOMS)}`
      base.urgenceTel = phone().replace('+237', '')
      base.autorisation = true
      base.certificat = { nom: 'certificat-medical.pdf', taille: 640000 }
      const acts = prestationsPour(base, cat, d.sessions[1])
      base.choix = acts.length ? [pick(acts).id] : []
    } else {
      base.naissance = ''
      base.profession = pick(['eleve', 'eleve', 'etudiant', 'enseignant', 'autre'])
      base.tel = phone().replace('+237', '')
      base.email = r() > 0.5 ? `${base.prenoms.toLowerCase().replace(/[^a-z]/g, '')}@example.cm` : ''
      if (base.profession === 'eleve') { base.classe = pick(['3e', '2nde', '1ère', 'Terminale']); base.etablissement = 'Collège Vogt' }
      else { base.parentNom = ''; base.parentTel = ''; base.parentEmail = '' }
      if (base.profession === 'etudiant') base.etablissement = 'Université de Yaoundé I'
      if (base.profession === 'enseignant') base.etablissement = pick(['Lycée de Biyem-Assi', 'Collège Vogt'])
      if (base.profession === 'autre') base.professionExercee = pick(['Commerçante', 'Comptable', 'Infirmier'])
      const mods = [...cat.prestations.filter((x) => x.sessionId === 'ses-inf')].sort(() => r() - 0.5)
      const chosen: string[] = []
      for (const m of mods) {
        if (chosen.length >= 1 + Math.floor(r() * 3)) break
        if (m.prerequis && !chosen.includes(m.prerequis)) continue
        if (conflitsCreneau([...chosen, m.id], cat).length) continue
        chosen.push(m.id)
      }
      base.choix = chosen.length ? chosen : ['inf-bur']
    }
    return base
  }

  const N = 78
  for (let i = 0; i < N; i++) {
    const daysAgo = Math.floor(Math.pow(r(), 1.4) * 21)
    const t = new Date(now.getTime() - daysAgo * 86400000)
    t.setHours(7 + Math.floor(r() * 14), Math.floor(r() * 60), Math.floor(r() * 60))
    if (t > now) t.setTime(now.getTime() - 3600000)
    const roll = r()
    const offre = roll < 0.4 ? 'CRN' : roll < 0.72 ? 'SPT' : 'INF'
    const nom = pick(NOMS)
    const ps = [mk(offre, nom)]
    if (offre === 'SPT' && r() > 0.7) { const sib = mk('SPT', nom); sib.parentNom = ps[0].parentNom; sib.parentTel = ps[0].parentTel; sib.parentEmail = ps[0].parentEmail; ps.push(sib) }
    if (offre === 'SPT') for (const p of ps) if (!categorieParticipant(p, d.sessions[1], cat)?.categorie || !p.choix.length) { p.naissance = '14/03/2015'; p.choix = ['spt-bask'] }
    const p0 = ps[0]
    const payeur = offre === 'INF' && p0.profession !== 'eleve'
      ? { nom: `${p0.nom} ${p0.prenoms}`, tel: p0.tel ?? '', email: p0.email ?? '' }
      : { nom: p0.parentNom, tel: p0.parentTel, email: p0.parentEmail }
    let c
    try {
      c = creerCommande(d, { payeur, participants: ps, consentement: { cgu: true, donnees: true } }, t)
    } catch { continue }
    if (c.statut !== 'EN_ATTENTE_PAIEMENT') continue
    const operateur = r() < 0.6 ? 'MTN' : 'ORANGE'
    const pay = lancerPaiement(d, c.id, operateur, c.payeur.tel, new Date(t.getTime() + 20000))
    const outcome = r()
    const tp = new Date(t.getTime() + 20000 + (20 + Math.floor(r() * 90)) * 1000)
    if (outcome < 0.86) confirmerPaiement(d, pay, tp)
    else if (outcome < 0.94) echouerPaiement(d, pay, pick(['Solde insuffisant.', 'Code secret erroné.', 'Plafond de transaction atteint.']), tp)
    else { /* laissé sans réponse : expirera */ }
    tick(d, new Date(t.getTime() + 25 * 60000 < now.getTime() ? t.getTime() + 25 * 60000 : now.getTime()))
  }
  tick(d, now)

  // Un remboursement traité par l'économat
  const f = [...d.factures].reverse().find((x) => x.montant >= 15000 && x.montant <= 30000)
  if (f) emettreAvoir(d, f.numero, f.montant, 'Doublon : l’élève était déjà inscrit', 'Économat · Mme NGUEMA', new Date(now.getTime() - 2 * 86400000))

  // Historique des tarifs et journal
  d.tarifs.push({ prestationId: 'crn-math', ancien: 12000, nouveau: 15000, date: new Date(now.getTime() - 9 * 86400000).toISOString(), utilisateur: 'Administrateur du système' })
  d.tarifs.push({ prestationId: 'inf-info', ancien: 40000, nouveau: 45000, date: new Date(now.getTime() - 6 * 86400000).toISOString(), utilisateur: 'Administrateur du système' })
  log(d, 'Administrateur du système', 'TARIF_MODIFIE', 'Mathématiques (CRN)', '12 000 FCFA', '15 000 FCFA', new Date(now.getTime() - 9 * 86400000))
  log(d, 'Administrateur du système', 'TARIF_MODIFIE', 'Infographie (INF)', '40 000 FCFA', '45 000 FCFA', new Date(now.getTime() - 6 * 86400000))
  log(d, 'Coordination sportive · M. ELOUNDOU', 'EXPORT', 'Liste U13 · Basketball (PDF)', undefined, undefined, new Date(now.getTime() - 3600000 * 20))
  log(d, 'système', 'WEBHOOK_REJETE', 'CFXV-TEST-FORGED', undefined, 'Signature invalide', new Date(now.getTime() - 3600000 * 30))
  d.audit.sort((a, b) => b.date.localeCompare(a.date))

  // Rapprochement de la nuit
  const hier = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  const ok = d.paiements.filter((p) => p.statut === 'REUSSIE' && p.misAJourLe.slice(0, 10) === hier)
  d.rapprochements.unshift({
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0).toISOString(),
    transactions: ok.length,
    ecarts: ok.length ? [{ reference: ok[0].referenceInterne, detail: 'Présente dans la plateforme, absente du relevé du prestataire (délai de reversement ?)' }] : [],
  })
  sms(d, 'SMS', '+237677000000', 'Exemple : rappel de la rentrée des cours de remise à niveau.', new Date(now.getTime() - 86400000))
  return d
}
