/**
 * Ce qu'il faut décrire pour qu'une banque soit connue de Kama : 1 banque = 1 fichier dans ce
 * dossier (`safinum.ts`, `demo.ts`…), inscrit dans `index.ts`. Le code de Kama ne change pas.
 *
 * La page d'une banque n'a en général aucun repère technique (pas d'id, pas d'attribut de test) :
 * comme le demande le protocole officiel, Kama reconnaît les éléments à partir de leur TEXTE.
 * Chaque libellé est donné dans toutes les langues de la page (ex. français et anglais).
 * La comparaison ignore les majuscules, les espaces en trop et un « : » final.
 *
 * Sur une banque sans fichier, Kama fonctionne quand même : il repère tout seul les montants,
 * les alertes et les nouveaux messages, et décrit l'écran (voir lib/lecture-page.ts).
 */

/**
 * Rôle d'un élément, commun à toutes les banques : les explications (config/gabarits.ts) sont
 * écrites par rôle, une seule fois. Chaque banque dit quels textes de SA page jouent ces rôles.
 */
export type IdElement =
  | 'solde'
  | 'montant-saisie'
  | 'montant'
  | 'frais'
  | 'total'
  | 'confirmer'
  | 'erreur'
  | 'transferer'
  | 'type-operation'
  | 'beneficiaire'
  | 'telephone'
  | 'case-verification'
  | 'case-confirmation'
  | 'continuer'
  | 'reference'
  | 'transactions';

export type DefinitionElement = {
  id: IdElement;
  /** Textes exacts du libellé dans la page (toutes les langues de la page). */
  libelles: string[];
  /**
   * - `montant` : un libellé suivi d'un montant (on lit le montant à côté) ;
   * - `bouton`  : un bouton (Kama ne clique jamais dessus) ;
   * - `champ`   : un champ que l'utilisateur remplit (on ne lit JAMAIS ce qu'il a saisi) ;
   * - `erreur`  : le bandeau d'erreur ou d'alerte de la banque ;
   * - `repere`  : un simple repère pour « Montre-moi ».
   */
  nature: 'montant' | 'bouton' | 'champ' | 'erreur' | 'repere';
  /** Pastille Kama à côté de l'élément : seulement les éléments importants. */
  pastille: boolean;
  /** Nom affiché dans « Élément choisi : … ». */
  nom: string;
};

/** « Expliquer cette page » : une explication par étape du parcours de la banque. */
export type EtapeExplication = { cible: IdElement; texte: string };
export type EtapeParcours = {
  id: string;
  /** Textes visibles qui montrent qu'on est à cette étape. La 1re étape trouvée l'emporte. */
  reperes: string[];
  phrase: string;
  etapes: EtapeExplication[];
};

/** Explication franche d'une erreur de la banque, sans minimiser. Aucun montant calculé. */
export type ExplicationErreur = { titre: string; conseil: string };

export type ConfigBanque = {
  id: string;
  nom: string;
  /** Adresses où Kama s'active pour cette banque (motifs d'extension : `https://site/chemin*`). */
  sites: string[];
  /** Vrai : page de démonstration locale, absente de la version livrée au jury. */
  demonstration?: boolean;
  elements: DefinitionElement[];
  etapes: EtapeParcours[];
  /** Explication par code d'erreur affiché par la banque (ex. `AMOUNT_002`). */
  erreurs: Record<string, ExplicationErreur | undefined>;
  /** Erreur sans code : reconnue par son message (ex. « Solde insuffisant » → `AMOUNT_002`). */
  erreursParMessage?: [RegExp, string][];
};

/** Erreur dont le code n'est pas connu : on ne devine pas, on renvoie au message de la banque. */
export const ERREUR_INCONNUE: ExplicationErreur = {
  titre: 'La banque a affiché un message important.',
  conseil: 'Lis le message de la banque ci-dessus. Kama ne le connaît pas encore.',
};

/** Banque sans fichier de configuration : Kama ne compte que sur ce qu'il repère tout seul. */
export const BANQUE_INCONNUE: ConfigBanque = {
  id: 'inconnue',
  nom: 'Banque inconnue',
  sites: [],
  elements: [],
  etapes: [],
  erreurs: {},
};
