/**
 * Messages entre les parties de l'extension.
 *
 * Popup → Kama dans la page bancaire :
 *  - `kama:ping` : « Kama est-il présent sur cette page ? ». Pas de réponse = page non reconnue.
 *  - `kama:ouvrir` : ouvrir la fenêtre Kama (bouton « Expliquer cette page »).
 *
 * « Parler à Kama » : c'est KAMA qui écoute, pas le site de la banque.
 * Le micro est ouvert dans un document caché de l'extension (`entrypoints/micro/`), et non dans
 * la page : le navigateur demande donc l'autorisation au nom de Kama, et la banque n'a jamais
 * accès au micro. La voix ne passe pas par la page.
 *
 *   page (Kama)  ──port « kama-micro »──►  service worker  ──messages──►  document « micro »
 *        ◄── niveau, envoi, résultat ──             └──► serveur Kama (POST /v1/voice/intent)
 */
export type MessageKama = { type: 'kama:ping' } | { type: 'kama:ouvrir'; etat: 'expliquer' };

export function estMessageKama(m: unknown): m is MessageKama {
  return typeof m === 'object' && m !== null && typeof (m as { type?: unknown }).type === 'string' &&
    (m as { type: string }).type.startsWith('kama:');
}

/** Envoie un message à Kama dans l'onglet actif. Renvoie `false` si Kama n'y est pas. */
export async function envoyerAOngletActif(message: MessageKama): Promise<boolean> {
  try {
    const [onglet] = await browser.tabs.query({ active: true, currentWindow: true });
    if (onglet?.id === undefined) return false;
    const reponse = await browser.tabs.sendMessage(onglet.id, message);
    return reponse === true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------------------- */
/* Micro                                                                                    */
/* ---------------------------------------------------------------------------------------- */

export const PORT_MICRO = 'kama-micro';

/** Intentions reconnues par le serveur (backend/app/schemas.py). */
export type Intention =
  | 'ask_balance'
  | 'ask_fees'
  | 'ask_total'
  | 'what_to_do'
  | 'explain_error'
  | 'summarize_transactions'
  | 'repeat'
  | 'unknown';

/**
 * Réponse à une question vocale.
 * `code` d'erreur : ceux du serveur (`asr_unavailable`, `busy`, `rate_limited`, `invalid_audio`…)
 * ou `reseau` (pas de connexion, serveur muet).
 */
export type ResultatIntention =
  | { ok: true; intention: Intention; confiance: number; simulation: boolean }
  | { ok: false; code: string };

/** Erreurs d'accès au micro. `refuse` : Kama n'a pas (encore) l'autorisation du micro. */
export type ErreurMicro = 'refuse' | 'absent' | 'indisponible';

/** Page → service worker. */
export type CommandeMicro =
  | { type: 'demarrer'; langue: string }
  | { type: 'arreter' }
  | { type: 'reessayer' };

/** Service worker → page. */
export type EvenementMicro =
  | { type: 'ecoute' }
  | { type: 'niveau'; niveau: number }
  | { type: 'rien-entendu' }
  | { type: 'envoi'; duree: number }
  | { type: 'resultat'; resultat: ResultatIntention }
  | { type: 'erreur'; code: ErreurMicro };

/** Service worker ↔ document « micro » (messages marqués par leur destinataire). */
export type VersDocumentMicro = { cible: 'micro'; type: 'demarrer' | 'arreter' | 'annuler' };
export type DepuisDocumentMicro =
  | { cible: 'service'; type: 'niveau'; niveau: number }
  | { cible: 'service'; type: 'fin'; ok: true; wav: string; duree: number }
  | { cible: 'service'; type: 'fin'; ok: false; raison: 'rien-entendu' | 'annule' };

/** Page → service worker : ouvrir la page de bienvenue sur l'autorisation du micro. */
export type DemandeAutorisation = { type: 'kama:autoriser-micro' };

export function pourDestinataire<T extends { cible: string }>(m: unknown, cible: T['cible']): m is T {
  return typeof m === 'object' && m !== null && (m as { cible?: unknown }).cible === cible;
}

/* ---------------------------------------------------------------------------------------- */

/** Les messages de l'extension ne transportent que du texte : la voix voyage en base64. */
export function enBase64(donnees: ArrayBuffer) {
  const octets = new Uint8Array(donnees);
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

export function depuisBase64(texte: string) {
  const binaire = atob(texte);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return octets;
}
