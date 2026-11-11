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
export type SegmentAudio = { type: 'audio'; format: 'wav'; data: string; origin: 'recorded' | 'synthetic' } | { type: 'slot'; name: string };
export type LangueServeur = { code: string; name: string; translation_from: string[]; asr: boolean; tts: boolean };

export type DemandeApi =
  | { type: 'kama:api'; route: 'capabilities' }
  | { type: 'kama:api'; route: 'translate'; corps: { text: string; source_lang: 'fr' | 'en'; target_lang: string; element: ElementApi } }
  | { type: 'kama:api'; route: 'tts'; corps: { text: string; lang: string } }
  | { type: 'kama:api'; route: 'intent'; lang: string; wavBase64: string };

export type ReponseBrute = { ok: true; donnees: unknown } | { ok: false; code: string; statut: number };

/** `code` : celui du serveur (`busy`, `rate_limited`, `unmasked_content`…) ou `network` / `timeout` si le serveur ne répond pas. */
export class ErreurApi extends Error {
  constructor(readonly code: string, readonly statut = 0) {
    super(code);
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

export const capacites = () =>
  appeler<{ api_version: string; languages: LangueServeur[] }>({ type: 'kama:api', route: 'capabilities' });

export const traduireTexte = (text: string, target_lang: string, element: ElementApi) =>
  appeler<ReponseTraduction>({ type: 'kama:api', route: 'translate', corps: { text, source_lang: 'fr', target_lang, element } });

export const synthetiser = (text: string, lang: string) =>
  appeler<{ segments: SegmentAudio[] }>({ type: 'kama:api', route: 'tts', corps: { text, lang } });

export const reconnaitreIntention = (wav: Uint8Array, lang: string) =>
  appeler<{ intent: IntentionApi; confidence: number }>({ type: 'kama:api', route: 'intent', lang, wavBase64: versBase64(wav) });

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
