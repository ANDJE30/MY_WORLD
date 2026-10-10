const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

/** Nombre < 100 */
function below100(n: number, final: boolean): string {
  if (n < 20) return UNITS[n]
  if (n < 70) {
    const d = Math.floor(n / 10)
    const u = n % 10
    if (u === 0) return TENS[d]
    return `${TENS[d]}${u === 1 ? ' et un' : '-' + UNITS[u]}`
  }
  if (n < 80) {
    const u = n - 60
    return `soixante${u === 11 ? ' et onze' : '-' + UNITS[u]}`
  }
  if (n === 80) return final ? 'quatre-vingts' : 'quatre-vingt'
  return `quatre-vingt-${UNITS[n - 80]}`
}

/** Nombre < 1000. `final` : le nombre termine le mot (accord de « vingt » et « cent »). */
function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  let out = ''
  if (h === 1) out = 'cent'
  else if (h > 1) out = `${UNITS[h]} cent${r === 0 && final ? 's' : ''}`
  if (r === 0) return out
  const tail = below100(r, final)
  return out ? `${out} ${tail}` : tail
}

/** Montant entier en lettres, selon l'orthographe traditionnelle. */
export function numberToFrench(n: number): string {
  n = Math.round(n)
  if (n === 0) return 'zéro'
  if (n < 0) return `moins ${numberToFrench(-n)}`
  const parts: string[] = []
  const billions = Math.floor(n / 1_000_000_000)
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  if (billions) parts.push(`${numberToFrench(billions)} milliard${billions > 1 ? 's' : ''}`)
  if (millions) parts.push(`${numberToFrench(millions)} million${millions > 1 ? 's' : ''}`)
  // « mille » est toujours invariable ; « quatre-vingt » et « cent » ne prennent pas de s devant mille
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`)
  if (rest) parts.push(below1000(rest, true))
  return parts.join(' ')
}

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
/** 45 000 FCFA — espace insécable fine selon la locale. */
export function fcfa(n: number): string {
  return `${nf.format(Math.round(n)).replace(/[  ]/g, ' ')} FCFA`
}
export function nombre(n: number): string {
  return nf.format(Math.round(n)).replace(/[  ]/g, ' ')
}

export function phrase(n: number): string {
  const s = numberToFrench(n)
  return `Arrêtée la présente facture à la somme de ${s} francs CFA.`
}
