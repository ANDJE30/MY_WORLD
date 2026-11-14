// Montants en toutes lettres (orthographe traditionnelle), pour les reçus.

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

function below100(n: number): string {
  if (n <= 16) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? TENS[t] : u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${below100(n - 60)}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${below100(n - 80)}`;
}

function below1000(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let out = '';
  if (h === 1) out = 'cent';
  else if (h > 1) out = `${UNITS[h]} cent${r === 0 && final ? 's' : ''}`;
  if (r > 0) {
    let rest = below100(r);
    if (!final && rest === 'quatre-vingts') rest = 'quatre-vingt';
    out = out ? `${out} ${rest}` : rest;
  }
  return out;
}

export function numberToWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const scales: [number, string, string][] = [
    [1_000_000_000, 'milliard', 'milliards'],
    [1_000_000, 'million', 'millions'],
  ];
  for (const [v, one, many] of scales) {
    if (n >= v) {
      const q = Math.floor(n / v);
      parts.push(`${below1000(q, true)} ${q > 1 ? many : one}`);
      n %= v;
    }
  }
  if (n >= 1000) {
    const q = Math.floor(n / 1000);
    parts.push(q === 1 ? 'mille' : `${below1000(q, false)} mille`);
    n %= 1000;
  }
  if (n > 0) parts.push(below1000(n, true));
  return parts.join(' ');
}

export function amountInWords(n: number): string {
  const w = numberToWords(n);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} francs CFA`;
}
