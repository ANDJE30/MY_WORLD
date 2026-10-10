import { reactive, watch } from 'vue'
import type {
  Avoir, CategorieAge, Commande, Facture, Paiement, Parametres, Prestation, Rapprochement, Session,
  SmsLog, TarifHistorique, Utilisateur, AuditEntry,
} from '../lib/types'
import { CATEGORIES, defaultParams, defaultPrestations, defaultSessions } from '../data/catalog'
import { buildSeed } from './seed'

export interface InscriptionRow {
  id: string
  commandeId: string
  participantId: string
  prestationId: string
  groupe: string
  prix: number
  statut: 'RESERVEE' | 'CONFIRMEE' | 'LISTE_ATTENTE' | 'LIBEREE' | 'ANNULEE'
  creeLe: string
  doublon?: boolean
  notifie?: boolean
}

export interface Hold {
  key: string
  commandeId: string
  expireLe: string
}

export interface DB {
  v: number
  sessions: Session[]
  prestations: Prestation[]
  categories: CategorieAge[]
  params: Parametres
  commandes: Commande[]
  inscriptions: InscriptionRow[]
  paiements: Paiement[]
  factures: Facture[]
  avoirs: Avoir[]
  utilisateurs: Utilisateur[]
  audit: AuditEntry[]
  messages: SmsLog[]
  tarifs: TarifHistorique[]
  base: Record<string, number> // places déjà attribuées hors plateforme
  holds: Hold[]
  compteurs: Record<string, number>
  rapprochements: Rapprochement[]
}

const KEY = 'vogt.db.v1'
const VERSION = 1

function fresh(): DB {
  const base: DB = {
    v: VERSION,
    sessions: defaultSessions(),
    prestations: defaultPrestations(),
    categories: CATEGORIES.map((c) => ({ ...c })),
    params: defaultParams(),
    commandes: [], inscriptions: [], paiements: [], factures: [], avoirs: [], utilisateurs: [], audit: [],
    messages: [], tarifs: [], base: {}, holds: [], compteurs: {}, rapprochements: [],
  }
  return buildSeed(base)
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.v === VERSION) return parsed
    }
  } catch {
    /* stockage indisponible : on repart d'un jeu de démonstration */
  }
  return fresh()
}

export const db = reactive<DB>(load())

let timer: number | undefined
watch(
  db,
  () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(db))
      } catch {
        /* quota atteint ou mode privé */
      }
    }, 150)
  },
  { deep: true },
)

export function resetDemo() {
  const f = fresh()
  Object.assign(db, f)
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* ignore */
  }
}

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
export const nowIso = () => new Date().toISOString()
