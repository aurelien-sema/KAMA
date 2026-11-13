/**
 * Langue choisie, accessible par tous les composants (badge « traduction à fournir »,
 * en-tête de la fenêtre…) sans la passer de composant en composant.
 */
import { createContext, useContext } from 'react';
import type { Langue } from '@/config/langues';

export const LangueCourante = createContext<Langue | null>(null);

export function useLangueCourante() {
  return useContext(LangueCourante);
}

/**
 * Préférence « Audio » du popup : la réponse est lue automatiquement à l'ouverture.
 * Préférence « Texte » : la lecture démarre seulement quand l'utilisateur appuie sur ▶.
 */
export const LectureAuto = createContext(false);

export function useLectureAuto() {
  return useContext(LectureAuto);
}
