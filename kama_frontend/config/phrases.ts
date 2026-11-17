/**
 * Phrases fixes de la fenêtre Kama qui ne sont pas dans les gabarits (`gabarits.ts`) ni dans la configuration de la page
 * (`config/banques/`). Elles sont écrites ici UNE seule fois pour que le catalogue des phrases à faire valider par les locuteurs
 * (content-data/kama_fenetre.json) puisse être contrôlé automatiquement contre le code (`npm test`).
 *
 * Modifier une phrase ici = la phrase validée ne correspond plus : il faut la faire valider de nouveau.
 */
import type { Ligne } from './gabarits';

export const PHRASES = {
  pageNonReconnue: ['Kama ne reconnaît pas encore cette partie de la page.', "Touche une pastille Kama à côté d'un montant ou d'un bouton."],
  elementIntrouvable: 'Kama ne trouve plus cet élément sur la page.',
  pasDeTransactions: ["Cette page n'a pas tes transactions.", 'Va sur la première page : « Solde ».'],
  voix: {
    nonCompris: ["Je n'ai pas compris.", "Redis-le, s'il te plaît.", 'Réessayer'],
    indisponible: ['La voix ne marche pas encore pour cette langue.', "Touche une pastille Kama ou utilise le menu de l'onglet."],
    microRefuse: ["Kama n'a pas accès au micro.", "Autorise le micro dans le navigateur, puis réessaie. Tu peux aussi utiliser le menu de l'onglet.", 'Réessayer'],
    microAbsent: ['Aucun micro trouvé.', "Branche un micro, ou utilise le menu de l'onglet.", 'Réessayer'],
    horsLigne: ['Pas de connexion internet.', 'Kama ne peut pas comprendre ta voix pour le moment.', 'Réessayer'],
  },
} as const;

/** « Sur cette page : 3 entrées, 5 sorties. » : les nombres sont des valeurs de la page, recopiées telles quelles. */
export const bilanTransactions = (entrees: string, sorties: string): Ligne => [
  'Sur cette page : ',
  { montant: entrees },
  ' entrées, ',
  { montant: sorties },
  ' sorties.',
];

export const listeOperations = (nombre: string): Ligne => ['Les ', { montant: nombre }, ' dernières opérations :'];
