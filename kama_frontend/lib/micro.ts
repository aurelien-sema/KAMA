/**
 * Côté page : piloter l'écoute de Kama. Le micro n'est jamais ouvert dans la page de la banque :
 * on demande au service worker, qui fait écouter le document caché de Kama (voir messages.ts).
 * La page reçoit seulement le niveau du son (pour les barres), la durée et l'intention comprise.
 */
import { PORT_MICRO, type CommandeMicro, type DemandeAutorisation, type EvenementMicro } from './messages';
import { encoderWav, secondes } from './wav';

export type Micro = {
  demarrer: (langue: string) => void;
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
    demarrer: (langue) => envoyer({ type: 'demarrer', langue }),
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

// ---------------------------------------------------------------------------------------------------------------
// Enregistrement direct (fenêtre « Parler », lib/use-parler.ts). À terme, passer aussi par le micro hors écran ci-dessus.
// ---------------------------------------------------------------------------------------------------------------

/**
 * Enregistrement de la voix, seulement entre deux appuis sur le bouton micro (sécurité : « écoute seulement pendant l'appui,
 * indicateur visible, rien de conservé »). Le flux du micro est coupé dès l'arrêt et l'audio n'est gardé qu'en mémoire,
 * le temps de l'envoi.
 *
 * Le serveur n'accepte que du WAV PCM 16 bits, 16 kHz, mono : on enregistre les échantillons bruts (pas de MediaRecorder).
 */

export const DUREE_MAX = 28; // secondes (le serveur refuse plus de 30)
export const DUREE_MIN = 0.4;

export type RaisonMicro = 'refuse' | 'absent' | 'indisponible';
export class ErreurMicro extends Error {
  constructor(readonly raison: RaisonMicro) {
    super(raison);
  }
}

export type Enregistrement = {
  /** Coupe le micro et rend le WAV, ou `null` si l'enregistrement est trop court pour être compris. */
  arreter: () => Uint8Array | null;
  /** Coupe le micro et jette tout. */
  annuler: () => void;
};

export async function demarrerEnregistrement(auLimite: () => void): Promise<Enregistrement> {
  if (!navigator.mediaDevices?.getUserMedia) throw new ErreurMicro('indisponible');
  let flux: MediaStream;
  try {
    flux = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    throw new ErreurMicro((e as DOMException)?.name === 'NotFoundError' ? 'absent' : 'refuse');
  }

  const contexte = new AudioContext({ sampleRate: 16000 }); // si le navigateur impose un autre taux, wav.ts rééchantillonne
  const source = contexte.createMediaStreamSource(flux);
  const processeur = contexte.createScriptProcessor(4096, 1, 1);
  const muet = contexte.createGain();
  muet.gain.value = 0; // le processeur doit être branché pour tourner ; on ne réécoute pas la voix
  const morceaux: Float32Array[] = [];
  let total = 0;
  let termine = false;

  processeur.onaudioprocess = (e) => {
    if (termine) return;
    const bloc = new Float32Array(e.inputBuffer.getChannelData(0));
    morceaux.push(bloc);
    total += bloc.length;
    if (total / contexte.sampleRate >= DUREE_MAX) auLimite();
  };
  source.connect(processeur);
  processeur.connect(muet);
  muet.connect(contexte.destination);

  const fermer = () => {
    termine = true;
    processeur.onaudioprocess = null;
    flux.getTracks().forEach((t) => t.stop()); // le voyant du micro s'éteint
    try {
      source.disconnect();
      processeur.disconnect();
      muet.disconnect();
    } catch {
      // Déjà débranché.
    }
    void contexte.close();
  };

  return {
    arreter() {
      const taux = contexte.sampleRate;
      fermer();
      const x = new Float32Array(total);
      let curseur = 0;
      for (const b of morceaux) {
        x.set(b, curseur);
        curseur += b.length;
      }
      morceaux.length = 0;
      return secondes(x, taux) < DUREE_MIN ? null : encoderWav(x.subarray(0, Math.floor(DUREE_MAX * taux)), taux);
    },
    annuler() {
      fermer();
      morceaux.length = 0;
    },
  };
}
