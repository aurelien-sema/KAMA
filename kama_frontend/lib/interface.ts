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

/** Le texte à afficher : traduction validée, sinon libellé d'interface, sinon le français tel quel. */
export function libelle(
  glossaire: Glossaire,
  donnees: DonneesInterface,
  langue: string | undefined,
  fr: string,
  options: { avertir?: boolean } = {},
): string {
  if (!langue) return fr;
  const traduction = chercherGlossaire(glossaire, langue, fr) ?? chercherInterface(donnees, langue, fr)?.texte;
  if (!traduction && options.avertir && langue === 'wes' && enDeveloppement() && !avertissements.has(fr)) {
    avertissements.add(fr);
    console.warn(`[kama:fr] ${fr}`);
  }
  return traduction ?? fr;
}
