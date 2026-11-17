/**
 * Ligne de gabarit → texte masqué. Ce fichier n'importe rien d'exécutable : il se teste sans navigateur.
 */
import type { Ligne } from '../config/gabarits';

/** Texte masqué d'une ligne de gabarit : chaque montant devient {xN}, de gauche à droite. */
export function masquerLigne(ligne: Ligne) {
  const valeurs: Record<string, string> = {};
  let n = 0;
  const texte = ligne
    .map((m) => {
      if (typeof m === 'string') return m;
      n += 1;
      valeurs[`x${n}`] = m.montant;
      return `{x${n}}`;
    })
    .join('');
  return { texte, valeurs };
}
