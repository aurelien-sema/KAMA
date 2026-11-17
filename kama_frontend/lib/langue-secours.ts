/**
 * Langue de secours de CE navigateur (français ou anglais), calculée une fois au chargement.
 * Voir lib/secours.ts pour la règle et config/anglais.ts pour les textes.
 */
import type { Ligne } from '@/config/gabarits';
import { detecterLangueNavigateur, ligneVersSecours, versSecours } from './secours';

export const LANGUE_SECOURS = detecterLangueNavigateur();

/** Texte français de Kama → langue de secours (inchangé si le navigateur est en français). */
export const secours = (texte: string) => versSecours(texte, LANGUE_SECOURS);

/** Ligne de gabarit → langue de secours, montants de la page gardés tels quels. */
export const ligneSecours = (ligne: Ligne): Ligne => ligneVersSecours(ligne, LANGUE_SECOURS);
