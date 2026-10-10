import type { CategorieAge } from './types'

/** Analyse JJ/MM/AAAA ; renvoie null si la date n'existe pas. */
export function parseFrDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || '').trim())
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function frToIso(s: string): string | null {
  const d = parseFrDate(s)
  return d ? toIso(d) : null
}

/** Masque de saisie JJ/MM/AAAA. */
export function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/** Âge révolu à la date de référence (ISO). */
export function ageRevolu(naissance: Date, reference: string): number {
  const ref = new Date(reference + 'T00:00:00Z')
  let age = ref.getUTCFullYear() - naissance.getUTCFullYear()
  const before =
    ref.getUTCMonth() < naissance.getUTCMonth() ||
    (ref.getUTCMonth() === naissance.getUTCMonth() && ref.getUTCDate() < naissance.getUTCDate())
  if (before) age -= 1
  return age
}

export function categorieDe(age: number, categories: CategorieAge[]): CategorieAge | null {
  return categories.find((c) => age >= c.min && age <= c.max) ?? null
}

export function agesAcceptes(categories: CategorieAge[]): string {
  const min = Math.min(...categories.map((c) => c.min))
  const max = Math.max(...categories.map((c) => c.max))
  return `${min} à ${max} ans`
}
