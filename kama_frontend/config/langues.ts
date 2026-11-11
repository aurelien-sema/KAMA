/**
 * Langues proposées par Kama (décision d'équipe du 2026-11-11).
 * Ordre alphabétique, aucune langue par défaut, pas d'option « Français ».
 * `code` = code ISO 639-3 (le même que dans les dossiers d'évaluation de l'équipe).
 */
export const LANGUES = [
  { id: 'ghomala', nom: "Ghomálá'", region: 'Ouest', code: 'bbj' },
  { id: 'pidgin', nom: 'Pidgin', region: 'Nord-Ouest, Sud-Ouest', code: 'wes' },
] as const;

export type Langue = (typeof LANGUES)[number];
export type IdLangue = Langue['id'];

export function trouverLangue(id: IdLangue | null | undefined): Langue | null {
  return LANGUES.find((l) => l.id === id) ?? null;
}
