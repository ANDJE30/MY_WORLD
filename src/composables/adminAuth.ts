import { computed, reactive } from 'vue'
import type { OffreCode, Role, Utilisateur } from '../lib/types'

const KEY = 'vogt.admin.session'
interface S { user: Pick<Utilisateur, 'id' | 'nom' | 'email' | 'role'> | null }

function load(): S {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as S
  } catch { /* ignore */ }
  return { user: null }
}

export const adminState = reactive<S>(load())

export function setAdmin(u: Utilisateur | null) {
  adminState.user = u ? { id: u.id, nom: u.nom, email: u.email, role: u.role } : null
  try {
    if (u) sessionStorage.setItem(KEY, JSON.stringify(adminState))
    else sessionStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

export const role = computed<Role | null>(() => adminState.user?.role ?? null)

/** Chaque compte ne voit que les offres qui le concernent (§8). */
export const offresVisibles = computed<OffreCode[]>(() => {
  switch (role.value) {
    case 'resp_crn': return ['CRN']
    case 'resp_spt': return ['SPT']
    case 'resp_inf': return ['INF']
    case 'admin': case 'economat': return ['CRN', 'SPT', 'INF']
    default: return []
  }
})

export const can = {
  finances: () => role.value === 'admin' || role.value === 'economat',
  avoirs: () => role.value === 'economat',
  parametrer: () => role.value === 'admin',
  utilisateurs: () => role.value === 'admin',
  audit: () => role.value === 'admin',
  listes: () => role.value !== null,
  sms: () => role.value !== null && role.value !== 'economat',
}
