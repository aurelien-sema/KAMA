/**
 * Enregistrement de la voix, seulement entre deux appuis sur le bouton micro (sécurité : « écoute seulement pendant l'appui,
 * indicateur visible, rien de conservé »). Le flux du micro est coupé dès l'arrêt et l'audio n'est gardé qu'en mémoire,
 * le temps de l'envoi.
 *
 * Le serveur n'accepte que du WAV PCM 16 bits, 16 kHz, mono : on enregistre les échantillons bruts (pas de MediaRecorder).
 */
import { encoderWav, secondes } from './wav';

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
