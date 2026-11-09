/**
 * Pages sur lesquelles Kama s'active.
 * C'est le seul endroit à modifier si l'adresse du site de test change.
 * (Les sélecteurs des éléments de la page viendront dans ce même dossier `config/`.)
 */

/** Site de test des organisateurs du hackathon SAFINUM. */
export const SITES_BANCAIRES = [
  'https://safinum.cm/hackathon-test*',
  'https://www.safinum.cm/hackathon-test*',
];

/** Page fictive locale, pour les cas impossibles à provoquer sur le vrai site (option C). */
export const SITES_DEV = ['http://localhost/*', 'http://127.0.0.1/*'];

/** Tous les sites où Kama s'injecte. */
export const SITES_KAMA = [...SITES_BANCAIRES, ...SITES_DEV];

/**
 * Mêmes sites, réduits à leur origine (`https://safinum.cm/*`).
 * Chrome exige cette forme pour `web_accessible_resources` (le chemin doit être `/*`).
 */
export const ORIGINES_KAMA = [...new Set(SITES_KAMA.map((s) => `${new URL(s.replace('*', '')).origin}/*`))];
