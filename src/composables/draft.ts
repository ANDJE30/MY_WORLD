import { reactive, watch } from 'vue'
import type { OffreCode, Participant, Payeur } from '../lib/types'

const KEY = 'vogt.draft.v1'
const TTL = 24 * 3600 * 1000 // EF-05 : la saisie reste sur l'appareil 24 heures

export interface Draft {
  savedAt: number
  step: 1 | 2 | 3 | 4
  current: number
  participants: Participant[]
  payeur: Payeur
  payeurTouched: boolean
  cgu: boolean
  donnees: boolean
}

const empty = (): Draft => ({
  savedAt: Date.now(), step: 1, current: 0, participants: [], payeur: { nom: '', tel: '', email: '' }, payeurTouched: false, cgu: false, donnees: false,
})

function load(): Draft {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d = JSON.parse(raw) as Draft
      if (Date.now() - d.savedAt < TTL) return d
      localStorage.removeItem(KEY)
    }
  } catch { /* ignore */ }
  return empty()
}

export const draft = reactive<Draft>(load())

watch(draft, () => {
  draft.savedAt = Date.now()
  try { localStorage.setItem(KEY, JSON.stringify(draft)) } catch { /* ignore */ }
}, { deep: true })

export function resetDraft() {
  Object.assign(draft, empty())
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function hasDraft(): boolean {
  return draft.participants.some((p) => p.nom || p.prenoms || p.choix.length)
}

export function newParticipant(offre: OffreCode): Participant {
  return {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    offre, nom: '', prenoms: '', sexe: '', naissance: '', parentNom: '', parentTel: '', parentEmail: '', choix: [],
    ...(offre === 'CRN' ? { eleveCollege: '' as const, matricule: '', etablissement: '', classePrecedente: '', classePreparee: '', observations: '' } : {}),
    ...(offre === 'SPT' ? { urgenceNom: '', urgenceTel: '', autorisation: false, certificat: null } : {}),
    ...(offre === 'INF' ? { tel: '', email: '', profession: '' as const, classe: '', etablissement: '', discipline: '', professionExercee: '' } : {}),
  }
}

/** Préremplit le payeur d'après le premier participant (parent, ou l'apprenant lui-même en informatique). */
export function payeurSuggere(p?: Participant): Payeur {
  if (!p) return { nom: '', tel: '', email: '' }
  if (p.offre === 'INF' && p.profession !== 'eleve') return { nom: `${p.nom} ${p.prenoms}`.trim(), tel: p.tel ?? '', email: p.email ?? '' }
  return { nom: p.parentNom, tel: p.parentTel, email: p.parentEmail }
}
