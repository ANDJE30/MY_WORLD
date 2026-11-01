// Contexte de requête : base de données de l'établissement (ou de la plateforme) en cours.
// Chaque requête s'exécute dans son propre contexte : un établissement ne peut jamais lire la base d'un autre.
import { AsyncLocalStorage } from 'node:async_hooks';

export const als = new AsyncLocalStorage();

export function currentDb() {
  const s = als.getStore();
  if (!s?.db) throw Object.assign(new Error('Aucune base de données active pour cette requête.'), { status: 500 });
  return s.db;
}
export const currentTenant = () => als.getStore()?.tenant ?? null;

/** Exécute fn avec la base `handle` comme base courante (synchrone ou asynchrone). */
export function withDb(handle, fn, extra = {}) {
  return als.run({ ...(als.getStore() || {}), ...extra, db: handle }, fn);
}
