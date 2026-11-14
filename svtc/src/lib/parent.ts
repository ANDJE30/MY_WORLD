import 'server-only';
import { cache } from 'react';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { students, classes } from '@/db/schema';
import { getCurrentYear } from './settings';

/** Enfants du parent connecté (année en cours), et enfant sélectionné via ?enfant=. */
export const myKids = cache(async (parentId: number) => {
  const year = await getCurrentYear();
  return db
    .select({ id: students.id, firstName: students.firstName, lastName: students.lastName, classId: students.classId, className: classes.name, classColor: classes.color, status: students.status, matricule: students.matricule, school: students.school })
    .from(students)
    .innerJoin(classes, eq(classes.id, students.classId))
    .where(and(eq(students.parentId, parentId), eq(students.academicYearId, year.id)))
    .orderBy(asc(students.firstName));
});

export async function selectedKid(parentId: number, raw?: string) {
  const kids = await myKids(parentId);
  const id = Number(raw);
  return { kids, kid: kids.find((k) => k.id === id) ?? kids[0] ?? null };
}
