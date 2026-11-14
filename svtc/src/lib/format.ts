// Mise en forme (dates, montants, téléphones) — fuseau Africa/Douala, langue française.
import { DAYS, MONTHS, TIMEZONE } from './constants';

/** Sépare les milliers par une espace insécable simple (compatible avec les polices PDF). */
export function num(n: number | null | undefined, digits = 0): string {
  const v = Number(n ?? 0);
  const fixed = Math.abs(v).toFixed(digits);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (v < 0 ? '-' : '') + grouped + (dec ? ',' + dec : '');
}

export function money(n: number | null | undefined): string {
  return `${num(Math.round(Number(n ?? 0)))} FCFA`;
}

export function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${num(n, digits)} %`;
}

export function score(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return num(Math.round(n * 100) / 100, 2).replace(/,00$/, '');
}

/** Date ISO (AAAA-MM-JJ) → « 12/11/2026 ». */
export function dateFr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Date ISO → « mercredi 12 novembre 2026 ». */
export function dateLong(iso: string | null | undefined, withDay = true): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${withDay ? DAYS[dow].toLowerCase() + ' ' : ''}${d} ${MONTHS[m - 1]} ${y}`;
}

export function dateShort(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[dow].slice(0, 3)}. ${d} ${MONTHS[m - 1].slice(0, 4)}${MONTHS[m - 1].length > 4 ? '.' : ''}`;
}

/** Horodatage → « 12/11/2026 à 15:42 » (heure du Cameroun). */
export function dateTimeFr(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('day')}/${g('month')}/${g('year')} à ${g('hour')}:${g('minute')}`;
}

/** Heure locale d'un horodatage → « 15:42 ». */
export function timeOf(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

/** « 15:30 » → « 15h30 ». */
export function hm(t: string | null | undefined): string {
  if (!t) return '—';
  const [h, m] = t.split(':');
  return `${Number(h)}h${m}`;
}

/** Durée en minutes → « 2 h 30 ». */
export function duration(min: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(min ?? 0)));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r ? `${h} h ${String(r).padStart(2, '0')}` : `${h} h`;
}

export function hours(min: number | null | undefined, digits = 2): string {
  return `${num(Math.round((Number(min ?? 0) / 60) * 100) / 100, digits).replace(/,00$/, '')} h`;
}

/** Période « 2026-11 » → « novembre 2026 ». */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Normalise un numéro camerounais : 9 chiffres commençant par 6 ou 2 → « 6XXXXXXXX ». */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00237')) d = d.slice(5);
  else if (d.startsWith('237') && d.length === 12) d = d.slice(3);
  return d;
}

export function isValidCmPhone(raw: string): boolean {
  return /^[62]\d{8}$/.test(normalizePhone(raw));
}

/** « 657513641 » → « 657 51 36 41 ». */
export function phoneFr(raw: string | null | undefined): string {
  const d = normalizePhone(raw);
  if (d.length !== 9) return raw ?? '';
  return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

export function phoneIntl(raw: string | null | undefined): string {
  const d = normalizePhone(raw);
  return d.length === 9 ? `+237${d}` : d;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.lastName.toUpperCase()} ${p.firstName}`;
}

export function plural(n: number, one: string, many?: string) {
  return `${num(n)} ${n > 1 ? many ?? one + 's' : one}`;
}
