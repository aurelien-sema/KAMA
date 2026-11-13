/**
 * Pages sur lesquelles Kama s'active : les adresses de toutes les banques connues
 * (config/banques/). Pour ajouter une banque, on ajoute son fichier là-bas, pas ici.
 */
import { BANQUES, VERSION_JURY } from './banques';

/** Adresses des banques connues. */
export const SITES_BANCAIRES = BANQUES.flatMap((b) => b.sites);

/**
 * Pages locales de l'équipe (banque de démonstration, essais). Absentes de la version jury :
 * le jury n'a que la page de test des organisateurs.
 */
export const SITES_DEV = VERSION_JURY ? [] : ['http://localhost/*', 'http://127.0.0.1/*'];

/** Tous les sites où Kama s'injecte. */
export const SITES_KAMA = [...new Set([...SITES_BANCAIRES, ...SITES_DEV])];

/**
 * Mêmes sites, réduits à leur origine (`https://safinum.cm/*`).
 * Chrome exige cette forme pour `web_accessible_resources` (le chemin doit être `/*`).
 */
export const ORIGINES_KAMA = [...new Set(SITES_KAMA.map((s) => `${new URL(s.replace('*', '')).origin}/*`))];
