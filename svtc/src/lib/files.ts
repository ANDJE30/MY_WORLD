import 'server-only';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { files } from '@/db/schema';
import { UserError } from './action';

export const MAX_PDF_BYTES = 4 * 1024 * 1024; // limite des fonctions serverless (4,5 Mo par requête)
export const MAX_IMAGE_BYTES = 1024 * 1024;

const IMAGE_SIGNATURES: { mime: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
];

function safeName(name: string, ext: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9 _-]+/g, '')
    .trim()
    .slice(0, 80) || 'document';
  return `${base}.${ext}`;
}

/** Vérifie la signature binaire (et non seulement l'extension) puis enregistre le fichier. */
export async function storeUpload(file: unknown, kind: 'pdf' | 'image', userId: string | null): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new UserError('Aucun fichier sélectionné.');
  const buf = Buffer.from(await file.arrayBuffer());
  let mime: string;
  let ext: string;
  if (kind === 'pdf') {
    if (buf.length > MAX_PDF_BYTES) throw new UserError('Le fichier PDF dépasse 4 Mo. Compressez-le (par exemple avec ilovepdf.com) puis réessayez.');
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new UserError('Le fichier doit être un document PDF valide.');
    mime = 'application/pdf';
    ext = 'pdf';
  } else {
    if (buf.length > MAX_IMAGE_BYTES) throw new UserError("L'image dépasse 1 Mo.");
    const sig = IMAGE_SIGNATURES.find((s) => s.test(buf));
    if (!sig) throw new UserError('Format d’image non accepté (PNG, JPEG ou WebP).');
    mime = sig.mime;
    ext = mime.split('/')[1].replace('jpeg', 'jpg');
  }
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const [row] = await db
    .insert(files)
    .values({ name: safeName(file.name, ext), mime, size: buf.length, sha256, data: buf, uploadedBy: userId })
    .returning({ id: files.id });
  return row.id;
}

export async function readFile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [f] = await db.select().from(files).where(eq(files.id, id)).limit(1);
  return f ?? null;
}

export async function deleteFile(id: string | null | undefined) {
  if (id) await db.delete(files).where(eq(files.id, id));
}
