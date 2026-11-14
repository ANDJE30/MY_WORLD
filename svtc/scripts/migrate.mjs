// Applique les migrations SQL (dossier drizzle/) sur la base DATABASE_URL. Exécuté automatiquement avant chaque build.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

let url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (url) {
  // Paramètres réservés aux clients libpq (ex. channel_binding de Neon) : à ne pas transmettre au serveur
  const u = new URL(url);
  for (const k of ['channel_binding', 'pgbouncer', 'connect_timeout', 'pool_timeout', 'schema']) u.searchParams.delete(k);
  url = u.toString();
}
if (!url) {
  console.warn('[migrate] DATABASE_URL absente : migrations ignorées (configurez la base avant la mise en production).');
  process.exit(0);
}
const host = new URL(url).hostname;
const local = ['localhost', '127.0.0.1'].includes(host) || !host.includes('.') || /sslmode=disable/.test(url);
const sql = postgres(url, { max: 1, prepare: false, ssl: local ? false : 'require', onnotice: () => {} });
try {
  await migrate(drizzle(sql), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  console.log('[migrate] base de données à jour');
} catch (e) {
  console.error('[migrate] échec :', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
