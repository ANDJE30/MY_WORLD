// Calculs métier purs (sans base de données) — couverts par les tests unitaires.
import { slotMinutes, minutesBetween, schoolMonthToPeriod, toMinutes } from './time';

// ---------------------------------------------------------------- Heures effectuées
export type SeanceLike = {
  status: string;
  startTime: string;
  endTime: string;
  actualStart: Date | null;
  actualEnd: Date | null;
};

export type CountBasis = 'ACTUAL_CAPPED' | 'ACTUAL' | 'PLANNED';

export function plannedMinutes(s: Pick<SeanceLike, 'startTime' | 'endTime'>): number {
  return slotMinutes(s.startTime, s.endTime);
}

/** Minutes effectuées comptabilisées pour une séance (0 si la séance n'est pas terminée). */
export function doneMinutes(s: SeanceLike, basis: CountBasis = 'ACTUAL_CAPPED'): number {
  if (s.status !== 'TERMINEE') return 0;
  const planned = plannedMinutes(s);
  const actual = minutesBetween(s.actualStart, s.actualEnd);
  if (basis === 'PLANNED') return planned;
  if (basis === 'ACTUAL') return actual;
  return Math.min(actual, planned);
}

// ---------------------------------------------------------------- Salaires
export type SalaryInput = {
  mode: 'PRORATA' | 'HORAIRE';
  baseSalary: number;
  hourlyRate: number;
  plannedMin: number;
  doneMin: number;
  capAt100: boolean;
  bonus?: number;
  deduction?: number;
};

export function computeSalary(i: SalaryInput) {
  const rawPct = i.plannedMin > 0 ? (i.doneMin / i.plannedMin) * 100 : i.doneMin > 0 ? 100 : 0;
  const ratePct = Math.round((i.capAt100 ? Math.min(100, rawPct) : rawPct) * 100) / 100;
  const gross =
    i.mode === 'PRORATA'
      ? Math.round((i.baseSalary * ratePct) / 100)
      : Math.round((i.hourlyRate * i.doneMin) / 60);
  const net = Math.max(0, gross + (i.bonus ?? 0) - (i.deduction ?? 0));
  return { ratePct, gross, net };
}

// ---------------------------------------------------------------- Location des salles
export type RentSeance = SeanceLike & { date: string; dayOfWeek: number; roomId: number | null };
export type RentLine = { roomId: number; date: string; dayOfWeek: number; minutes: number; rate: number; amount: number; seances: number };

export function computeRent(
  list: RentSeance[],
  rates: Record<number, Record<string, number>>,
  basis: 'PLANNED' | 'ACTUAL' | 'WINDOW',
  windows: Record<number, { start: string; end: string }>,
): RentLine[] {
  const map = new Map<string, RentLine>();
  for (const s of list) {
    if (s.roomId === null || s.status === 'ANNULEE') continue;
    if (basis === 'ACTUAL' && s.status !== 'TERMINEE') continue;
    const key = `${s.roomId}|${s.date}`;
    const rate = rates[s.roomId]?.[String(s.dayOfWeek)] ?? 0;
    let line = map.get(key);
    if (!line) {
      line = { roomId: s.roomId, date: s.date, dayOfWeek: s.dayOfWeek, minutes: 0, rate, amount: 0, seances: 0 };
      map.set(key, line);
    }
    line.seances++;
    if (basis === 'PLANNED') line.minutes += plannedMinutes(s);
    else if (basis === 'ACTUAL') line.minutes += minutesBetween(s.actualStart, s.actualEnd);
    else {
      const w = windows[s.dayOfWeek];
      line.minutes = w ? slotMinutes(w.start, w.end) : Math.max(line.minutes, plannedMinutes(s));
    }
  }
  const lines = [...map.values()];
  for (const l of lines) l.amount = Math.round((l.minutes / 60) * l.rate);
  return lines.sort((a, b) => (a.date === b.date ? a.roomId - b.roomId : a.date < b.date ? -1 : 1));
}

// ---------------------------------------------------------------- Frais des élèves
export type DueInput = {
  registrationFee: number;
  monthlyFee: number;
  discountPct: number;
  enrolledAt: string; // AAAA-MM-JJ
  billingMonths: string[]; // « 10 », « 11 »…
  yearLabel: string; // « 2026-2027 »
  asOfPeriod: string; // AAAA-MM
};

export function studentDue(i: DueInput) {
  const monthlyNet = Math.round((i.monthlyFee * (100 - Math.min(100, Math.max(0, i.discountPct)))) / 100);
  const enrolledPeriod = i.enrolledAt.slice(0, 7);
  // Mois facturables de l'année scolaire, à partir du mois d'inscription inclus
  const all = [...new Set(i.billingMonths.map((m) => schoolMonthToPeriod(i.yearLabel, m)))]
    .sort()
    .filter((p) => p >= enrolledPeriod);
  const dueMonths = all.filter((p) => p <= i.asOfPeriod);
  return {
    monthlyNet,
    allMonths: all,
    dueMonths,
    dueToDate: i.registrationFee + monthlyNet * dueMonths.length,
    dueTotal: i.registrationFee + monthlyNet * all.length,
  };
}

export type MonthState = { period: string; due: number; paid: number; state: 'PAYE' | 'PARTIEL' | 'IMPAYE' };

/** Répartit les paiements : d'abord l'inscription, puis les mois dans l'ordre chronologique. */
export function allocate(totalPaid: number, registrationFee: number, monthlyNet: number, months: string[]) {
  let rest = totalPaid;
  const regPaid = Math.min(rest, registrationFee);
  rest -= regPaid;
  const states: MonthState[] = months.map((period) => {
    const paid = Math.min(rest, monthlyNet);
    rest -= paid;
    return { period, due: monthlyNet, paid, state: monthlyNet === 0 || paid >= monthlyNet ? 'PAYE' : paid > 0 ? 'PARTIEL' : 'IMPAYE' };
  });
  return { registration: { due: registrationFee, paid: regPaid }, months: states, credit: rest };
}

// ---------------------------------------------------------------- Assiduité & notes
export function attendanceStats(statuses: string[]) {
  const c = { PRESENT: 0, RETARD: 0, ABSENT: 0, EXCUSE: 0 };
  for (const s of statuses) if (s in c) c[s as keyof typeof c]++;
  const counted = c.PRESENT + c.RETARD + c.ABSENT;
  const rate = counted > 0 ? ((c.PRESENT + c.RETARD) / counted) * 100 : null;
  return { ...c, total: statuses.length, rate };
}

export type GradeLike = { score: number | null; absent: boolean; maxScore: number; coefficient: number };

/** Moyenne pondérée ramenée sur 20 (les absences ne sont pas comptées). */
export function weightedAverage(list: GradeLike[]): number | null {
  let sum = 0;
  let coef = 0;
  for (const g of list) {
    if (g.absent || g.score === null || g.maxScore <= 0) continue;
    sum += (g.score / g.maxScore) * 20 * g.coefficient;
    coef += g.coefficient;
  }
  return coef > 0 ? Math.round((sum / coef) * 100) / 100 : null;
}

export function appreciation(avg: number | null): string {
  if (avg === null) return 'Pas encore évalué';
  if (avg >= 18) return 'Excellent';
  if (avg >= 16) return 'Très bien';
  if (avg >= 14) return 'Bien';
  if (avg >= 12) return 'Assez bien';
  if (avg >= 10) return 'Passable';
  if (avg >= 8) return 'Insuffisant — doit redoubler d’efforts';
  return 'Faible — accompagnement renforcé nécessaire';
}

// ---------------------------------------------------------------- Planning
export type SlotDef = { day: number; start: string; end: string };
export type Demand = { classId: number; subjectId: number; tutorId: number; count: number };
export type Placement = { classId: number; subjectId: number; tutorId: number; roomId: number; day: number; start: string; end: string };

/**
 * Génère un planning hebdomadaire sans conflit : une classe, un encadreur et une salle ne peuvent être
 * occupés deux fois sur le même créneau. Heuristique gloutonne : les encadreurs les plus chargés d'abord,
 * répartition des matières d'une classe sur les différents jours, salle habituelle de la classe privilégiée.
 */
export function generatePlanning(slots: SlotDef[], roomIds: number[], demands: Demand[]) {
  let best = placeGreedy(slots, roomIds, demands, null);
  if (best.unplaced.length === 0) return best;
  // Si l'ordre naturel échoue, on essaie d'autres ordres (pseudo-aléatoires mais reproductibles) et on garde le meilleur.
  let seed = 7919;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let attempt = 0; attempt < 400; attempt++) {
    const order = demands.map((d) => ({ d, k: rand() })).sort((a, b) => a.k - b.k).map((x) => x.d);
    const r = placeGreedy(slots, roomIds, order, order);
    const missing = (x: typeof r) => x.unplaced.reduce((a, u) => a + u.count, 0);
    if (missing(r) < missing(best)) best = r;
    if (missing(best) === 0) break;
  }
  return best;
}

function placeGreedy(slots: SlotDef[], roomIds: number[], demands: Demand[], fixedOrder: Demand[] | null) {
  const placements: Placement[] = [];
  const unplaced: Demand[] = [];
  const key = (s: SlotDef) => `${s.day}|${s.start}`;
  const classBusy = new Set<string>();
  const tutorBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const classRoom = new Map<number, number>();
  const tutorLoad = new Map<number, number>();
  for (const d of demands) tutorLoad.set(d.tutorId, (tutorLoad.get(d.tutorId) ?? 0) + d.count);
  const ordered = fixedOrder ?? [...demands].sort((a, b) => (tutorLoad.get(b.tutorId)! - tutorLoad.get(a.tutorId)!) || b.count - a.count || a.classId - b.classId);

  for (const d of ordered) {
    for (let k = 0; k < d.count; k++) {
      let best: { slot: SlotDef; room: number; score: number } | null = null;
      slots.forEach((slot, idx) => {
        const sk = key(slot);
        if (classBusy.has(`${d.classId}|${sk}`) || tutorBusy.has(`${d.tutorId}|${sk}`)) return;
        const freeRooms = roomIds.filter((r) => !roomBusy.has(`${r}|${sk}`));
        if (freeRooms.length === 0) return;
        const preferred = classRoom.get(d.classId);
        const room = preferred && freeRooms.includes(preferred) ? preferred : freeRooms[0];
        const classSameDay = placements.filter((p) => p.classId === d.classId && p.day === slot.day).length;
        const sameSubjectSameDay = placements.some((p) => p.classId === d.classId && p.subjectId === d.subjectId && p.day === slot.day);
        const tutorSameDay = placements.some((p) => p.tutorId === d.tutorId && p.day === slot.day);
        const score = classSameDay * 10 + (sameSubjectSameDay ? 25 : 0) + (tutorSameDay ? -3 : 0) + (room === preferred ? -1 : 0) + idx * 0.01;
        if (!best || score < best.score) best = { slot, room, score };
      });
      if (!best) {
        unplaced.push({ ...d, count: d.count - k });
        break;
      }
      const { slot, room } = best as { slot: SlotDef; room: number };
      const sk = key(slot);
      classBusy.add(`${d.classId}|${sk}`);
      tutorBusy.add(`${d.tutorId}|${sk}`);
      roomBusy.add(`${room}|${sk}`);
      if (!classRoom.has(d.classId)) classRoom.set(d.classId, room);
      placements.push({ classId: d.classId, subjectId: d.subjectId, tutorId: d.tutorId, roomId: room, day: slot.day, start: slot.start, end: slot.end });
    }
  }
  return { placements, unplaced };
}

export type TimeslotLike = { id: number; dayOfWeek: number; startTime: string; endTime: string; classId: number; tutorId: number | null; roomId: number | null };
export type Conflict = { a: number; b: number; kind: 'CLASSE' | 'ENCADREUR' | 'SALLE' };

/** Détecte les chevauchements (même jour, horaires qui se recoupent) sur une même classe, un même encadreur ou une même salle. */
export function findConflicts(list: TimeslotLike[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      const overlap = toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
      if (!overlap) continue;
      if (a.classId === b.classId) out.push({ a: a.id, b: b.id, kind: 'CLASSE' });
      if (a.tutorId && a.tutorId === b.tutorId) out.push({ a: a.id, b: b.id, kind: 'ENCADREUR' });
      if (a.roomId && a.roomId === b.roomId) out.push({ a: a.id, b: b.id, kind: 'SALLE' });
    }
  }
  return out;
}
