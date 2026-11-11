/**
 * `useTexte('Réessayer')` : le libellé dans la langue choisie, ou le français s'il n'existe pas.
 * Utilisé pour les textes par défaut de Kama (menu, boutons, badges, messages d'état) et les libellés de la page de test.
 */
import glossaire from '@/config/glossaire.json';
import interfaceJson from '@/config/interface.json';
import type { Glossaire } from './glossaire';
import { libelle, type DonneesInterface } from './interface';
import { useLangueCourante } from './langue-courante';

export function traduireLibelle(code: string | undefined, fr: string) {
  return libelle(glossaire as Glossaire, interfaceJson as unknown as DonneesInterface, code, fr);
}

export function useTexte(fr: string) {
  return traduireLibelle(useLangueCourante()?.code, fr);
}
