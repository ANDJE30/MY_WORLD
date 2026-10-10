import { ref } from 'vue'
import { fr } from './locales/fr'
import { en } from './locales/en'

export type Locale = 'fr' | 'en'
const KEY = 'vogt.locale'

function initial(): Locale {
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'fr' || s === 'en') return s
  } catch { /* ignore */ }
  return 'fr'
}

export const locale = ref<Locale>(initial())

export function setLocale(l: Locale) {
  locale.value = l
  document.documentElement.lang = l
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string

export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = locale.value === 'en' ? en : fr
  let s = dict[key] ?? fr[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export function useI18n() {
  return { t, locale, setLocale }
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'Africa/Douala', ...opts }).format(new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso))
}
export function fmtDateTime(iso: string): string {
  return fmtDate(iso, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
