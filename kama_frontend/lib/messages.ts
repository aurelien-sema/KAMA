/**
 * Messages entre le popup et Kama dans la page bancaire.
 *  - `kama:ping` : le popup demande « Kama est-il présent sur cette page ? ».
 *    Pas de réponse = page non reconnue.
 *  - `kama:ouvrir` : le popup demande d'ouvrir la fenêtre Kama (bouton « Expliquer cette page »).
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
