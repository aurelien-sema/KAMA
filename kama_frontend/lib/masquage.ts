/**
 * Masquage des données personnelles AVANT tout envoi au serveur (sécurité : « ne rien envoyer »).
 *
 * C'est la copie exacte de `backend/app/security/masking.py`. Le serveur rejoue le même algorithme et
 * répond `unmasked_content` (422) si un texte n'est pas déjà masqué. La référence commune est
 * `backend/contracts/masking_vectors.json` : `npm test` vérifie que cette copie donne les mêmes sorties.
 *
 * Ce fichier n'importe rien : il doit tourner sans navigateur (tests) et ne dépend d'aucune API de l'extension.
 */

const CAP = 'A-ZÀ-ÖØ-ÞŒ';
const LOW = 'a-zß-öø-ÿœ';
const WORD = `${CAP}${LOW}0-9_`;
const APOS = "'’";
const NS = '  '; // espaces à l'intérieur d'un groupe de noms
const SEP = '   '; // espaces à l'intérieur d'un nombre

export const SLOT_RE = /\{x[0-9]+\}/g;
const SLOT_D = /\{x[0-9]+\}/gd;
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/gd;
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/gd;
const TOKEN_RE = new RegExp(`[${WORD}\\-]+`, 'gd');
const LETTER_RE = new RegExp(`[${CAP}${LOW}]`);
const DIGIT_RE = /\d/;
const NUMBER_RE = new RegExp(
  `\\+?\\d(?:[${SEP}.,:/\\-]?\\d)*(?:[${SEP}]?(?:FCFA|F CFA|XAF|CFA|F|%|€|\\$)(?![${WORD}]))?`,
  'gd',
);

const CAPWORD = `[${CAP}][${CAP}${LOW}${APOS}\\-]*`;
const NAME = `[${CAP}][${LOW}${APOS}\\-]+`;
const RUN_RE = new RegExp(`(?<![${WORD}${APOS}\\-])(${CAPWORD}(?:[${NS}]+${CAPWORD})+)(?![${WORD}])`, 'gd');
const PREP_RE = new RegExp(`(?:^|[${NS}(])(?:à|de|du|pour|vers|to|from|by)[${NS}]+(${NAME})(?![${WORD}])`, 'gd');
const ELISION_RE = new RegExp(`(?:^|[^${WORD}])[dD][${APOS}](${NAME})(?![${WORD}])`, 'gd');
const LABEL_RE = new RegExp(
  `(?:[Bb]énéficiaire|[Bb]eneficiaire|[Dd]estinataire|[Rr]ecipient|[Bb]eneficiary|[Nn]om|[Nn]ame)` +
    `[${NS}]*:[${NS}]*(${CAPWORD})(?![${WORD}])`,
  'gd',
);

/** Mots d'interface : une suite de mots en majuscules faite uniquement de ces mots n'est pas un nom de personne. */
const INTERFACE_WORDS = new Set(
  `
  mon ma mes votre vos notre nos le la les un une des du de au aux et ou sur avoir
  my your our the a an of to and or on for in at
  compte comptes solde soldes disponible insuffisant frais montant montants total totaux
  transfert transferts retrait retraits depot dépôt versement virement paiement paiements
  facture factures bénéficiaire beneficiaire bénéficiaires destinataire expéditeur
  confirmer confirmation annuler valider envoyer recevoir continuer retour suivant accueil
  historique transactions transaction opération opérations erreur attention alerte
  code secret mot passe service services client clients banque carte épargne prêt
  mobile money orange mtn express union fcfa xaf otp pin sms bonjour merci
  account accounts balance available insufficient fee fees amount amounts transfer transfers
  withdrawal deposit payment payments bill bills recipient beneficiary sender confirm cancel
  approve send receive continue back next home history error warning alert password bank
  card savings loan customer hello thank thanks
  press tap click appuyez cliquez touchez
  safinum pay kama
  `
    .split(/\s+/)
    .filter(Boolean),
);

type Plage = [number, number];
export type Masque = { texte: string; valeurs: Record<string, string> };

function plages(re: RegExp, texte: string, groupe = 0): Plage[] {
  const out: Plage[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte))) {
    if (m[0] === '') {
      re.lastIndex++;
      continue;
    }
    const idx = (m as RegExpExecArray & { indices: Array<[number, number] | undefined> }).indices[groupe];
    if (idx) out.push([idx[0], idx[1]]);
  }
  return out;
}

function estTexteInterface(fragment: string) {
  const mots = fragment
    .split(new RegExp(`[${NS}]+`))
    .map((w) => w.replace(new RegExp(`^[${APOS}\\-]+|[${APOS}\\-]+$`, 'g'), '').toLowerCase());
  return mots.filter(Boolean).every((w) => INTERFACE_WORDS.has(w));
}

/** Données reconnaissables à leur forme : e-mails, liens, identifiants, nombres. */
function plagesFermes(texte: string): Plage[] {
  const out: Plage[] = [...plages(EMAIL_RE, texte), ...plages(URL_RE, texte)];
  for (const [a, b] of plages(TOKEN_RE, texte)) {
    const mot = texte.slice(a, b);
    if (LETTER_RE.test(mot) && DIGIT_RE.test(mot)) out.push([a, b]);
  }
  return [...out, ...plages(NUMBER_RE, texte)];
}

function plagesNoms(texte: string): Plage[] {
  const out: Plage[] = [];
  for (const re of [RUN_RE, PREP_RE, ELISION_RE, LABEL_RE]) {
    for (const [a, b] of plages(re, texte, 1)) {
      if (!estTexteInterface(texte.slice(a, b))) out.push([a, b]);
    }
  }
  return out;
}

function plagesConnues(texte: string, connues: string[]): Plage[] {
  const out: Plage[] = [];
  const valeurs = [...new Set(connues.filter((k) => k.trim()))].sort((x, y) => y.length - x.length);
  for (const v of valeurs) {
    let debut = texte.indexOf(v);
    while (debut !== -1) {
      out.push([debut, debut + v.length]);
      debut = texte.indexOf(v, debut + v.length);
    }
  }
  return out;
}

/** Garde les plages sans chevauchement ; les premiers groupes sont prioritaires. */
function fusionner(groupes: Plage[][]): Plage[] {
  const prises: Plage[] = [];
  for (const groupe of groupes) {
    for (const [a, b] of groupe) {
      if (a < b && !prises.some(([x, y]) => a < y && x < b)) prises.push([a, b]);
    }
  }
  return prises.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

/**
 * Remplace chaque donnée sensible par {x1}, {x2}… de gauche à droite.
 * `connues` : valeurs lues sur la page (nom du bénéficiaire, numéro de compte…) que l'algorithme ne peut pas deviner.
 */
export function masquer(texte: string, connues: string[] = []): Masque {
  const balises = plages(SLOT_D, texte);
  const retenues = fusionner([balises, plagesConnues(texte, connues), plagesFermes(texte), plagesNoms(texte)]);
  const valeurs: Record<string, string> = {};
  let sortie = '';
  let curseur = 0;
  retenues.forEach(([a, b], i) => {
    sortie += texte.slice(curseur, a) + `{x${i + 1}}`;
    valeurs[`x${i + 1}`] = texte.slice(a, b);
    curseur = b;
  });
  return { texte: sortie + texte.slice(curseur), valeurs };
}

/** Vrai si le masquage ne changerait rien au texte : le serveur refuse tout autre texte. */
export function estMasque(texte: string) {
  return masquer(texte).texte === texte;
}

/** Balises d'un texte, triées : sert à vérifier qu'une traduction a gardé exactement celles de la source. */
export function balisesDe(texte: string) {
  return (texte.match(SLOT_RE) ?? []).slice().sort();
}

/** Remet les valeurs exactes de la page à la place des balises, sans rien reformater. Rend `null` si une balise est inconnue. */
export function demasquer(texte: string, valeurs: Record<string, string>): Array<string | { montant: string }> | null {
  const morceaux: Array<string | { montant: string }> = [];
  let curseur = 0;
  const re = new RegExp(SLOT_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(texte))) {
    const valeur = valeurs[m[0].slice(1, -1)];
    if (valeur === undefined) return null;
    if (m.index > curseur) morceaux.push(texte.slice(curseur, m.index));
    morceaux.push({ montant: valeur });
    curseur = m.index + m[0].length;
  }
  if (curseur < texte.length) morceaux.push(texte.slice(curseur));
  return morceaux;
}
