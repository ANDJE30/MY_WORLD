import 'server-only';
import { cache } from 'react';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { assignments, classes, subjects, tutors } from '@/db/schema';
import { getCurrentYear } from './settings';

/** Attributions de l'encadreur connecté (classes et matières de l'année en cours). */
export const myAssignments = cache(async (tutorId: number) => {
  const year = await getCurrentYear();
  const rows = await db
    .select({ classId: assignments.classId, subjectId: assignments.subjectId, className: classes.name, classCode: classes.code, classColor: classes.color, subjectName: subjects.name, subjectCode: subjects.code, subjectColor: subjects.color })
    .from(assignments)
    .innerJoin(classes, eq(classes.id, assignments.classId))
    .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
    .where(and(eq(assignments.tutorId, tutorId), eq(assignments.academicYearId, year.id)))
    .orderBy(asc(classes.sortOrder), asc(subjects.sortOrder));
  const classIds = [...new Set(rows.map((r) => r.classId))];
  return { rows, classIds, year };
});

export const myProfile = cache(async (tutorId: number) => {
  const [t] = await db.select().from(tutors).where(eq(tutors.id, tutorId));
  return t;
});
