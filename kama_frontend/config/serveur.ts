/**
 * Adresse du serveur intermédiaire de Kama (traduction, voix, reconnaissance des commandes).
 *
 * Aucune clé ni secret ici : n'importe qui peut décompresser l'extension (sécurité). Le serveur garde les modèles.
 * En production l'adresse est en HTTPS : `WXT_KAMA_API=https://kama.exemple.com npm run build`.
 * Par défaut, le serveur local lancé par `python -m app` (développement et démonstration sur un seul ordinateur).
 */
export const ADRESSE_PAR_DEFAUT = 'http://127.0.0.1:8000';
export const URL_SERVEUR: string = (import.meta.env.WXT_KAMA_API as string | undefined) ?? ADRESSE_PAR_DEFAUT;

/** Délais maximaux avant de dire « pas de connexion » (millisecondes). */
export const DELAIS = { traduction: 8000, voix: 20000, reconnaissance: 15000, capacites: 4000 } as const;
