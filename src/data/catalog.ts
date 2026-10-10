import type { CategorieAge, Parametres, Prestation, Session } from '../lib/types'

/** Tranches proposées (à valider par la coordination sportive), réglables en administration. */
export const CATEGORIES: CategorieAge[] = [
  { code: 'U7', min: 5, max: 6, libelle: 'U7 · 5 ou 6 ans' },
  { code: 'U9', min: 7, max: 8, libelle: 'U9 · 7 ou 8 ans' },
  { code: 'U11', min: 9, max: 10, libelle: 'U11 · 9 ou 10 ans' },
  { code: 'U13', min: 11, max: 12, libelle: 'U13 · 11 ou 12 ans' },
  { code: 'U15', min: 13, max: 14, libelle: 'U15 · 13 ou 14 ans' },
  { code: 'U17', min: 15, max: 16, libelle: 'U17 · 15 ou 16 ans' },
]

export const CLASSES = [
  '6e', '5e', '4e', '3e', '2nde A', '2nde C', '1ère A', '1ère C', '1ère D', '1ère TI', 'Tle A', 'Tle C', 'Tle D', 'Tle TI',
]

/** Classe préparée proposée d'office : la classe suivante (modifiable en cas de redoublement). */
export function classeSuivante(classe: string): string {
  const i = CLASSES.indexOf(classe)
  if (i < 0) return ''
  if (classe === '3e') return '2nde A'
  if (classe.startsWith('Tle')) return classe
  if (classe.startsWith('2nde')) return classe === '2nde A' ? '1ère A' : '1ère C'
  if (classe.startsWith('1ère')) return classe.replace('1ère', 'Tle')
  return CLASSES[i + 1]
}

export const CLASSES_INF = ['6e', '5e', '4e', '3e', '2nde', '1ère', 'Terminale']

const iso = (d: Date) => d.toISOString().slice(0, 10)
const plusDays = (base: Date, n: number) => new Date(base.getTime() + n * 86400000)

export function defaultParams(): Parametres {
  return {
    forfaitPlafondCRN: 50000,
    remiseINF: { minModules: 3, pct: 10 },
    frais: { mode: 'absorbes', pct: 1.5 },
    certificatMedical: true,
    delaiPaiementMin: 5,
    reservationMin: 15,
  }
}

export function defaultSessions(now = new Date()): Session[] {
  return [
    {
      id: 'ses-crn', offre: 'CRN', intitule: 'Remise à niveau · Session de décembre 2026',
      debut: iso(plusDays(now, 30)), fin: iso(plusDays(now, 100)), limite: iso(plusDays(now, 21)), statut: 'ouverte',
    },
    {
      id: 'ses-spt', offre: 'SPT', intitule: 'VOGT Sport · Session d\'été 2027',
      debut: '2027-07-05', fin: '2027-08-27', limite: '2027-06-25', statut: 'ouverte',
    },
    {
      id: 'ses-inf', offre: 'INF', intitule: 'Formation en informatique · Promotion 2026-2027',
      debut: iso(plusDays(now, 18)), fin: iso(plusDays(now, 140)), limite: iso(plusDays(now, 12)), statut: 'ouverte',
    },
  ]
}

const ALL = CLASSES
const col4 = ['4e', '3e', '2nde A', '2nde C', '1ère A', '1ère C', '1ère D', '1ère TI', 'Tle A', 'Tle C', 'Tle D', 'Tle TI']
const sci = ['4e', '3e', '2nde A', '2nde C', '1ère C', '1ère D', '1ère TI', 'Tle C', 'Tle D', 'Tle TI']
const svt = ['6e', '5e', '4e', '3e', '2nde A', '2nde C', '1ère A', '1ère D', 'Tle A', 'Tle D']

export function defaultPrestations(): Prestation[] {
  const crn = (id: string, libelle: string, niveaux: string[], tarif = 12000, description?: string): Prestation => ({
    id, sessionId: 'ses-crn', type: 'matiere', libelle, tarif, places: 35, niveaux, description,
  })
  const spt = (id: string, libelle: string, categories: string[], tarif: number, extra: Partial<Prestation> = {}): Prestation => ({
    id, sessionId: 'ses-spt', type: 'activite', libelle, tarif, places: 20, categories, ...extra,
  })
  const inf = (p: Omit<Prestation, 'sessionId' | 'type' | 'places'> & { places?: number }): Prestation => ({
    sessionId: 'ses-inf', type: 'module', places: 24, ...p,
  })
  return [
    crn('crn-math', 'Mathématiques', ALL, 15000, 'Algèbre, géométrie, analyse selon la classe.'),
    crn('crn-fra', 'Français', ALL, 12000, 'Grammaire, expression écrite, littérature.'),
    crn('crn-ang', 'Anglais', ALL, 12000, 'Compréhension, expression, grammaire.'),
    crn('crn-pc', 'Physique-Chimie', sci, 15000, 'Cours et exercices d\'application.'),
    crn('crn-svt', 'SVT', svt, 12000, 'Sciences de la vie et de la Terre.'),
    crn('crn-hg', 'Histoire-Géographie', ALL, 12000),
    crn('crn-all', 'Allemand', col4.filter((c) => !c.includes('TI')), 12000),
    crn('crn-philo', 'Philosophie', ['Tle A', 'Tle C', 'Tle D', 'Tle TI'], 12000, 'Méthode de la dissertation et du commentaire.'),
    spt('spt-bask', 'Basketball', ['U9', 'U11', 'U13', 'U15', 'U17'], 15000, { description: 'Initiation, technique et match.' }),
    spt('spt-foot', 'Football', ['U7', 'U9', 'U11', 'U13', 'U15', 'U17'], 15000, { description: 'École de football, jeu à effectif réduit.' }),
    spt('spt-athl', 'Athlétisme', ['U9', 'U11', 'U13', 'U15', 'U17'], 12000, { description: 'Courses, sauts et lancers.' }),
    spt('spt-hand', 'Handball', ['U11', 'U13', 'U15', 'U17'], 12000),
    spt('spt-vol', 'Volleyball filles', ['U13', 'U15', 'U17'], 12000, { sexe: 'F', description: 'Activité réservée aux filles.' }),
    spt('spt-judo', 'Judo', ['U7', 'U9', 'U11', 'U13'], 18000, { description: 'Tenue demandée à la première séance.' }),
    inf({ id: 'inf-bur', code: 'INF-BUR', libelle: 'Bureautique', description: 'Word, Excel et PowerPoint pour le travail scolaire et professionnel.', tarif: 25000, duree: 40, creneau: 'LM-16', creneauLibelle: 'Lun. et mer. · 16 h – 18 h' }),
    inf({ id: 'inf-info', code: 'INF-GRA', libelle: 'Infographie', description: 'Canva, Photoshop, Illustrator et InDesign : affiches, logos, mise en page.', tarif: 45000, duree: 60, creneau: 'MJ-16', creneauLibelle: 'Mar. et jeu. · 16 h – 18 h' }),
    inf({ id: 'inf-web', code: 'INF-WEB', libelle: 'Création de sites web', description: 'HTML5 et CSS3 : construire un site responsive.', tarif: 35000, duree: 50, creneau: 'SA-08', creneauLibelle: 'Sam. · 8 h – 12 h' }),
    inf({ id: 'inf-js', code: 'INF-JS', libelle: 'JavaScript', description: 'Interactivité, formulaires, appels d\'API.', tarif: 35000, duree: 40, creneau: 'SA-13', creneauLibelle: 'Sam. · 13 h – 17 h', prerequis: 'inf-web' }),
    inf({ id: 'inf-py', code: 'INF-PYT', libelle: 'Algorithmique et Python', description: 'Raisonner, structurer, programmer.', tarif: 35000, duree: 50, creneau: 'MJ-18', creneauLibelle: 'Mar. et jeu. · 18 h – 20 h' }),
    inf({ id: 'inf-mnt', code: 'INF-MNT', libelle: 'Maintenance et réseaux', description: 'Diagnostic, installation, bases du réseau local.', tarif: 30000, duree: 30, creneau: 'LM-16', creneauLibelle: 'Lun. et mer. · 16 h – 18 h', places: 16 }),
  ]
}
