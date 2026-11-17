/**
 * `useTexte('Réessayer')` : le libellé dans la langue choisie, sinon dans la langue du navigateur (français ou anglais).
 * Utilisé pour les textes par défaut de Kama (menu, boutons, badges, messages d'état) et les libellés de la page de test.
 */
import glossaire from '@/config/glossaire.json';
import interfaceJson from '@/config/interface.json';
import type { Glossaire } from './glossaire';
import { libelle, type DonneesInterface } from './interface';
import { useLangueCourante } from './langue-courante';
import { secours } from './langue-secours';

/**
 * Le texte dans la langue choisie ; s'il n'y est pas encore (ou si aucune langue n'est choisie), dans la langue
 * de secours du navigateur, français ou anglais (lib/secours.ts).
 */
export function traduireLibelle(code: string | undefined, fr: string, avertir = false) {
  const t = libelle(glossaire as Glossaire, interfaceJson as unknown as DonneesInterface, code, fr, { avertir });
  return t === fr ? secours(fr) : t;
}

/** Texte fixe de Kama (hors libellé de la banque) : signale en développement s'il n'a pas de traduction. */
export function traduireKama(code: string | undefined, fr: string) {
  return traduireLibelle(code, fr, true);
}

export function useTexte(fr: string) {
  return traduireKama(useLangueCourante()?.code, fr);
}
