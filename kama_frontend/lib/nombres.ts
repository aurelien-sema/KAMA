/**
 * Lecture d'un montant à voix haute, sans modèle et sans serveur.
 *
 * Les montants ne quittent jamais l'extension (sécurité) : quand le serveur renvoie une balise {xN} à la place
 * d'un nombre, c'est ici que le montant devient une suite de mots. C'est la copie de `backend/app/numbers.py`,
 * vérifiée par `backend/contracts/numbers_vectors.json` (`npm test`).
 *
 * Une chaîne illisible rend `null` : Kama affiche le montant sans le lire, plutôt que de risquer un chiffre faux.
 */

const UNITES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const DIZAINES: Record<number, string> = { 2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty', 6: 'sixty', 7: 'seventy', 8: 'eighty', 9: 'ninety' };
const MONTANT = /^\s*([+\-−])?\s*(\d{1,3}(?:[   ,.]\d{3})*|\d+)(?:[.,](\d{1,2}))?\s*(FCFA|XAF|F CFA)?\s*$/;

function sousMille(n: number): string[] {
  const out: string[] = [];
  if (n >= 100) {
    out.push(UNITES[Math.floor(n / 100)]!, 'hundred');
    n %= 100;
  }
  if (n >= 20) {
    out.push(DIZAINES[Math.floor(n / 10)]!);
    n %= 10;
    if (n) out.push(UNITES[n]!);
  } else if (n || !out.length) {
    out.push(UNITES[n]!);
  }
  return out;
}

function direEntier(n: number): string[] {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000_000) throw new Error('nombre hors limites');
  if (n === 0) return ['zero'];
  const out: string[] = [];
  for (const [taille, mot] of [[1_000_000, 'million'], [1_000, 'thousand']] as const) {
    const partie = Math.floor(n / taille);
    n %= taille;
    if (partie) out.push(...sousMille(partie), mot);
  }
  if (n) out.push(...sousMille(n));
  return out;
}

/** '25 500 FCFA' → ['twenty', 'five', 'thousand', 'five', 'hundred', 'franc']. `null` si le montant est illisible. */
export function direMontant(texte: string): string[] | null {
  const m = MONTANT.exec(texte);
  if (!m) return null;
  const [, signe, entier, decimales, devise] = m;
  try {
    const out: string[] = signe === '-' || signe === '−' ? ['minus'] : [];
    out.push(...direEntier(parseInt(entier!.replace(/[   ,.]/g, ''), 10)));
    if (decimales) out.push('point', ...[...decimales].map((d) => UNITES[Number(d)]!));
    if (devise) out.push('franc');
    return out;
  } catch {
    return null;
  }
}
