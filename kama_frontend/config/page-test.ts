/**
 * CONFIGURATION DE LA PAGE DE TEST (https://safinum.cm/hackathon-test).
 * C'est le seul fichier à modifier si la page des organisateurs change.
 *
 * La page ne fournit aucun repère technique (pas d'id, pas d'attribut de test) : comme le
 * demande le protocole officiel, Kama reconnaît les éléments à partir de leur TEXTE.
 * Chaque libellé est donné en français et en anglais (bouton « EN » de la page).
 * La comparaison ignore les majuscules, les espaces en trop et un « : » final.
 *
 * Les textes d'explication sont des gabarits en français : les montants y sont insérés tels
 * qu'ils sont lus dans la page (règle d'or n° 1). Ils seront remplacés par les textes validés
 * en ghomálá' et en pidgin (règle d'or n° 4) ; en attendant, badge « Pas encore traduit ».
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
  /** Textes exacts du libellé dans la page (FR puis EN). */
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

export const ELEMENTS: DefinitionElement[] = [
  // Éléments importants : ils ont une pastille.
  { id: 'solde', libelles: ['Solde disponible', 'Available balance'], nature: 'montant', pastille: true, nom: 'Solde disponible' },
  { id: 'montant-saisie', libelles: ['Montant à envoyer', 'Amount to send'], nature: 'champ', pastille: true, nom: 'Montant à envoyer' },
  { id: 'montant', libelles: ['Montant', 'Amount'], nature: 'montant', pastille: true, nom: 'Montant' },
  { id: 'frais', libelles: ['Frais', 'Fee', 'Fees'], nature: 'montant', pastille: true, nom: 'Frais' },
  { id: 'total', libelles: ['Total à débiter', 'Total débité', 'Total to debit', 'Total debited'], nature: 'montant', pastille: true, nom: 'Total débité' },
  { id: 'confirmer', libelles: ['Confirmer le transfert', 'Confirm transfer'], nature: 'bouton', pastille: true, nom: 'Bouton « Confirmer le transfert »' },
  {
    id: 'erreur',
    libelles: ['Une erreur est survenue', 'Alerte de sécurité', 'Message important', 'An error occurred', 'Security warning', 'Important message'],
    nature: 'erreur',
    pastille: true,
    nom: 'Message de la banque',
  },

  // Repères pour « Montre-moi » (sans pastille).
  { id: 'transferer', libelles: ['Effectuer un transfert', 'Make a transfer'], nature: 'bouton', pastille: false, nom: 'Bouton « Effectuer un transfert »' },
  { id: 'type-operation', libelles: ["Type d'opération", 'Operation type'], nature: 'champ', pastille: false, nom: "Type d'opération" },
  { id: 'beneficiaire', libelles: ['Nom du bénéficiaire', 'Beneficiary name'], nature: 'champ', pastille: false, nom: 'Nom du bénéficiaire' },
  { id: 'telephone', libelles: ['Numéro de téléphone', 'Phone number'], nature: 'champ', pastille: false, nom: 'Numéro de téléphone' },
  {
    id: 'case-verification',
    libelles: ["J'ai vérifié le nom et le numéro du bénéficiaire.", 'I have verified the beneficiary name and phone number.'],
    nature: 'champ',
    pastille: false,
    nom: 'Case de vérification',
  },
  {
    id: 'case-confirmation',
    libelles: ['Je confirme que les informations ci-dessus sont correctes.', 'I confirm the information above is correct.'],
    nature: 'champ',
    pastille: false,
    nom: 'Case de confirmation',
  },
  { id: 'continuer', libelles: ['Continuer', 'Continue'], nature: 'bouton', pastille: false, nom: 'Bouton « Continuer »' },
  { id: 'reference', libelles: ['Référence', 'Reference'], nature: 'repere', pastille: false, nom: 'Référence' },
  { id: 'transactions', libelles: ['Transactions récentes', 'Recent transactions'], nature: 'repere', pastille: false, nom: 'Transactions récentes' },
];

/* ------------------------------------------------------------------------------------------ */
/* « Expliquer cette page » : une explication par étape du parcours.                          */
/* L'étape est reconnue par un texte visible (`reperes`). L'ordre compte : la première         */
/* étape dont un repère est visible l'emporte.                                                 */
/* ------------------------------------------------------------------------------------------ */

export type EtapeExplication = { cible: IdElement; texte: string };
export type EtapeParcours = { id: string; reperes: string[]; phrase: string; etapes: EtapeExplication[] };

export const ETAPES_PARCOURS: EtapeParcours[] = [
  {
    id: 'confirmation',
    reperes: ['Transfert effectué', 'Transfer completed'],
    phrase: 'Ton transfert est parti.',
    etapes: [
      { cible: 'total', texte: "Regarde le total qui est sorti de ton compte." },
      { cible: 'reference', texte: 'Garde la référence : elle prouve ton transfert.' },
    ],
  },
  {
    id: 'recapitulatif',
    reperes: ['Confirmer le transfert', 'Confirm transfer'],
    phrase: "Ici, tu vérifies tout avant d'envoyer l'argent.",
    etapes: [
      { cible: 'montant', texte: 'Vérifie le montant.' },
      { cible: 'frais', texte: 'Vérifie les frais.' },
      { cible: 'total', texte: 'Vérifie le total qui va sortir de ton compte.' },
      { cible: 'case-confirmation', texte: 'Coche la case si tout est juste.' },
      { cible: 'confirmer', texte: 'Appuie toi-même sur « Confirmer le transfert ».' },
    ],
  },
  {
    id: 'beneficiaire',
    reperes: ['Nom du bénéficiaire', 'Beneficiary name'],
    phrase: "Ici, tu dis à qui tu envoies l'argent.",
    etapes: [
      { cible: 'beneficiaire', texte: 'Écris le nom de la personne.' },
      { cible: 'telephone', texte: 'Écris son numéro. Vérifie-le bien.' },
      { cible: 'case-verification', texte: 'Coche la case quand tu as tout vérifié.' },
      { cible: 'continuer', texte: 'Appuie toi-même sur « Continuer ».' },
    ],
  },
  {
    id: 'frais',
    reperes: ['Frais de transfert', 'Transfer fees'],
    phrase: "Ici, tu choisis comment envoyer l'argent, et combien.",
    etapes: [
      { cible: 'type-operation', texte: "Choisis le type d'envoi." },
      { cible: 'montant-saisie', texte: 'Écris le montant à envoyer.' },
      { cible: 'frais', texte: 'Regarde les frais.' },
      { cible: 'total', texte: 'Regarde le total qui va sortir de ton compte.' },
      { cible: 'continuer', texte: 'Appuie toi-même sur « Continuer ».' },
    ],
  },
  {
    id: 'accueil',
    reperes: ['Effectuer un transfert', 'Make a transfer'],
    phrase: "Ici, tu vois l'argent qui est sur ton compte.",
    etapes: [
      { cible: 'solde', texte: "Regarde ton solde : c'est l'argent que tu as." },
      { cible: 'transactions', texte: 'Regarde tes dernières opérations.' },
      { cible: 'transferer', texte: "Pour envoyer de l'argent, appuie toi-même sur « Effectuer un transfert »." },
    ],
  },
];

/* ------------------------------------------------------------------------------------------ */
/* Erreurs et alertes de la banque : 7 codes trouvés dans le code public de la page.          */
/* Explication franche, sans minimiser (CLARIFICATIONS.md, état « Erreur bancaire »).          */
/* Kama ne calcule aucun montant (décision d'Omar, 2026-11-11).                              */
/* ------------------------------------------------------------------------------------------ */

export type ExplicationErreur = { titre: string; conseil: string };

export const ERREURS: Record<string, ExplicationErreur | undefined> = {
  AMOUNT_001: {
    titre: "Le montant n'est pas bon.",
    conseil: "Écris un montant plus grand que zéro, puis appuie toi-même sur « Continuer ».",
  },
  AMOUNT_002: {
    titre: "Tu n'as pas assez d'argent pour ce transfert.",
    conseil: 'Envoie un montant plus petit, ou mets de l’argent sur ton compte avant.',
  },
  BENEFICIARY_001: {
    titre: 'Il manque le nom ou le numéro de la personne.',
    conseil: 'Écris le nom et le numéro de la personne qui reçoit l’argent.',
  },
  SECURITY_001: {
    titre: 'Attention : vérifie le numéro de la personne.',
    conseil: "Si tu n'es pas sûr du numéro, n'envoie pas l'argent. Demande d'abord à la personne.",
  },
  SECURITY_002: {
    titre: "Attention : tu n'as jamais envoyé d'argent à cette personne.",
    conseil: "Vérifie bien le nom et le numéro. Si tu as un doute, n'envoie pas l'argent.",
  },
  NETWORK_001: {
    titre: 'La banque ne répond pas pour le moment.',
    conseil: 'La banque demande de réessayer. Attends un peu, puis réessaie toi-même.',
  },
  CONFIRM_001: {
    titre: "Tu n'as pas coché la case de confirmation.",
    conseil: 'Vérifie les informations, coche la case, puis appuie toi-même sur « Confirmer le transfert ».',
  },
};

/** Erreur dont le code n'est pas connu : on ne devine pas, on renvoie au message de la banque. */
export const ERREUR_INCONNUE: ExplicationErreur = {
  titre: 'La banque a affiché un message important.',
  conseil: 'Lis le message de la banque ci-dessus. Kama ne le connaît pas encore.',
};
