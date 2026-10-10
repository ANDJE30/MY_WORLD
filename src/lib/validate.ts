import type { Participant, Payeur } from './types'
import { ageRevolu, agesAcceptes, parseFrDate } from './age'
import { isValidMobile } from './phone'
import { categorieParticipant, type Catalogue, conflitsCreneau, sessionDe } from './rules'

export type Errors = Record<string, string>

const NOM = /^[\p{L}][\p{L}\s'’-]*$/u
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

type T = (k: string, v?: Record<string, string | number>) => string

function nom(v: string | undefined, min: number, max: number, t: T, field: string): string | null {
  const s = (v ?? '').trim()
  if (!s) return t('err.required')
  if (s.length < min || s.length > max) return t('err.length', { min, max })
  if (!NOM.test(s)) return t('err.letters')
  return null
}

function put(e: Errors, k: string, m: string | null) {
  if (m) e[k] = m
}

export function validerPhone(v: string | undefined, t: T): string | null {
  if (!v || !v.trim()) return t('err.required')
  return isValidMobile(v) ? null : t('err.phone')
}

export function validerEmail(v: string | undefined, t: T, required = false): string | null {
  const s = (v ?? '').trim()
  if (!s) return required ? t('err.required') : null
  return EMAIL.test(s) ? null : t('err.email')
}

/** Contrôles de l'étape 2 (champ par champ, EF-02). */
export function validerParticipant(p: Participant, cat: Catalogue, t: T): Errors {
  const e: Errors = {}
  const session = sessionDe(cat, p.offre)
  const naissance = parseFrDate(p.naissance)

  put(e, 'nom', nom(p.nom, 2, 50, t, 'nom'))
  put(e, 'prenoms', nom(p.prenoms, 2, 60, t, 'prenoms'))

  if (p.offre !== 'INF') {
    if (!p.sexe) e.sexe = t('err.required')
    if (!p.naissance) e.naissance = t('err.required')
    else if (!naissance) e.naissance = t('err.date')
    else if (naissance.getTime() >= Date.now()) e.naissance = t('err.datePast')
  }

  if (p.offre === 'CRN') {
    if (!p.eleveCollege) e.eleveCollege = t('err.required')
    if (p.eleveCollege === 'non' && !(p.etablissement ?? '').trim()) e.etablissement = t('err.required')
    if (!p.classePrecedente) e.classePrecedente = t('err.required')
    if (!p.classePreparee) e.classePreparee = t('err.required')
    if ((p.observations ?? '').length > 300) e.observations = t('err.max', { max: 300 })
    put(e, 'parentNom', nom(p.parentNom, 2, 80, t, 'parentNom'))
    put(e, 'parentTel', validerPhone(p.parentTel, t))
    put(e, 'parentEmail', validerEmail(p.parentEmail, t))
  }

  if (p.offre === 'SPT') {
    if (naissance && !e.naissance) {
      const info = categorieParticipant(p, session, cat)
      if (info && !info.categorie) {
        e.naissance = t('err.ageRange', { age: info.age, range: agesAcceptes(cat.categories) })
      }
    }
    put(e, 'parentNom', nom(p.parentNom, 2, 80, t, 'parentNom'))
    put(e, 'parentTel', validerPhone(p.parentTel, t))
    put(e, 'parentEmail', validerEmail(p.parentEmail, t))
    put(e, 'urgenceNom', nom(p.urgenceNom, 2, 80, t, 'urgenceNom'))
    put(e, 'urgenceTel', validerPhone(p.urgenceTel, t))
    if (!p.autorisation) e.autorisation = t('err.autorisation')
    if (cat.params.certificatMedical && !p.certificat) e.certificat = t('err.certificat')
  }

  if (p.offre === 'INF') {
    put(e, 'tel', validerPhone(p.tel, t))
    put(e, 'email', validerEmail(p.email, t))
    if (!p.profession) e.profession = t('err.required')
    if (p.profession === 'eleve') {
      if (!p.classe) e.classe = t('err.required')
      if (!(p.etablissement ?? '').trim()) e.etablissement = t('err.required')
      // RG-06 / EF-20 : un élève fournit les coordonnées d'un parent, qui devient le payeur
      put(e, 'parentNom', nom(p.parentNom, 2, 80, t, 'parentNom'))
      put(e, 'parentTel', validerPhone(p.parentTel, t))
      put(e, 'parentEmail', validerEmail(p.parentEmail, t))
    }
    if (p.profession === 'etudiant' && !(p.etablissement ?? '').trim()) e.etablissement = t('err.required')
    if (p.profession === 'enseignant' && !(p.etablissement ?? '').trim()) e.etablissement = t('err.required')
    if (p.profession === 'autre' && !(p.professionExercee ?? '').trim()) e.professionExercee = t('err.required')
  }
  return e
}

/** Contrôles de l'étape 3. */
export function validerChoix(p: Participant, cat: Catalogue, t: T): Errors {
  const e: Errors = {}
  if (p.choix.length === 0) {
    e.choix = p.offre === 'CRN' ? t('err.choixCRN') : p.offre === 'SPT' ? t('err.choixSPT') : t('err.choixINF')
  }
  if (p.offre === 'INF') {
    const c = conflitsCreneau(p.choix, cat)
    if (c.length) e.creneau = t('err.creneau', { a: c[0][0].libelle, b: c[0][1].libelle })
  }
  return e
}

export function validerPayeur(py: Payeur, t: T): Errors {
  const e: Errors = {}
  put(e, 'nom', nom(py.nom, 2, 80, t, 'nom'))
  put(e, 'tel', validerPhone(py.tel, t))
  put(e, 'email', validerEmail(py.email, t))
  return e
}

export { ageRevolu }
