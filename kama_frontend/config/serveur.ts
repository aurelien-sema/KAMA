/**
 * Adresse du serveur intermédiaire de Kama (traduction, voix, reconnaissance des commandes ; dossier `backend/`,
 * contrat dans backend/contracts/openapi.json).
 *
 * Aucune clé ni secret ici : n'importe qui peut décompresser l'extension (sécurité). Le serveur garde les modèles.
 * Par défaut : le serveur hébergé de l'équipe (VPS, déployé par .github/workflows/ci.yml), utilisé par la version jury.
 * Serveur local (`backend/scripts/lancer_demo.ps1`) : `npm run build:local` (WXT_KAMA_API=http://127.0.0.1:8000).
 * wxt.config.ts lit la même variable pour l'autorisation réseau (il ne peut pas importer ce fichier).
 */
export const ADRESSE_PAR_DEFAUT = 'https://kama-project.duckdns.org';
export const URL_SERVEUR: string = (import.meta.env.WXT_KAMA_API as string | undefined) ?? ADRESSE_PAR_DEFAUT;

/** Délais maximaux avant de dire « pas de connexion » (millisecondes). */
// La voix de synthèse tourne sur processeur : une phrase longue peut prendre plus de 10 s sur une petite machine.
export const DELAIS = { traduction: 8000, voix: 45000, reconnaissance: 15000, capacites: 4000 } as const;

