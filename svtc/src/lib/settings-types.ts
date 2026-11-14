// Paramètres de la structure (types et valeurs par défaut issues des supports de communication SVTC).

export type SessionSlot = { start: string; end: string };
export type SessionDay = { day: number; label: string; start: string; end: string; slots: SessionSlot[] };

export type Settings = {
  identity: {
    name: string;
    shortName: string;
    tagline: string;
    motto: string;
    slogan: string;
    description: string;
    host: string;
    address: string;
    city: string;
    country: string;
    phones: string[];
    whatsapp: string;
    email: string;
    website: string;
    directorName: string;
    directorTitle: string;
    logoFileId: string | null;
    bannerFileId: string | null;
  };
  sessions: { days: SessionDay[] };
  billing: {
    receiptPrefix: string;
    billingMonths: string[]; // « 10 », « 11 »…
    rentBasis: 'PLANNED' | 'ACTUAL' | 'WINDOW';
  };
  salary: {
    mode: 'PRORATA' | 'HORAIRE';
    capAt100: boolean;
    countBasis: 'ACTUAL_CAPPED' | 'ACTUAL' | 'PLANNED';
  };
  sms: { senderName: string; signature: string };
  security: { forcePasswordChange: boolean };
};

export const DEFAULT_SETTINGS: Settings = {
  identity: {
    name: 'SILICON VALLEY TRAINING CENTER',
    shortName: 'SVTC',
    tagline: 'Comprendre. Pratiquer. Maîtriser.',
    motto: "C'est votre ATTITUDE, non pas seulement votre aptitude, qui détermine votre ALTITUDE.",
    slogan: "Former aujourd'hui les talents numériques de demain.",
    description:
      "Cours de répétitions et préparation aux examens officiels pour les élèves de l'enseignement secondaire (de la sixième en terminale) dans le domaine de l'informatique.",
    host: 'Centre Éducatif TYRANNUS',
    address: 'Biyem-Assi Lac',
    city: 'Yaoundé',
    country: 'Cameroun',
    phones: ['657513641', '695840597', '697760779'],
    whatsapp: '657513641',
    email: '',
    website: '',
    directorName: '',
    directorTitle: 'Le Promoteur',
    logoFileId: null,
    bannerFileId: null,
  },
  sessions: {
    days: [
      { day: 3, label: 'Mercredi', start: '15:30', end: '18:00', slots: [{ start: '15:30', end: '16:45' }, { start: '16:45', end: '18:00' }] },
      { day: 0, label: 'Dimanche', start: '10:00', end: '14:00', slots: [{ start: '10:00', end: '12:00' }, { start: '12:00', end: '14:00' }] },
    ],
  },
  billing: {
    receiptPrefix: 'SVTC',
    billingMonths: ['10', '11', '12', '01', '02', '03', '04', '05'],
    rentBasis: 'PLANNED',
  },
  salary: { mode: 'PRORATA', capAt100: true, countBasis: 'ACTUAL_CAPPED' },
  sms: { senderName: 'SVTC', signature: 'SVTC — 657 513 641' },
  security: { forcePasswordChange: false },
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Fusion profonde : les valeurs enregistrées remplacent les valeurs par défaut, les nouvelles clés gardent leur défaut. */
export function mergeSettings<T>(base: T, patch: unknown): T {
  if (!isObj(base) || !isObj(patch)) return (patch === undefined ? base : (patch as T));
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in out)) continue;
    const b = (base as Record<string, unknown>)[k];
    out[k] = isObj(b) ? mergeSettings(b, v) : v === undefined ? b : v;
  }
  return out as T;
}
