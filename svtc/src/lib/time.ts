// Calculs de dates indépendants du fuseau du serveur (le Cameroun est en UTC+1 toute l'année).
import { TIMEZONE } from './constants';

/** Date du jour au Cameroun, « AAAA-MM-JJ ». */
export function todayISO(now: Date = new Date()): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return p; // en-CA → AAAA-MM-JJ
}

/** Heure courante au Cameroun, « HH:MM ». */
export function nowHM(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

export function currentPeriod(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function slotMinutes(start: string, end: string): number {
  return Math.max(0, toMinutes(end) - toMinutes(start));
}

export function dayOfWeek(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function periodBounds(period: string): { start: string; end: string } {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}` };
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 7);
}

/** Liste des dates (incluses) entre deux bornes dont le jour de semaine est dans `days`. */
export function datesBetween(start: string, end: string, days?: number[]): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 800) {
    if (!days || days.includes(dayOfWeek(cur))) out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Lundi de la semaine contenant la date. */
export function weekStart(iso: string): string {
  const dow = dayOfWeek(iso);
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** Construit un horodatage UTC à partir d'une date et d'une heure locales du Cameroun (UTC+1). */
export function localToDate(iso: string, hhmm: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 1, mi));
}

/** Minutes écoulées entre deux horodatages. */
export function minutesBetween(a: Date | null | undefined, b: Date | null | undefined): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/** Mois d'une année scolaire (« 2026-2027 ») correspondant à des numéros de mois (« 10 », « 01 »…). */
export function schoolMonthToPeriod(yearLabel: string, mm: string): string {
  const startYear = Number(yearLabel.slice(0, 4));
  const month = Number(mm);
  return `${month >= 8 ? startYear : startYear + 1}-${String(month).padStart(2, '0')}`;
}
