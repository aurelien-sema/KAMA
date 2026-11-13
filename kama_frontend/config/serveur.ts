/**
 * Adresse du serveur de Kama (dossier `backend/`, contrat dans backend/contracts/openapi.json).
 *
 * `null` = serveur pas encore en ligne : Kama fonctionne en MODE SIMULATION. La voix est bien
 * enregistrée et transmise au service worker, qui répond « simulation » au lieu d'appeler le
 * serveur. Quand le serveur sera hébergé, écrire ici son adresse HTTPS (sans « / » final) :
 * c'est le seul changement à faire côté extension, l'autorisation réseau en découle.
 */
export const SERVEUR_KAMA: string | null = null;

/** Au-delà, la demande est abandonnée et Kama propose « Réessayer ». */
export const DELAI_SERVEUR_MS = 15000;
