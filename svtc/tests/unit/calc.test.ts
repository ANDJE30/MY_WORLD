import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSalary, computeRent, doneMinutes, studentDue, allocate, attendanceStats, weightedAverage, generatePlanning, findConflicts } from '../../src/lib/calc';
import { amountInWords } from '../../src/lib/words';
import { money, normalizePhone, isValidCmPhone, phoneFr, dateLong, duration } from '../../src/lib/format';
import { localToDate, todayISO, periodBounds, schoolMonthToPeriod, datesBetween, weekStart } from '../../src/lib/time';

const at = (d: string, hm: string) => localToDate(d, hm);

test('salaire au prorata des heures effectuées', () => {
  const r = computeSalary({ mode: 'PRORATA', baseSalary: 60000, hourlyRate: 0, plannedMin: 600, doneMin: 450, capAt100: true });
  assert.equal(r.ratePct, 75);
  assert.equal(r.gross, 45000);
  const capped = computeSalary({ mode: 'PRORATA', baseSalary: 60000, hourlyRate: 0, plannedMin: 600, doneMin: 700, capAt100: true });
  assert.equal(capped.gross, 60000);
  const withBonus = computeSalary({ mode: 'PRORATA', baseSalary: 50000, hourlyRate: 0, plannedMin: 100, doneMin: 100, capAt100: true, bonus: 5000, deduction: 2000 });
  assert.equal(withBonus.net, 53000);
});

test('salaire au taux horaire', () => {
  const r = computeSalary({ mode: 'HORAIRE', baseSalary: 0, hourlyRate: 2500, plannedMin: 600, doneMin: 270, capAt100: true });
  assert.equal(r.gross, 11250);
});

test('heures effectuées plafonnées à la durée prévue', () => {
  const s = { status: 'TERMINEE', startTime: '15:30', endTime: '16:45', actualStart: at('2026-11-11', '15:25'), actualEnd: at('2026-11-11', '17:00') };
  assert.equal(doneMinutes(s, 'ACTUAL_CAPPED'), 75);
  assert.equal(doneMinutes(s, 'ACTUAL'), 95);
  assert.equal(doneMinutes({ ...s, status: 'EN_COURS' }), 0);
});

test('location des salles : 500 F/h le mercredi, 1000 F/h le dimanche', () => {
  const base = { status: 'TERMINEE', actualStart: null, actualEnd: null };
  const list = [
    { ...base, date: '2026-11-11', dayOfWeek: 3, roomId: 1, startTime: '15:30', endTime: '16:45' },
    { ...base, date: '2026-11-11', dayOfWeek: 3, roomId: 1, startTime: '16:45', endTime: '18:00' },
    { ...base, date: '2026-11-15', dayOfWeek: 0, roomId: 2, startTime: '10:00', endTime: '12:00' },
    { ...base, date: '2026-11-15', dayOfWeek: 0, roomId: 2, startTime: '12:00', endTime: '14:00', status: 'ANNULEE' },
  ];
  const rates = { 1: { '3': 500, '0': 1000 }, 2: { '3': 500, '0': 1000 } };
  const lines = computeRent(list, rates, 'PLANNED', {});
  assert.equal(lines.length, 2);
  assert.equal(lines[0].minutes, 150);
  assert.equal(lines[0].amount, 1250); // 2 h 30 × 500
  assert.equal(lines[1].amount, 2000); // 2 h × 1000 (séance annulée exclue)
  const win = computeRent(list, rates, 'WINDOW', { 3: { start: '15:30', end: '18:00' }, 0: { start: '10:00', end: '14:00' } });
  assert.equal(win.find((l) => l.dayOfWeek === 0)!.amount, 4000);
});

test('montant dû par un élève et répartition des paiements', () => {
  const d = studentDue({ registrationFee: 5000, monthlyFee: 10000, discountPct: 20, enrolledAt: '2026-10-15', billingMonths: ['10', '11', '12', '01', '02', '03', '04', '05'], yearLabel: '2026-2027', asOfPeriod: '2026-11' });
  assert.equal(d.monthlyNet, 8000);
  assert.deepEqual(d.dueMonths, ['2026-10', '2026-11']);
  assert.equal(d.dueToDate, 5000 + 16000);
  assert.equal(d.allMonths.length, 8);
  const a = allocate(15000, 5000, 8000, d.allMonths);
  assert.equal(a.registration.paid, 5000);
  assert.equal(a.months[0].state, 'PAYE');
  assert.equal(a.months[1].state, 'PARTIEL');
  assert.equal(a.months[2].state, 'IMPAYE');
});

test('assiduité et moyenne pondérée', () => {
  const s = attendanceStats(['PRESENT', 'PRESENT', 'RETARD', 'ABSENT', 'EXCUSE']);
  assert.equal(s.rate, 75);
  assert.equal(weightedAverage([{ score: 15, absent: false, maxScore: 20, coefficient: 1 }, { score: 8, absent: false, maxScore: 10, coefficient: 2 }, { score: null, absent: true, maxScore: 20, coefficient: 1 }]), 15.67);
});

test('planning automatique sans conflit', () => {
  const slots = [{ day: 3, start: '15:30', end: '16:45' }, { day: 3, start: '16:45', end: '18:00' }, { day: 0, start: '10:00', end: '12:00' }, { day: 0, start: '12:00', end: '14:00' }];
  const demands = [
    { classId: 1, subjectId: 1, tutorId: 1, count: 1 }, { classId: 2, subjectId: 1, tutorId: 1, count: 1 }, { classId: 3, subjectId: 1, tutorId: 1, count: 1 },
    { classId: 1, subjectId: 2, tutorId: 2, count: 2 }, { classId: 2, subjectId: 3, tutorId: 3, count: 1 }, { classId: 3, subjectId: 2, tutorId: 2, count: 1 },
  ];
  const { placements, unplaced } = generatePlanning(slots, [10, 11], demands);
  assert.equal(unplaced.length, 0);
  assert.equal(placements.length, 7);
  const asSlots = placements.map((p, i) => ({ id: i, dayOfWeek: p.day, startTime: p.start, endTime: p.end, classId: p.classId, tutorId: p.tutorId, roomId: p.roomId }));
  assert.deepEqual(findConflicts(asSlots), []);
});

test('détection des conflits', () => {
  const c = findConflicts([
    { id: 1, dayOfWeek: 3, startTime: '15:30', endTime: '16:45', classId: 1, tutorId: 1, roomId: 1 },
    { id: 2, dayOfWeek: 3, startTime: '16:00', endTime: '17:00', classId: 2, tutorId: 1, roomId: 2 },
    { id: 3, dayOfWeek: 3, startTime: '16:45', endTime: '18:00', classId: 1, tutorId: 3, roomId: 1 },
  ]);
  assert.deepEqual(c.map((x) => x.kind), ['ENCADREUR']);
});

test('montants en lettres', () => {
  assert.equal(amountInWords(282632), 'Deux cent quatre-vingt-deux mille six cent trente-deux francs CFA');
  assert.equal(amountInWords(80000), 'Quatre-vingt mille francs CFA');
  assert.equal(amountInWords(1250), 'Mille deux cent cinquante francs CFA');
  assert.equal(amountInWords(71), 'Soixante et onze francs CFA');
  assert.equal(amountInWords(200), 'Deux cents francs CFA');
  assert.equal(amountInWords(1000000), 'Un million francs CFA');
});

test('mises en forme françaises et camerounaises', () => {
  assert.equal(money(1250000), '1 250 000 FCFA');
  assert.equal(normalizePhone('+237 657 51 36 41'), '657513641');
  assert.ok(isValidCmPhone('657513641'));
  assert.ok(!isValidCmPhone('12345'));
  assert.equal(phoneFr('657513641'), '657 51 36 41');
  assert.equal(dateLong('2026-11-15'), 'dimanche 15 novembre 2026');
  assert.equal(duration(150), '2 h 30');
});

test('dates : fuseau du Cameroun, périodes et semaines', () => {
  assert.equal(todayISO(new Date('2026-11-14T23:30:00Z')), '2026-11-15'); // 00h30 à Yaoundé
  assert.equal(localToDate('2026-11-11', '15:30').toISOString(), '2026-11-11T14:30:00.000Z');
  assert.deepEqual(periodBounds('2027-02'), { start: '2027-02-01', end: '2027-02-28' });
  assert.equal(schoolMonthToPeriod('2026-2027', '01'), '2027-01');
  assert.equal(datesBetween('2026-11-01', '2026-11-30', [3, 0]).length, 9);
  assert.equal(weekStart('2026-11-15'), '2026-11-09');
});
