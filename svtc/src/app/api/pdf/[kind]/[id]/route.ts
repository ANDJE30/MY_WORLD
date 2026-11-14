import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { assignments, payments, students } from '@/db/schema';
import { getSessionUser } from '@/lib/auth';
import { pdfResponse } from '@/lib/pdf/base';
import { appUrl, recuPdf, suiviPdf } from '@/lib/pdf/docs';
import { todayISO } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function canSeeStudent(u: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>, studentId: number) {
  if (u.role === 'ADMIN') return true;
  const [st] = await db.select({ classId: students.classId, parentId: students.parentId }).from(students).where(eq(students.id, studentId));
  if (!st) return false;
  if (u.role === 'PARENT') return st.parentId === u.parentId;
  const [a] = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.tutorId, u.tutorId!), eq(assignments.classId, st.classId))).limit(1);
  return !!a;
}

export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const u = await getSessionUser();
  if (!u) return new NextResponse('Non authentifié', { status: 401 });
  const { kind, id: raw } = await params;
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;
  if (!id) return new NextResponse('Identifiant invalide', { status: 400 });
  try {
    if (kind === 'recu') {
      const [p] = await db.select({ studentId: payments.studentId, no: payments.receiptNo }).from(payments).where(eq(payments.id, id));
      if (!p) return new NextResponse('Reçu introuvable', { status: 404 });
      if (u.role === 'ENCADREUR' || !(await canSeeStudent(u, p.studentId))) return new NextResponse('Accès refusé', { status: 403 });
      const buf = await recuPdf(id, appUrl(req));
      return buf ? pdfResponse(buf, `recu-${p.no}.pdf`) : new NextResponse('Reçu introuvable', { status: 404 });
    }
    if (kind === 'suivi') {
      if (!(await canSeeStudent(u, id))) return new NextResponse('Accès refusé', { status: 403 });
      const buf = await suiviPdf(id, appUrl(req));
      return buf ? pdfResponse(buf, `etat-de-suivi-${id}-${todayISO()}.pdf`) : new NextResponse('Élève introuvable', { status: 404 });
    }
    return new NextResponse('Document inconnu', { status: 404 });
  } catch (e) {
    console.error('[pdf]', kind, e);
    return new NextResponse('Erreur lors de la génération du PDF', { status: 500 });
  }
}
