import type { Operateur } from './types'

/** Normalise une saisie en 9 chiffres nationaux (sans +237). */
export function nationalDigits(input: string): string {
  let d = (input || '').replace(/\D/g, '')
  if (d.startsWith('237') && d.length > 9) d = d.slice(3)
  return d.slice(0, 9)
}

export function isValidMobile(input: string): boolean {
  return /^6\d{8}$/.test(nationalDigits(input))
}

/** Format international E.164 : +237 suivi de 9 chiffres. */
export function toE164(input: string): string {
  return `+237${nationalDigits(input)}`
}

export function formatPhone(e164: string): string {
  const d = nationalDigits(e164)
  if (d.length !== 9) return e164
  return `+237 ${d[0]} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
}

/** Saisie en cours : « 6 77 12 34 56 ». */
export function groupNational(input: string): string {
  const d = nationalDigits(input)
  const out = [d.slice(0, 1), d.slice(1, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean)
  return out.join(' ')
}

export function maskPhone(e164: string): string {
  const d = nationalDigits(e164)
  if (d.length !== 9) return e164
  return `+237 ${d[0]}•• •• •• ${d.slice(7)}`
}

/**
 * Suggestion d'opérateur d'après le préfixe. MTN : 650-654, 67x, 680-683.
 * Orange : 655-659, 69x, 686-689. Le payeur garde la main.
 */
export function suggestOperator(input: string): Operateur | null {
  const d = nationalDigits(input)
  if (d.length < 3 || d[0] !== '6') return null
  const p3 = parseInt(d.slice(0, 3), 10)
  if ((p3 >= 650 && p3 <= 654) || (p3 >= 670 && p3 <= 679) || (p3 >= 680 && p3 <= 683)) return 'MTN'
  if ((p3 >= 655 && p3 <= 659) || (p3 >= 690 && p3 <= 699) || (p3 >= 686 && p3 <= 689)) return 'ORANGE'
  return null
}
