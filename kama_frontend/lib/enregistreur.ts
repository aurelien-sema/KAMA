/**
 * Enregistrement de la voix pour « Parler à Kama ».
 *
 * Format exigé par le serveur (backend/ARCHITECTURE.md, « Micro ») : WAV PCM 16 bits, 16 kHz,
 * mono, 30 secondes au plus. `MediaRecorder` ne sait pas produire ce format : on capte le son
 * avec un AudioContext réglé à 16 kHz, puis on écrit le WAV nous-mêmes.
 *
 * La voix reste en mémoire : rien n'est écrit sur le disque. Le micro est coupé dès la fin.
 * L'autorisation du micro est demandée par le navigateur au nom du site visité.
 */

export const FREQUENCE = 16000;
export const DUREE_MAX_S = 30;
/** En dessous, on considère qu'il n'y a pas eu de question (appui par erreur). */
const DUREE_MIN_S = 0.5;
/** Après avoir parlé, ce temps de silence arrête l'écoute tout seul. */
const SILENCE_FIN_S = 1.6;
/** Niveau (0 à 1) au-dessus duquel on considère que la personne parle. */
const SEUIL_PAROLE = 0.04;

export type FinEnregistrement =
  | { ok: true; wav: ArrayBuffer; duree: number }
  | { ok: false; raison: 'rien-entendu' | 'annule' };

import type { ErreurMicro } from './messages';
export type { ErreurMicro };

export type Enregistrement = {
  /** Arrête l'écoute et rend la voix enregistrée (appui sur le bouton). */
  arreter: () => void;
  /** Arrête sans rien garder (fenêtre fermée). */
  annuler: () => void;
};

type Options = {
  /** Niveau du son, de 0 à 1, environ 10 fois par seconde (pour les barres « Je t'écoute »). */
  onNiveau: (niveau: number) => void;
  onFin: (fin: FinEnregistrement) => void;
};

/** Démarre l'écoute. Rejette avec une `ErreurMicro` si le micro n'est pas accessible. */
export async function demarrerEnregistrement({ onNiveau, onFin }: Options): Promise<Enregistrement> {
  let flux: MediaStream;
  try {
    flux = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (e) {
    const nom = (e as DOMException)?.name;
    throw (nom === 'NotAllowedError' || nom === 'SecurityError'
      ? 'refuse'
      : nom === 'NotFoundError' || nom === 'OverconstrainedError'
        ? 'absent'
        : 'indisponible') satisfies ErreurMicro;
  }

  const contexte = new AudioContext({ sampleRate: FREQUENCE });
  const source = contexte.createMediaStreamSource(flux);
  // ScriptProcessor est ancien mais fonctionne partout sans fichier séparé (un AudioWorklet
  // demanderait de charger un module, ce que la politique de sécurité de certaines pages bloque).
  const processeur = contexte.createScriptProcessor(2048, 1, 1);
  const morceaux: Float32Array[] = [];
  let echantillons = 0;
  let aParle = false;
  let silenceDepuis = 0;
  let termine = false;

  processeur.onaudioprocess = (ev) => {
    if (termine) return;
    const entree = ev.inputBuffer.getChannelData(0);
    morceaux.push(new Float32Array(entree));
    echantillons += entree.length;

    let somme = 0;
    for (let i = 0; i < entree.length; i++) somme += entree[i]! * entree[i]!;
    const niveau = Math.min(1, Math.sqrt(somme / entree.length) * 4);
    onNiveau(niveau);

    const duree = echantillons / FREQUENCE;
    if (niveau > SEUIL_PAROLE) {
      aParle = true;
      silenceDepuis = duree;
    } else if (aParle && duree - silenceDepuis > SILENCE_FIN_S) {
      finir(true);
    }
    if (duree >= DUREE_MAX_S) finir(true);
  };
  source.connect(processeur);
  // Le processeur ne tourne que s'il est relié à la sortie ; il ne produit aucun son.
  processeur.connect(contexte.destination);

  function couper() {
    processeur.onaudioprocess = null;
    try {
      source.disconnect();
      processeur.disconnect();
    } catch {
      // Déjà déconnecté.
    }
    flux.getTracks().forEach((piste) => piste.stop());
    contexte.close().catch(() => {});
  }

  function finir(garder: boolean) {
    if (termine) return;
    termine = true;
    couper();
    if (!garder) return onFin({ ok: false, raison: 'annule' });
    const duree = echantillons / FREQUENCE;
    if (!aParle || duree < DUREE_MIN_S) return onFin({ ok: false, raison: 'rien-entendu' });
    onFin({ ok: true, wav: encoderWav(morceaux, echantillons), duree });
  }

  return { arreter: () => finir(true), annuler: () => finir(false) };
}

/** WAV PCM 16 bits mono, à la fréquence de l'enregistrement. */
function encoderWav(morceaux: Float32Array[], total: number): ArrayBuffer {
  const tampon = new ArrayBuffer(44 + total * 2);
  const v = new DataView(tampon);
  const ecrire = (pos: number, texte: string) => {
    for (let i = 0; i < texte.length; i++) v.setUint8(pos + i, texte.charCodeAt(i));
  };
  ecrire(0, 'RIFF');
  v.setUint32(4, 36 + total * 2, true);
  ecrire(8, 'WAVE');
  ecrire(12, 'fmt ');
  v.setUint32(16, 16, true); // taille du bloc « fmt »
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, FREQUENCE, true);
  v.setUint32(28, FREQUENCE * 2, true); // octets par seconde
  v.setUint16(32, 2, true); // octets par échantillon
  v.setUint16(34, 16, true); // bits par échantillon
  ecrire(36, 'data');
  v.setUint32(40, total * 2, true);
  let pos = 44;
  for (const m of morceaux) {
    for (let i = 0; i < m.length; i++) {
      const s = Math.max(-1, Math.min(1, m[i]!));
      v.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      pos += 2;
    }
  }
  return tampon;
}
