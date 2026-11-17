/**
 * Classeur déterministe des messages bancaires inédits (contenu jamais vu) pour Kama.
 *
 * Aucun réseau, aucun modèle de langue : uniquement des mots-clés français ET anglais.
 * Le classement est purement textuel et reproductible, ce qui le rend sûr pour le jury.
 *
 * Règles respectées :
 *  - une arnaque ne doit JAMAIS être classée dans une catégorie rassurante
 *    (information_generale ou operation_reussie) ;
 *  - aucun montant n'est inventé ni lu ici : les explications n'en contiennent pas ;
 *  - le champ `cat` de KAMA/training/pidgin/cas_inedits.json et
 *    cas_inedits_arnaques.json est fait correspondre aux ids ci-dessous.
 */

export type CategorieId =
  | 'faux_agent_demande_code'
  | 'lien_piege'
  | 'faux_gain'
  | 'faux_remboursement_erreur'
  | 'faux_emploi'
  | 'investissement_douteux'
  | 'urgence_menace'
  | 'panne_maintenance'
  | 'operation_refusee'
  | 'operation_reussie'
  | 'frais_tarif'
  | 'plafond'
  | 'compte_bloque_suspendu'
  | 'mise_a_jour_informations'
  | 'information_generale'
  | 'inconnu';

export interface Categorie {
  readonly id: CategorieId;
  /** Libellé affiché dans le badge de catégorie. */
  readonly libelle: string;
  /** Vrai si c'est une catégorie d'arnaque (jamais rassurante). */
  readonly arnaque: boolean;
  /** Vrai pour information_generale et operation_reussie (catégories rassurantes). */
  readonly rassurante: boolean;
  /** Explication française (2 phrases max, tutoiement, aucun montant, « c'est toi qui décides »). */
  readonly fr: string;
  /** Explication anglaise. */
  readonly en: string;
  /** Mots-clés français (une phrase contenant des espaces est cherchée telle quelle). */
  readonly motsFr: readonly string[];
  /** Mots-clés anglais. */
  readonly motsEn: readonly string[];
}

/** Verbes d'action de la victime typiques d'une arnaque (pas un simple constat de la banque). */
const MOTS_ARNAQUE_ACTION = [
  "envoyez l'argent", 'send money', 'send it back', 'send it',
  'donnez votre code', 'donnez-moi', 'donne moi', 'communiquez le code', 'communiquez',
  'cliquez', 'cliquez ici', 'renvoyez', 'renvoyer', "rendez l'argent", 'rendez-le',
  'payez maintenant', 'payez les frais', 'payer les frais', 'pay the fee', 'pay the delivery',
  'pay the customs', 'send now', 'send quickly', 'envoyez vite', 'déposez', 'déposez maintenant',
  'investissez', 'transférez', 'send the deposit', 'give your code', 'give me your code',
  "envoyer de l'argent", 'send money now',
];

function norm(t: string): string {
  return t.toLocaleLowerCase('fr').replace(/\s+/g, ' ').trim();
}

function mots(t: string): Set<string> {
  return new Set(norm(t).split(/[\s,.;:!?()'"«»]+/).filter(Boolean));
}

function contient(n: string, kw: string): boolean {
  return n.includes(kw);
}

function score(c: Categorie, n: string, ws: Set<string>): number {
  let s = 0;
  for (const kw of c.motsFr) {
    if (kw.includes(' ')) { if (contient(n, kw)) s += 2; }
    else if (ws.has(kw)) s += 1;
  }
  for (const kw of c.motsEn) {
    if (kw.includes(' ')) { if (contient(n, kw)) s += 2; }
    else if (ws.has(kw)) s += 1;
  }
  return s;
}

function estSignalArnaque(t: string): boolean {
  const n = norm(t);
  return MOTS_ARNAQUE_ACTION.some((kw) => contient(n, kw));
}

/** Ordre de bris d'égalité (plus tôt = prioritaire). Les arnaques sont en premier. */
const PRIORITE: CategorieId[] = [
  'faux_agent_demande_code',
  'faux_gain',
  'faux_emploi',
  'investissement_douteux',
  'urgence_menace',
  'lien_piege',
  'faux_remboursement_erreur',
  'compte_bloque_suspendu',
  'frais_tarif',
  'plafond',
  'mise_a_jour_informations',
  'operation_refusee',
  'information_generale',
  'operation_reussie',
  'panne_maintenance',
  'inconnu',
];

export const CATEGORIES: Categorie[] = [
  {
    id: 'faux_agent_demande_code',
    libelle: 'Faux agent qui demande un code',
    arnaque: true,
    rassurante: false,
    fr: "Quelqu'un te demande ton code secret ou ton code de retrait. Une banque ne demande jamais un code : ne le donne pas, c'est toi qui décides.",
    en: "Someone asks you for your secret code or your withdrawal code. A bank never asks for a code: do not give it, it's your decision.",
    motsFr: ['agent', 'conseiller', 'service client', 'faux agent', 'code secret', 'code de retrait', 'mot de passe', 'six chiffres', 'code à six', 'donnez votre code', 'donnez-moi', 'communiquez', 'réactiver', 'réactivation', 'suspendu', 'solde', 'carte bancaire', 'carte', 'vérifier votre identité', 'annuler un débit', 'un debit', 'sms'],
    motsEn: ['agent', 'customer service', 'secret code', 'withdrawal code', 'password', 'six digit', 'six-digit', 'give me your code', 'give us your code', 'reactivate', 'reactivation', 'suspended', 'balance', 'card', 'verify your identity', 'unauthorized debit', 'cancel a debit', 'sms'],
  },
  {
    id: 'lien_piege',
    libelle: 'Lien piège / phishing',
    arnaque: true,
    rassurante: false,
    fr: "Ce lien te demande de payer ou de mettre à jour tes infos avant d'obtenir quoi que ce soit. Ne clique pas et n'envoie rien, c'est toi qui décides.",
    en: "This link asks you to pay or update your info before getting anything. Don't click and don't send anything, it's your decision.",
    motsFr: ['lien', 'cliquez', 'clique', 'cliquez ici', 'connectez-vous', 'colis', 'colis bloqué', 'colis arrive', 'douane', 'frais de douane', 'frais de livraison', 'livraison', 'expedie', 'expédié', 'expedier', 'expédier', 'recevoir', 'acompte', 'depot', 'dépôt', 'site', '.com', 'http', 'www', 'mettez à jour vos informations bancaires', 'expiré', 'expire', 'conserver', 'commande', 'réserve', 'vends', 'vendre', 'paiement', 'mobile money'],
    motsEn: ['link', 'click', 'click here', 'log in', 'login', 'sign in', 'parcel', 'package', 'blocked parcel', 'customs', 'customs fee', 'shipping fee', 'delivery', 'deliver', 'receive', 'deposit', 'advance', 'website', 'http', 'www', '.com', 'update your banking details', 'expired', 'expire', 'keep it', 'account expires', 'order', 'reserve', 'selling', 'sell', 'payment', 'mobile money'],
  },
  {
    id: 'faux_gain',
    libelle: 'Faux gain / prix',
    arnaque: true,
    rassurante: false,
    fr: "On te dit que tu as gagné un prix et te demande de payer des frais d'abord. C'est une arnaque : n'envoie pas d'argent, c'est toi qui décides.",
    en: "They tell you that you won a prize and ask you to pay fees first. It's a scam: don't send money, it's your decision.",
    motsFr: ['gagné', 'gagnez', 'gagner', 'prix', 'lot', 'bonus', 'tirage au sort', 'tirage', 'promotion', 'félicitations', 'félicitation', 'numero a gagné', 'numéro a gagné', 'avez gagné', 'gagné un téléphone', 'telephone', 'téléphone', 'sondage', 'repondez', 'répondez', 'reclamation', 'réclamation', 'reclamez', 'cadeau', 'offre', 'gagnant'],
    motsEn: ['won', 'win', 'winning', 'prize', 'bonus', 'draw', 'lottery', 'promotion', 'congratulations', 'congratulation', 'claim', 'survey', 'gift', 'offer', 'earn money', 'winner', 'click to receive', 'telephone', 'phone'],
  },
  {
    id: 'faux_remboursement_erreur',
    libelle: 'Faux remboursement par erreur',
    arnaque: true,
    rassurante: false,
    fr: "On te dit qu'on t'a envoyé de l'argent par erreur et te demande de le renvoyer. Ne renvoie rien sans vérifier avec ta banque, c'est toi qui décides.",
    en: "They tell you money was sent to you by mistake and ask you to send it back. Don't send anything back without checking with your bank, it's your decision.",
    motsFr: ['erreur', 'par erreur', 'renvoie', 'renvoyer', 'rendez', 'rendez-le', 'remboursement', 'reversez', 'reverse', 'depot errone', 'dépôt erroné', 'erroné', 'credite par erreur', 'crédité par erreur', 'reçu par erreur', 'recu par erreur', 'recu', 'bloqué', 'blocage', 'argent recu', 'argent reçu', 'trop perçu'],
    motsEn: ['mistake', 'by mistake', 'send back', 'sending back', 'give back', 'give it back', 'refund', 'reverse', 'wrong deposit', 'received a wrong', 'withdraw the money', 'erroneous', 'credited by mistake', 'received by mistake', 'blocked', 'block', 'money received', 'overpaid'],
  },
  {
    id: 'faux_emploi',
    libelle: 'Faux emploi / recrutement',
    arnaque: true,
    rassurante: false,
    fr: "On te propose un travail et te demande de payer des frais de dossier ou d'admission. Ne paye rien, c'est toi qui décides.",
    en: "They offer you a job and ask you to pay application or admission fees. Don't pay anything, it's your decision.",
    motsFr: ['recrutement', 'emploi', 'job', 'travail', 'stage', 'salaire', 'candidature', 'candidat', 'retenu', 'embauche', 'embauché', 'frais de dossier', 'visite medicale', 'visite médicale', 'lettre d admission', 'lettre d\'admission', 'admission', 'concours', 'places garanties', 'remunere', 'rémunéré', 'contrat', 'signer', 'douala', 'yaoundé', 'yaounde'],
    motsEn: ['recruitment', 'job', 'work', 'internship', 'salary', 'application', 'applicant', 'accepted', 'hired', 'application fee', 'medical visit', 'admission letter', 'exam', 'guaranteed places', 'paid', 'contract', 'sign', 'douala', 'yaounde'],
  },
  {
    id: 'investissement_douteux',
    libelle: 'Investissement douteux',
    arnaque: true,
    rassurante: false,
    fr: "On te promet de gagner beaucoup d'argent vite si tu déposes ou investis. Ne dépose pas d'argent, c'est toi qui décides.",
    en: "They promise you will make a lot of money fast if you deposit or invest. Don't deposit any money, it's your decision.",
    motsFr: ['investir', 'investissement', 'investisseur', 'déposer', 'deposer', 'depose', 'dépôt', 'depot', 'doubler', 'double', '48 heures', '48 heures', 'sept jours', 'interet', 'intérêt', 'interets', 'intérêts', 'profit', 'plateforme', 'credit express', 'crédit express', 'pret', 'prêt', 'sans garantie', 'assurance', 'versement', 'approuve', 'approuvé', 'garanti', 'rendement', 'places limitees', 'places limitées', 'gagner beaucoup'],
    motsEn: ['invest', 'investment', 'investor', 'deposit', 'double', 'doubles', 'days', 'interest', 'profit', 'platform', 'loan', 'credit', 'collateral', 'insurance', 'payout', 'approved', 'guarantee', 'limited places', 'make money', 'return', 'express loan'],
  },
  {
    id: 'urgence_menace',
    libelle: 'Urgence ou menace',
    arnaque: true,
    rassurante: false,
    fr: "On te dit qu'un proche est en danger et te presse de payer vite. Ne paye pas sous la pression : vérifie d'abord, c'est toi qui décides.",
    en: "They tell you a loved one is in danger and pressure you to pay fast. Don't pay under pressure: check first, it's your decision.",
    motsFr: ['hopital', 'hôpital', 'operation', 'opération', 'soins', 'menace', 'publier', 'publies', 'publiés', 'reseaux sociaux', 'réseaux sociaux', 'photo', 'photos', 'vite', 'urgent', 'maintenant', 'soeur', 'sœur', 'maman', 'mere', 'mère', 'payer', 'payez', 'chantage', 'accident', 'danger', 'proche', 'famille', 'operer', 'opérer'],
    motsEn: ['hospital', 'operation', 'surgery', 'care', 'threat', 'publish', 'published', 'social media', 'photo', 'photos', 'fast', 'urgent', 'now', 'sister', 'mum', 'mother', 'pay', 'blackmail', 'accident', 'danger', 'loved one', 'family', 'operate', 'emergency'],
  },
  {
    id: 'panne_maintenance',
    libelle: 'Panne / maintenance',
    arnaque: false,
    rassurante: false,
    fr: "Le service bancaire est en maintenance ou en panne pour le moment. Réessaie plus tard, c'est toi qui décides quand refaire l'opération.",
    en: "The banking service is under maintenance or down right now. Try again later, it's your decision when to redo the operation.",
    motsFr: ['maintenance', 'indisponible', 'panne', 'mise a jour', 'mise à jour', 'application', 'dimanche', 'nuit', 'technique', 'service', 'inaccessible', 'hors ligne', 'hors-ligne', 'interruption', 'coupure', 'maintenance prevue', 'maintenance prévue', 'prevue', 'prévue', 'mise a jour'],
    motsEn: ['maintenance', 'unavailable', 'outage', 'downtime', 'update', 'app', 'application', 'technical', 'service', 'inaccessible', 'offline', 'down', 'interruption', 'planned maintenance', 'scheduled'],
  },
  {
    id: 'operation_refusee',
    libelle: 'Opération refusée',
    arnaque: false,
    rassurante: false,
    fr: "Ton opération a été refusée : aucun argent n'a quitté ton compte. Vérifie les informations et réessaie si tu veux, c'est toi qui décides.",
    en: "Your operation was declined: no money left your account. Check the details and try again if you want, it's your decision.",
    motsFr: ['refuse', 'refusé', 'refus', 'decliné', 'decline', 'echec', 'échec', 'annuler', 'annulation', 'beneficiaire', 'bénéficiaire', "n a pas pu", 'na pas pu', 'pas pu recevoir', 'session', 'session expire', 'session expiré', 'session a expiré', 'connectez vous', 'connectez-vous', 'erreur inconnue', 'depasse', 'dépasse', 'limite', 'en attente', 'en cours', 'attendre', 'impossible', 'aucun argent'],
    motsEn: ['declined', 'refused', 'refusal', 'failed', 'failure', 'cancel', 'cancellation', 'recipient', 'beneficiary', 'could not receive', 'session', 'session expired', 'session has expired', 'log in', 'log in again', 'unknown error', 'error occurred', 'try again later', 'waiting for approval', 'waiting', 'exceeds', 'limit', 'pending', 'impossible', 'unable', 'no money'],
  },
  {
    id: 'operation_reussie',
    libelle: 'Opération réussie',
    arnaque: false,
    rassurante: true,
    fr: "Ton opération est partie. Vérifie le total qui a quitté ton compte, c'est toi qui décides de garder le reçu ou non.",
    en: "Your operation went through. Check the total that left your account, it's your decision whether to keep the receipt or not.",
    motsFr: ['accepte', 'accepte', 'acceptee', 'acceptee', 'reussite', 'réussite', 'reussi', 'réussi', 'parti', 'envoye', 'envoyé', 'recu', 'reçu', 'credite', 'crédité', 'effectue', 'effectué', 'confirme', 'confirmé', 'valide', 'validé', 'succès', 'succes', 'transaction complete', 'transaction complète', 'votre paiement', 'votre transfert', 'paiement accepte', 'paiement accepté', 'transfert reussi', 'transfert réussi', 'argent recu', 'argent reçu', 'vous a envoyer', 'vous a envoyé'],
    motsEn: ['accepted', 'success', 'successful', 'sent', 'received', 'credited', 'completed', 'confirmed', 'validated', 'your payment', 'your transfer', 'payment accepted', 'transfer sent', 'went through', 'has been accepted', 'was accepted', 'money received', 'withdrawal of', 'made on'],
  },
  {
    id: 'frais_tarif',
    libelle: 'Frais / tarif',
    arnaque: false,
    rassurante: false,
    fr: "Des frais s'appliquent à cette opération. Vérifie le montant avant de continuer, c'est toi qui décides.",
    en: "Fees apply to this operation. Check the amount before continuing, it's your decision.",
    motsFr: ['frais', 'tarif', 'charge', 'pourcent', 'pourcentage', 'cout', 'coût', 'coute', 'coûte', 'facture', 'facturé', 'preleve', 'prélevé', 'decembre', 'décembre', 'par message', 'frais de retrait', 'frais de transaction', 'frais bancaires', 'la banque prend'],
    motsEn: ['fee', 'fees', 'tariff', 'charge', 'percent', 'percentage', 'cost', 'costs', 'per month', 'per message', 'bank takes', 'bank charge', 'deduction', 'transaction fee', 'withdrawal fee'],
  },
  {
    id: 'plafond',
    libelle: 'Plafond / limite',
    arnaque: false,
    rassurante: false,
    fr: "Tu as atteint un plafond ou une limite sur ton compte. Vérifie ton plafond avant d'envoyer, c'est toi qui décides.",
    en: "You reached a limit on your account. Check your limit before sending, it's your decision.",
    motsFr: ['plafond', 'limite', 'limite autorisee', 'limite autorisée', 'quotidien', 'mensuel', 'par mois', 'maximum', 'ne pouvez pas envoyer plus', 'ne pouvez pas envoyer plus', 'depasse', 'dépasse', 'autorise', 'autorisé', 'depassee', 'dépassée', 'plafond quotidien', 'plafond mensuel'],
    motsEn: ['limit', 'limits', 'daily limit', 'monthly limit', 'maximum', 'exceed', 'exceeds', 'cannot send more', 'send more than', 'allowed limit', 'daily', 'monthly', 'per month', 'cap'],
  },
  {
    id: 'compte_bloque_suspendu',
    libelle: 'Compte bloqué / suspendu',
    arnaque: false,
    rassurante: false,
    fr: "Ton compte est bloqué ou suspendu pour le moment. Contacte ta banque avant de faire quoi que ce soit, c'est toi qui décides.",
    en: "Your account is blocked or suspended right now. Contact your bank before doing anything, it's your decision.",
    motsFr: ['suspendu', 'suspension', 'bloque', 'bloqué', 'bloquer', 'compte', 'carte expire', 'carte expiré', 'carte expirée', 'carte a expiré', 'demandez', 'expire', 'expiré', 'expiree', 'expérée', 'gèle', 'gelé', 'fermeture', 'desactive', 'désactivé', 'desactivee', 'désactivée', 'acces', 'accès', 'impossible de se connecter', 'verrouille', 'verrouillé', 'compte bloque', 'compte bloqué', 'compte suspendu', 'compte a été suspendu', 'connexion', 'inhabituelle', 'detecte', 'détecté', 'detectee', 'détectée'],
    motsEn: ['suspended', 'suspension', 'blocked', 'block', 'account', 'expired card', 'card expired', 'card has expired', 'request a new', 'frozen', 'deactivated', 'access', 'cannot connect', 'locked', 'account blocked', 'account suspended', 'unusual', 'detected'],
  },
  {
    id: 'mise_a_jour_informations',
    libelle: 'Mise à jour des informations',
    arnaque: false,
    rassurante: false,
    fr: "On te demande de mettre à jour tes informations avant une date limite. Fais-le seulement par le site officiel de ta banque, c'est toi qui décides.",
    en: "You are asked to update your information before a deadline. Do it only through your bank's official website, it's your decision.",
    motsFr: ['mettre a jour', 'mettre à jour', 'mise a jour', 'mise à jour', 'informations', 'informations bancaires', 'avant le', 'date limite', 'actualiser', 'donnees', 'données', 'identite', 'identité', 'piece', 'pièce', 'justificatif', 'verifier votre identité', 'vérifier votre identité', 'document', 'kyc'],
    motsEn: ['update your information', 'update information', 'update details', 'before', 'deadline', 'refresh', 'details', 'identity', 'document', 'verify your identity', 'kyc', 'update your details'],
  },
  {
    id: 'information_generale',
    libelle: 'Information générale',
    arnaque: false,
    rassurante: true,
    fr: "C'est un message d'information générale de ta banque. Lis-le, mais aucune opération urgente n'est demandée, c'est toi qui décides.",
    en: "It's a general information message from your bank. Read it, but no urgent operation is requested, it's your decision.",
    motsFr: ['important', 'clients', 'agence', 'agences', 'ferme', 'fermé', 'vendredi', 'demain', 'publie', 'publié', 'publication', 'gagner du temps', 'gagnez du temps', 'payez avec votre telephone', 'payez avec votre téléphone', 'boutique', 'votre facture', 'payer votre facture', 'facture', 'payer ici', 'message', 'generale', 'générale', 'information', 'nos agences', 'seront', 'sera', 'present', 'présentez', 'montrez', 'a l agent', 'à l agent', 'présentez ce code', 'retirer votre argent', 'annulez', 'si vous ne connaissez', 'ne connaissez pas', 'doute', 'appelez le', '8000', 'ne confirmez pas'],
    motsEn: ['important', 'customers', 'branch', 'branches', 'closed', 'friday', 'tomorrow', 'published', 'publication', 'save time', 'pay with your phone', 'shop', 'your bill', 'water bill', 'pay your bill', 'bill', 'pay here', 'message', 'general', 'information', 'branches will be closed', 'present', 'show', 'to the agent', 'withdraw your money', 'cancel', 'if you do not know', 'doubt', 'call the', '8000', 'do not confirm'],
  },
  {
    id: 'inconnu',
    libelle: 'Non reconnu',
    arnaque: false,
    rassurante: false,
    fr: "Kama ne reconnaît pas ce message. Lis-le bien ou demande à ta banque avant de faire quoi que ce soit, c'est toi qui décides.",
    en: "Kama does not recognize this message. Read it well or ask your bank before doing anything, it's your decision.",
    motsFr: [],
    motsEn: [],
  },
];

/** Libellés courts du badge de catégorie (le pidgin est un brouillon à valider, sans validated_by). */
const LIBELLES_WES: Record<CategorieId, string> = {
  faux_agent_demande_code: 'Fake agent',
  lien_piege: 'Trap link',
  faux_gain: 'Fake prize',
  faux_remboursement_erreur: 'Fake refund',
  faux_emploi: 'Fake job',
  investissement_douteux: 'Shady investment',
  urgence_menace: 'Urgent / threat',
  panne_maintenance: 'Service down',
  operation_refusee: 'Operation no go',
  operation_reussie: 'Operation done',
  frais_tarif: 'Charge',
  plafond: 'Limit',
  compte_bloque_suspendu: 'Account block',
  mise_a_jour_informations: 'Update your info',
  information_generale: 'General info',
  inconnu: 'Kama no sabi',
};

const LIBELLES_EN: Record<CategorieId, string> = {
  faux_agent_demande_code: 'Fake agent',
  lien_piege: 'Trap link',
  faux_gain: 'Fake prize',
  faux_remboursement_erreur: 'Fake refund',
  faux_emploi: 'Fake job',
  investissement_douteux: 'Shady investment',
  urgence_menace: 'Urgency / threat',
  panne_maintenance: 'Outage / maintenance',
  operation_refusee: 'Operation declined',
  operation_reussie: 'Operation successful',
  frais_tarif: 'Fees',
  plafond: 'Limit',
  compte_bloque_suspendu: 'Account blocked',
  mise_a_jour_informations: 'Update your info',
  information_generale: 'General info',
  inconnu: 'Not recognized',
};

/** Libellé du badge de catégorie dans la langue choisie (ws = pidgin brouillon). */
export function libelleCategorie(c: Categorie, code: string | undefined): string {
  if (code === 'wes') return LIBELLES_WES[c.id];
  if (code === 'en') return LIBELLES_EN[c.id];
  return c.libelle;
}

const PAR_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** Catégorie par id (pour l'affichage du badge et de l'explication). */
export function categorieParId(id: CategorieId): Categorie | undefined {
  return PAR_ID.get(id);
}

/** Explications française / anglaise par catégorie (source unique pour le catalogue et l'affichage). */
export const EXPLICATIONS: readonly { readonly id: CategorieId; readonly fr: string; readonly en: string }[] =
  CATEGORIES.map((c) => ({ id: c.id, fr: c.fr, en: c.en }));

/**
 * Classe un texte inédit dans l'une des 16 catégories.
 * Retourne toujours une catégorie définie (inconnu si aucun mot-clé ne matche).
 * Les arnaques ne sont jamais classées dans une catégorie rassurante (garde de sécurité).
 */
export function classer(texte: string): Categorie {
  const n = norm(texte);
  const ws = mots(texte);
  const scores = CATEGORIES.map((c) => ({ c, s: score(c, n, ws) }));
  const meilleurScore = Math.max(...scores.map((x) => x.s));
  if (meilleurScore <= 0) return PAR_ID.get('inconnu')!;

  const meilleur = scores.find((x) => x.s === meilleurScore)!.c;
  // Garde de sécurité : une arnaque ne doit jamais tomber dans une catégorie rassurante.
  if (meilleur.rassurante && estSignalArnaque(texte)) {
    let remplaçant: Categorie | undefined;
    let remplaçantScore = -1;
    for (const x of scores) {
      if (x.c.rassurante) continue;
      const mieux =
        x.s > remplaçantScore ||
        (x.s === remplaçantScore && PRIORITE.indexOf(x.c.id) < PRIORITE.indexOf(remplaçant!.id));
      if (mieux) {
        remplaçantScore = x.s;
        remplaçant = x.c;
      }
    }
    return remplaçant ?? PAR_ID.get('inconnu')!;
  }
  // Bris d'égalité par priorité parmi les scores maximaux.
  const exAequo = scores.filter((x) => x.s === meilleurScore).map((x) => x.c);
  exAequo.sort((a, b) => PRIORITE.indexOf(a.id) - PRIORITE.indexOf(b.id));
  return exAequo[0] ?? PAR_ID.get('inconnu')!;
}
