import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { assignments, students } from '@/db/schema';
import { getSessionUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { pdfResponse } from '@/lib/pdf/base';
import { accesPdf, appUrl, caissePdf, elevesPdf, impayesPdf, locationPdf, planningPdf, presencesPdf, salairesPdf, seancesPdf } from '@/lib/pdf/docs';
import { currentPeriod, periodBounds, todayISO, addDays } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const isPeriod = (v: string | null) => (v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null);
const isDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const int = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : null);

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const u = await getSessionUser();
  if (!u) return new NextResponse('Non authentifié', { status: 401 });
  const { kind } = await params;
  const q = new URL(req.url).searchParams;
  try {
    if (kind === 'planning') {
      const classId = int(q.get('classe'));
      if (u.role === 'ENCADREUR' && classId) {
        const [a] = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.tutorId, u.tutorId!), eq(assignments.classId, classId))).limit(1);
        if (!a) return new NextResponse('Accès refusé', { status: 403 });
      }
      if (u.role === 'PARENT') {
        if (!classId) return new NextResponse('Classe requise', { status: 400 });
        const kids = await db.select({ classId: students.classId }).from(students).where(eq(students.parentId, u.parentId!));
        if (!kids.some((k) => k.classId === classId)) return new NextResponse('Accès refusé', { status: 403 });
      }
      return pdfResponse(await planningPdf(classId), `planning-${classId ?? 'general'}-${todayISO()}.pdf`);
    }
    if (u.role !== 'ADMIN') return new NextResponse('Accès refusé', { status: 403 });
    const period = isPeriod(q.get('mois')) ?? currentPeriod();
    switch (kind) {
      case 'seances':
        return pdfResponse(await seancesPdf(period, int(q.get('classe'))), `seances-${period}.pdf`);
      case 'salaires':
        await audit(u, 'PDF_SALAIRES', { details: { period } });
        return pdfResponse(await salairesPdf(period), `etat-salaires-${period}.pdf`);
      case 'location':
        return pdfResponse(await locationPdf(period), `etat-location-salles-${period}.pdf`);
      case 'caisse': {
        const from = isDate(q.get('du')) ?? periodBounds(currentPeriod()).start;
        const to = isDate(q.get('au')) ?? todayISO();
        await audit(u, 'PDF_CAISSE', { details: { from, to } });
        return pdfResponse(await caissePdf(from, to), `etat-caisse-${from}-${to}.pdf`);
      }
      case 'eleves':
        return pdfResponse(await elevesPdf(int(q.get('classe'))), `liste-eleves-${todayISO()}.pdf`);
      case 'impayes':
        return pdfResponse(await impayesPdf(int(q.get('classe'))), `impayes-${todayISO()}.pdf`);
      case 'presences': {
        const classId = int(q.get('classe'));
        if (!classId) return new NextResponse('Classe requise', { status: 400 });
        return pdfResponse(await presencesPdf(classId, isDate(q.get('du')) ?? addDays(todayISO(), -30), isDate(q.get('au')) ?? todayISO()), `presences-${todayISO()}.pdf`);
      }
      default:
        return new NextResponse('Document inconnu', { status: 404 });
    }
  } catch (e) {
    console.error('[pdf]', kind, e);
    return new NextResponse('Erreur lors de la génération du PDF', { status: 500 });
  }
}

const accesSchema = z.object({
  creds: z.array(z.object({ name: z.string().max(120), role: z.enum(['ADMIN', 'ENCADREUR', 'PARENT']), username: z.string().max(80), password: z.string().max(80) })).min(1).max(400),
});

export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const u = await getSessionUser();
  if (!u || u.role !== 'ADMIN') return new NextResponse('Accès refusé', { status: 403 });
  if ((await params).kind !== 'acces') return new NextResponse('Document inconnu', { status: 404 });
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host && new URL(origin).host !== req.headers.get('x-forwarded-host')) return new NextResponse('Origine refusée', { status: 403 });
  const parsed = accesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse('Données invalides', { status: 400 });
  await audit(u, 'FICHES_ACCES_IMPRIMEES', { details: { n: parsed.data.creds.length } });
  return pdfResponse(await accesPdf(parsed.data.creds, appUrl(req)), `fiches-acces-${todayISO()}.pdf`);
}
