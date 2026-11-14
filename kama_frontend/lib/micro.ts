/**
 * Côté page : piloter l'écoute de Kama. Le micro n'est jamais ouvert dans la page de la banque :
 * on demande au service worker, qui fait écouter le document caché de Kama (voir messages.ts).
 * La page reçoit seulement le niveau du son (pour les barres), la durée et l'intention comprise.
 */
import { PORT_MICRO, type CommandeMicro, type DemandeAutorisation, type EvenementMicro } from './messages';

export type Micro = {
  /** `contexte` : libellés de l'écran (JSON masqué, base64url), pour que l'assistant comprenne la question. */
  demarrer: (langue: string, contexte?: string) => void;
  arreter: () => void;
  reessayer: () => void;
  /** Coupe le micro et oublie la voix (fenêtre fermée). */
  fermer: () => void;
};

/** `onEvenement` reçoit aussi `{ type: 'coupe' }` si l'extension a été rechargée entre-temps. */
export function ouvrirMicro(onEvenement: (e: EvenementMicro | { type: 'coupe' }) => void): Micro {
  let port: ReturnType<typeof browser.runtime.connect> | null = null;

  function envoyer(c: CommandeMicro) {
    try {
      if (!port) {
        const p = browser.runtime.connect({ name: PORT_MICRO });
        p.onMessage.addListener((e: EvenementMicro) => onEvenement(e));
        p.onDisconnect.addListener(() => {
          if (port === p) port = null;
          onEvenement({ type: 'coupe' });
        });
        port = p;
      }
      port.postMessage(c);
    } catch {
      port = null;
      onEvenement({ type: 'coupe' });
    }
  }

  return {
    demarrer: (langue, contexte) => envoyer({ type: 'demarrer', langue, contexte }),
    arreter: () => port && envoyer({ type: 'arreter' }),
    reessayer: () => envoyer({ type: 'reessayer' }),
    fermer: () => {
      const p = port;
      port = null;
      p?.disconnect();
    },
  };
}

/** Ouvre la page de bienvenue de Kama sur l'étape « Autoriser le micro ». */
export function demanderAutorisationMicro() {
  try {
    browser.runtime.sendMessage({ type: 'kama:autoriser-micro' } satisfies DemandeAutorisation).catch(() => {});
  } catch {
    // Extension rechargée : la page doit être rechargée (message affiché par ailleurs).
  }
}
