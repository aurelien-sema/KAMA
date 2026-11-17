/**
 * Langue de secours de Kama : celle du NAVIGATEUR, français ou anglais (décision d'Omar du 2026-11-12).
 *
 *  - Avant le choix d'une langue nationale, tout Kama s'affiche dans cette langue.
 *  - Après le choix, ce qui n'est pas encore traduit en ghomálá' ou en pidgin reste dans cette langue
 *    (avec le badge « Pas encore traduit »).
 *  - Navigateur ni en français ni en anglais : anglais.
 *
 * Le code de Kama est écrit en français ; l'anglais vient du dictionnaire `config/anglais.ts`, phrase par phrase.
 * Les montants et les textes entre « » sont mis de côté avant la recherche puis remis tels quels :
 * l'anglais ne touche jamais un montant (règle d'or n° 1). Une phrase absente du dictionnaire reste en français.
 *
 * Ce fichier n'importe rien d'exécutable lié au navigateur : il se teste sans navigateur (tests/secours.test.mjs).
 */
import { ANGLAIS } from '../config/anglais.ts';
import { cleGlossaire } from './glossaire.ts';

export type LangueSecours = 'fr' | 'en';

/** Langue de l'interface du navigateur (Chrome, Edge) : `fr` si elle commence par « fr », sinon `en`. */
export function detecterLangueNavigateur(): LangueSecours {
  let langue = '';
  try {
    langue = (globalThis as { chrome?: { i18n?: { getUILanguage?: () => string } } }).chrome?.i18n?.getUILanguage?.() ?? '';
  } catch {
    // Pas d'API d'extension (tests) : on regarde le navigateur.
  }
  if (!langue && typeof navigator !== 'undefined') langue = navigator.language ?? '';
  return /^fr\b/i.test(langue) ? 'fr' : 'en';
}

const INDEX = new Map(Object.entries(ANGLAIS).map(([fr, en]) => [cleGlossaire(fr), en]));

/** Montant écrit dans un texte (« 25 500 FCFA », « -4.000 XAF », « 3 ») : jamais traduit. Les balises {x1} sont ignorées. */
const MONTANT = /(?<![\w{])[-+−]?\d+(?:[\s  .,]\d+)*(?:[\s  ]?(?:FCFA|F CFA|XAF|CFA))?(?!\w)/g;
const CITATION = /«\s*([^«»]+?)\s*»/g;
const BALISE = /\{([xq])(\d+)\}/g;
const LIBELLE_MONTANT = /^(.+?)\s*:\s*(\{x\d+\})\s*\.?$/;

const absents = new Set<string>();
function signalerAbsent(cle: string) {
  if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV !== true || absents.has(cle)) return;
  absents.add(cle);
  console.warn(`[kama:en] ${cle}`);
}

/** Une phrase : citations et montants mis de côté, recherche, puis remise en place. */
function traduirePhrase(phrase: string): string {
  const citations: string[] = [];
  const montants: string[] = [];
  const premierLibre = Math.max(0, ...[...phrase.matchAll(/\{x(\d+)\}/g)].map((m) => Number(m[1])));
  let masque = phrase.replace(CITATION, (_, c: string) => `« {q${citations.push(c)}} »`);
  masque = masque.replace(MONTANT, (m) => `{x${premierLibre + montants.push(m)}}`);

  let anglais = INDEX.get(cleGlossaire(masque));
  if (anglais === undefined) {
    // « Libellé : montant. » : seul le libellé se traduit (« Frais : 500 FCFA. » → « Fees: 500 FCFA. »).
    const m = masque.match(LIBELLE_MONTANT);
    const libelle = m && INDEX.get(cleGlossaire(m[1]!));
    if (m && libelle) anglais = `${libelle}: ${m[2]}.`;
  }
  if (anglais === undefined) {
    if (/[a-zà-ÿ]{2}/i.test(masque)) signalerAbsent(masque);
    return phrase;
  }
  return anglais.replace(BALISE, (balise, type: string, n: string) => {
    const i = Number(n);
    if (type === 'q') {
      const c = citations[i - 1];
      return c === undefined ? balise : (INDEX.get(cleGlossaire(c)) ?? c);
    }
    return i > premierLibre ? (montants[i - premierLibre - 1] ?? balise) : balise;
  });
}

/**
 * Texte français → langue de secours. En français : inchangé. En anglais : le texte entier, sinon phrase par phrase.
 * Les balises {xN} déjà présentes (montants d'un gabarit) sont gardées telles quelles.
 */
export function versSecours(texte: string, langue: LangueSecours): string {
  if (langue === 'fr' || !texte.trim()) return texte;
  const entier = traduirePhrase(texte);
  if (entier !== texte) return entier;
  const phrases = texte.split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ü«{0-9])/);
  if (phrases.length < 2) return texte;
  return phrases.map(traduirePhrase).join(' ');
}

type Morceau = string | { montant: string };

/** Ligne de gabarit (texte + montants de la page) → langue de secours. Les montants restent ceux de la page. */
export function ligneVersSecours(ligne: Morceau[], langue: LangueSecours): Morceau[] {
  if (langue === 'fr') return ligne;
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
  const anglais = versSecours(texte, langue);
  if (anglais === texte) return ligne;
  return anglais
    .split(/(\{x\d+\})/)
    .filter(Boolean)
    .map((morceau) => {
      const balise = morceau.match(/^\{(x\d+)\}$/);
      return balise && valeurs[balise[1]!] !== undefined ? { montant: valeurs[balise[1]!]! } : morceau;
    });
}
