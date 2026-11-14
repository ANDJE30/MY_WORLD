import 'server-only';
import { DEFAULT_SETTINGS, type Settings } from './settings-types';
import { getSettings } from './settings';

/** Paramètres pour les pages publiques : valeurs par défaut si la base n'est pas encore configurée. */
export async function publicSettings(): Promise<Settings> {
  try {
    return await getSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function logoUrl(s: Settings): string | null {
  return s.identity.logoFileId ? `/api/fichiers/${s.identity.logoFileId}` : null;
}
