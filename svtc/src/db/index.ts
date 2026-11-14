import 'server-only';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __svtcSql: ReturnType<typeof postgres> | undefined;
}

function connectionString() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL non définie : configurez la base PostgreSQL (voir .env.example).');
  return url;
}

function client() {
  if (!globalThis.__svtcSql) {
    const url = connectionString();
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    globalThis.__svtcSql = postgres(url, {
      max: process.env.VERCEL ? 3 : 10,
      prepare: false, // compatible avec les pools PgBouncer (Neon, Supabase)
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: local ? false : 'require',
      onnotice: () => {},
    });
  }
  return globalThis.__svtcSql;
}

export type DB = PostgresJsDatabase<typeof schema>;

let _db: DB | undefined;
export function getDb(): DB {
  if (!_db) _db = drizzle(client(), { schema });
  return _db;
}

/** Accès paresseux : la connexion n'est ouverte qu'à la première requête. */
export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export { schema };
