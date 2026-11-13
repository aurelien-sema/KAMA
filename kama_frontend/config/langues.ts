/**
 * Langues proposées par Kama (décisions d'équipe du 2026-11-11 et du 2026-11-12).
 * Aucune langue par défaut, pas d'option « Français » : avant le choix, Kama parle la langue du navigateur.
 * Les langues disponibles d'abord, puis celles à venir ; ordre alphabétique dans chaque groupe.
 * `disponible: false` : affichée dans tous les choix de langue (« Bientôt »), mais pas encore activable.
 * `code` = code ISO 639-3 (le même que dans les dossiers d'évaluation de l'équipe).
 */
export const TOUTES_LES_LANGUES = [
  { id: 'ghomala', nom: "Ghomálá'", region: 'Ouest', code: 'bbj', disponible: true },
  { id: 'pidgin', nom: 'Pidgin', region: 'Nord-Ouest, Sud-Ouest', code: 'wes', disponible: true },
  { id: 'bamoun', nom: 'Bamoun', region: 'Ouest (Noun)', code: 'bax', disponible: false },
  { id: 'fulfulde', nom: 'Fulfulde', region: 'Nord, Adamaoua, Extrême-Nord', code: 'fub', disponible: false },
] as const;

/** Langues que l'on peut choisir aujourd'hui. */
export const LANGUES = TOUTES_LES_LANGUES.filter((l) => l.disponible) as Extract<
  (typeof TOUTES_LES_LANGUES)[number],
  { disponible: true }
>[];

/** Langues affichées « Bientôt », non activables. */
export const LANGUES_A_VENIR = TOUTES_LES_LANGUES.filter((l) => !l.disponible);

export type Langue = (typeof LANGUES)[number];
export type IdLangue = Langue['id'];

/** La langue choisie, seulement si elle est disponible (une langue « Bientôt » n'est jamais active). */
export function trouverLangue(id: string | null | undefined): Langue | null {
  return LANGUES.find((l) => l.id === id) ?? null;
}
