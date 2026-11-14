/**
 * Appels au serveur, depuis la page.
 *
 * Le serveur n'accepte que l'origine de l'extension : l'appel réseau est donc fait par le service worker
 * (entrypoints/background.ts), pas par la page. Ici on ne fait qu'envoyer un message et lire la réponse.
 *
 * Règles (sécurité) : seuls des textes DÉJÀ MASQUÉS partent (voir masquage.ts) ; rien n'est écrit dans la console ;
 * rien n'est stocké.
 */

export type ElementApi = 'text' | 'balance' | 'amount' | 'fee' | 'total' | 'confirm' | 'error' | 'warning';
export type BadgeApi = 'verified' | 'machine' | 'untranslated';
export type IntentionApi =
  | 'ask_balance' | 'ask_fees' | 'ask_total' | 'what_to_do' | 'explain_error' | 'summarize_transactions' | 'repeat' | 'unknown';

export type ReponseTraduction = { text: string | null; badge: BadgeApi; origin: string; reason: string | null };
/** Réponse de l'assistant : le pidgin entendu, puis la réponse pidgin (jamais un montant inventé). */
export type ReponseAsk = {
  heard: string;
  intent: IntentionApi;
  confidence: number;
  answer: string | null;
  badge: 'machine' | 'untranslated';
  reason: string;
};
export type SegmentAudio = { type: 'audio'; format: 'wav'; data: string; origin: 'recorded' | 'synthetic' } | { type: 'slot'; name: string };
export type LangueServeur = { code: string; name: string; translation_from: string[]; asr: boolean; tts: boolean };

export type DemandeApi =
  | { type: 'kama:api'; route: 'capabilities' }
  | { type: 'kama:api'; route: 'translate'; corps: { text: string; source_lang: 'fr' | 'en'; target_lang: string; element: ElementApi } }
  | { type: 'kama:api'; route: 'tts'; corps: { text: string; lang: string } }
  | { type: 'kama:api'; route: 'intent'; lang: string; wavBase64: string }
  | { type: 'kama:api'; route: 'ask'; lang: string; wavBase64: string; contexte: string };

export type ReponseBrute = { ok: true; donnees: unknown } | { ok: false; code: string; statut: number };

/** `code` : celui du serveur (`busy`, `rate_limited`, `unmasked_content`…) ou `network` / `timeout` si le serveur ne répond pas. */
export class ErreurApi extends Error {
  readonly code: string;
  readonly statut: number;

  constructor(code: string, statut = 0) {
    super(code);
    this.code = code;
    this.statut = statut;
  }
  /** Le serveur ne répond pas ou est saturé : « Réessayer » a un sens. */
  get reessayable() {
    return ['network', 'timeout', 'busy', 'rate_limited'].includes(this.code);
  }
}

async function appeler<T>(demande: DemandeApi): Promise<T> {
  let reponse: ReponseBrute | undefined;
  try {
    reponse = (await browser.runtime.sendMessage(demande)) as ReponseBrute | undefined;
  } catch {
    throw new ErreurApi('network');
  }
  if (!reponse) throw new ErreurApi('network');
  if (!reponse.ok) throw new ErreurApi(reponse.code, reponse.statut);
  return reponse.donnees as T;
}

const MOTS_FR = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'vers', 'chez',
  'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos',
  'leur', 'leurs', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'te', 'se', 'moi', 'toi', 'lui', 'eux',
  'est', 'sont', 'etait', 'etaient', 'ai', 'ont', 'avait', 'avaient', 'sera', 'seront',
  'ne', 'pas', 'plus', 'jamais', 'rien', 'aucun', 'aucune', 'tout', 'toute', 'tous', 'toutes', 'tres', 'trop', 'bien',
  'aussi', 'encore', 'deja', 'souvent', 'toujours', 'et', 'ou', 'mais', 'donc', 'ni', 'car', 'que', 'qui', 'quoi',
  'dont', 'quand', 'comment', 'pourquoi', 'combien', 'si', 'comme', 'oui', 'non', 'merci', 'bonjour', 'salut',
  'au', 'aux', 'en', 'solde', 'compte', 'argent', 'montant', 'frais', 'transfert', 'virement', 'paiement', 'facture',
  'retrait', 'beneficiaire', 'telephone', 'numero', 'banque', 'carte', 'guichet', 'envoyer', 'envoie', 'envoyez',
  'recevoir', 'recois', 'recoit', 'paye', 'payer', 'payez', 'confirmer', 'confirme', 'confirmez', 'annuler', 'annule',
  'annulez', 'verifier', 'verifie', 'verifiez', 'reessayer', 'reessaie', 'continuer', 'continuez', 'disponible',
  'insuffisant', 'insuffisante', 'suffisant', 'suffisante', 'bloque', 'bloquee', 'recu', 'effectue', 'effectuee',
  'entree', 'entrees', 'sortie', 'sorties', 'maintenant', 'avant', 'apres', 'gratuit', 'gratuits', 'marchand', 'faux',
  'vide', 'attente', 'jour', 'semaine', 'mois', 'heure', 'demain', 'hier', "aujourd'hui",
]);

const MOTS_EN = new Set([
  'the', 'an', 'and', 'but', 'so', 'if', 'then', 'than', 'because', 'of', 'to', 'in', 'at', 'by', 'for', 'from', 'with',
  'without', 'about', 'into', 'over', 'under', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does',
  'did', 'done', 'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must', 'i', 'you',
  'he', 'she', 'it', 'we', 'they', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that',
  'these', 'those', 'not', 'no', 'never', 'nothing', 'any', 'some', 'all', 'very', 'too', 'also', 'still', 'already',
  'always', 'often', 'again', 'now', 'before', 'after', 'today', 'tomorrow', 'yesterday', 'yet', 'yes', 'thanks', 'thank',
  'hello', 'hi', 'please', 'balance', 'account', 'money', 'amount', 'fee', 'fees', 'funds', 'transfer', 'payment', 'bill',
  'withdrawal', 'deposit', 'beneficiary', 'phone', 'number', 'reference', 'bank', 'card', 'send', 'sent', 'receive',
  'received', 'pay', 'paid', 'confirm', 'cancel', 'check', 'verify', 'try', 'continue', 'available', 'insufficient',
  'sufficient', 'blocked', 'completed', 'incoming', 'outgoing', 'day', 'week', 'month', 'time', 'hour', 'right', 'wrong',
  'free', 'merchant', 'salary', 'light', 'counter', 'history', 'share', 'greater', 'zero', 'respond', 'responding',
  'saved', 'failed', 'fail', 'error', 'warning', 'details', 'required',
  "i'm", "i've", "i'll", "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "can't", 'cannot', "won't",
  "wouldn't", "shouldn't", "couldn't", "you're", "you've", "you'll", "we're", "we've", "we'll", "they're", "they've",
  "they'll", "it's", "that's", "there's", "hasn't", "haven't", "hadn't",
]);

const PREFIXES_FR = ["n'", "l'", "d'", "qu'", "c'", "j'", "s'", "t'", "m'"];
const ACCENTS = /[àâäéèêëîïôöùûüÿçœæ]/i;

/** Détecte la langue source d'un texte masqué : heuristique déterministe, sans réseau ni modèle. */
export function detecterLangueSource(texte: string): 'fr' | 'en' {
  const propre = texte.replace(/\{x\d+\}/g, ' ').toLowerCase().replace(/’/g, "'");
  if (ACCENTS.test(propre)) return 'fr';
  const mots = propre.match(/[a-zà-ÿ]+(?:['’][a-zà-ÿ]+)*/g) ?? [];
  let fr = 0;
  let en = 0;
  for (const mot of mots) {
    if (MOTS_FR.has(mot)) fr += 2;
    else if (MOTS_EN.has(mot)) en += 2;
    else if (PREFIXES_FR.some((prefixe) => mot.startsWith(prefixe))) {
      fr += 1;
      for (const partie of mot.split("'")) if (MOTS_FR.has(partie)) fr += 1;
    }
  }
  return en > fr ? 'en' : 'fr';
}

export const capacites = () =>
  appeler<{ api_version: string; languages: LangueServeur[] }>({ type: 'kama:api', route: 'capabilities' });

export const traduireTexte = (text: string, target_lang: string, element: ElementApi) =>
  appeler<ReponseTraduction>({
    type: 'kama:api',
    route: 'translate',
    corps: { text, source_lang: detecterLangueSource(text), target_lang, element },
  });

export const synthetiser = (text: string, lang: string) =>
  appeler<{ segments: SegmentAudio[] }>({ type: 'kama:api', route: 'tts', corps: { text, lang } });

export const reconnaitreIntention = (wav: Uint8Array, lang: string) =>
  appeler<{ intent: IntentionApi; confidence: number }>({ type: 'kama:api', route: 'intent', lang, wavBase64: versBase64(wav) });

/** Question vocale : le serveur répond avec le texte entendu et, si besoin, une réponse pidgin. */
export const demanderKama = (wav: Uint8Array, lang: string, contexte: string) =>
  appeler<ReponseAsk>({ type: 'kama:api', route: 'ask', lang, wavBase64: versBase64(wav), contexte });

export function versBase64(octets: Uint8Array) {
  let s = '';
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(s);
}

export function depuisBase64(b64: string) {
  const s = atob(b64);
  const octets = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) octets[i] = s.charCodeAt(i);
  return octets;
}
