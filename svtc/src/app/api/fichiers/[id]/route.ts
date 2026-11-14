import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documents, students, assignments } from '@/db/schema';
import { getSessionUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { readFile } from '@/lib/files';

/** Téléchargement sécurisé d'un fichier : contrôle d'accès selon le rôle et le rattachement du document. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSettings();
  const isPublic = id === s.identity.logoFileId || id === s.identity.bannerFileId;
  if (!isPublic) {
    const u = await getSessionUser();
    if (!u) return new NextResponse('Non authentifié', { status: 401 });
    if (u.role !== 'ADMIN') {
      const [doc] = await db.select().from(documents).where(eq(documents.fileId, id)).limit(1);
      if (!doc) return new NextResponse('Accès refusé', { status: 403 });
      let allowed = false;
      if (u.role === 'ENCADREUR' && u.tutorId) {
        if (doc.tutorId === u.tutorId) allowed = true;
        else if (doc.classId && doc.status === 'APPROUVE') {
          const [a] = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.tutorId, u.tutorId), eq(assignments.classId, doc.classId))).limit(1);
          allowed = !!a;
        }
      } else if (u.role === 'PARENT' && u.parentId && doc.visibleToParents && doc.status === 'APPROUVE' && doc.classId) {
        const kids = await db.select({ classId: students.classId }).from(students).where(eq(students.parentId, u.parentId));
        allowed = kids.some((k) => k.classId === doc.classId);
      }
      if (!allowed) return new NextResponse('Accès refusé', { status: 403 });
    }
  }
  const f = await readFile(id);
  if (!f) return new NextResponse('Fichier introuvable', { status: 404 });
  const download = new URL(req.url).searchParams.get('dl') === '1';
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      'Content-Type': f.mime,
      'Content-Length': String(f.size),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${f.name.replace(/"/g, '')}"`,
      'Cache-Control': isPublic ? 'public, max-age=3600' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // Les images sont isolées ; les PDF sont affichés par la visionneuse intégrée du navigateur.
      ...(f.mime === 'application/pdf' ? {} : { 'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox" }),
    },
  });
}

export const dynamic = 'force-dynamic';
