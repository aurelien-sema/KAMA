/**
 * Textes par défaut de Kama (menu, boutons, badges, messages d'état) dans la langue choisie.
 *
 * Source : `content-data/kama_interface.json`, exporté dans `config/interface.json` par `python -m app.export_glossary`.
 * Ce sont des libellés d'interface, sans montant ni avertissement : ils s'affichent même tant qu'un locuteur ne les a pas validés
 * (statut « brouillon »). Les explications et les réponses avec montants n'y figurent que validées.
 * Ordre de recherche : phrase validée du glossaire, puis libellé d'interface, sinon le français.
 *
 * Ce fichier n'importe rien d'exécutable (tests sans navigateur).
 */
import { chercherGlossaire, cleGlossaire, type Glossaire } from './glossaire.ts';

export type EntreeInterface = { texte: string; statut: 'valide' | 'brouillon'; zone: string };
export type DonneesInterface = Record<string, Record<string, Record<string, EntreeInterface>> | string>;

export function chercherInterface(donnees: DonneesInterface, langue: string, fr: string): EntreeInterface | null {
  const parLangue = donnees.fr;
  if (typeof parLangue !== 'object' || parLangue === null) return null;
  return parLangue[langue]?.[cleGlossaire(fr)] ?? null;
}

const avertissements = new Set<string>();

function enDeveloppement() {
  return (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;
}

/** Nombre ou montant écrit dans un texte (« 3 », « 25 500 FCFA ») : jamais traduit. Les balises {x1} déjà là sont ignorées. */
const NOMBRE = /(?<![\w{])[-+−]?\d+(?:[\s  .,]\d+)*(?:[\s  ]?(?:FCFA|F CFA|XAF|CFA))?(?!\w)/g;
const CITATION = /«\s*([^«»]+?)\s*»/g;
const BALISE = /\{([xq])(\d+)\}/g;

function direct(glossaire: Glossaire, donnees: DonneesInterface, langue: string, fr: string) {
  return chercherGlossaire(glossaire, langue, fr) ?? chercherInterface(donnees, langue, fr)?.texte ?? null;
}

/**
 * Phrase modèle (même convention que lib/secours.ts) : « Appuie sur « Réessayer ». » est cherchée comme
 * « Appuie sur « {q1} ». », puis le libellé entre guillemets est traduit à part (ou gardé tel quel), et les nombres
 * remis caractère pour caractère.
 */
function parModele(glossaire: Glossaire, donnees: DonneesInterface, langue: string, fr: string): string | null {
  const citations: string[] = [];
  const nombres: string[] = [];
  const premierLibre = Math.max(0, ...[...fr.matchAll(/\{x(\d+)\}/g)].map((m) => Number(m[1])));
  let modele = fr.replace(CITATION, (_, c: string) => `« {q${citations.push(c)}} »`);
  modele = modele.replace(NOMBRE, (n) => `{x${premierLibre + nombres.push(n)}}`);
  if (modele === fr) return null;
  const traduit = direct(glossaire, donnees, langue, modele);
  if (!traduit) return null;
  return traduit.replace(BALISE, (balise, type: string, n: string) => {
    const i = Number(n);
    if (type === 'q') {
      const c = citations[i - 1];
      return c === undefined ? balise : (direct(glossaire, donnees, langue, c) ?? c);
    }
    return i > premierLibre ? (nombres[i - premierLibre - 1] ?? balise) : balise;
  });
}

/** Le texte à afficher : traduction validée, sinon libellé d'interface (ou sa phrase modèle), sinon le français tel quel. */
export function libelle(
  glossaire: Glossaire,
  donnees: DonneesInterface,
  langue: string | undefined,
  fr: string,
  options: { avertir?: boolean } = {},
): string {
  if (!langue) return fr;
  const traduction = direct(glossaire, donnees, langue, fr) ?? parModele(glossaire, donnees, langue, fr);
  if (!traduction && options.avertir && langue === 'wes' && enDeveloppement() && !avertissements.has(fr)) {
    avertissements.add(fr);
    console.warn(`[kama:fr] ${fr}`);
  }
  return traduction ?? fr;
}
