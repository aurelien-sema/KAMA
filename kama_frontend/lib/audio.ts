/**
 * Lecture des réponses à voix haute dans la langue choisie.
 *
 * Le serveur renvoie des segments dans l'ordre : de l'audio (extrait enregistré par un locuteur, ou voix automatique) et des
 * balises {xN} à la place des montants. Les montants ne sont jamais envoyés au serveur : à chaque balise, Kama lit LUI-MÊME le
 * montant de la page (nombre en mots, voix du navigateur) tant que les audios de chiffres enregistrés ne sont pas embarqués.
 * Si le serveur ne peut pas parler, l'appelant bascule sur la lecture en français (`lireEnFrancais`).
 *
 * L'audio est décodé avec Web Audio (pas d'adresse blob:) : la politique de sécurité de la page bancaire ne peut pas le bloquer.
 */
import { depuisBase64, synthetiser, type SegmentAudio } from './api';
import { direMontant } from './nombres';
import type { Parole } from './traduction';
import { enregistrerArret } from './voix';

export type VoixUtilisee = 'enregistree' | 'automatique';

let contexte: AudioContext | null = null;
let jeton = 0;
let sourceCourante: AudioBufferSourceNode | null = null;
let derniere: { paroles: Parole[]; vitesse: number } | null = null;

function arreter() {
  jeton += 1;
  try {
    sourceCourante?.stop();
  } catch {
    // Déjà arrêtée.
  }
  sourceCourante = null;
}
enregistrerArret(arreter);

async function jouerWav(donnees: Uint8Array, vitesse: number, mon: number) {
  contexte ??= new AudioContext();
  if (contexte.state === 'suspended') await contexte.resume();
  const tampon = await contexte.decodeAudioData(donnees.buffer.slice(donnees.byteOffset, donnees.byteOffset + donnees.byteLength) as ArrayBuffer);
  if (mon !== jeton) return;
  await new Promise<void>((fini) => {
    const source = contexte!.createBufferSource();
    source.buffer = tampon;
    source.playbackRate.value = vitesse;
    source.connect(contexte!.destination);
    source.onended = () => fini();
    sourceCourante = source;
    source.start();
  });
}

/** Le montant de la page, lu localement : en mots anglais pour le pidgin, tel qu'écrit en français sinon. */
function lireMontant(valeur: string, langue: string, vitesse: number, mon: number) {
  return new Promise<void>((fini) => {
    if (!('speechSynthesis' in window) || mon !== jeton) return fini();
    const mots = langue === 'wes' ? direMontant(valeur) : null;
    const phrase = new SpeechSynthesisUtterance(mots ? mots.join(' ') : valeur);
    phrase.lang = mots ? 'en-GB' : 'fr-FR';
    phrase.rate = vitesse;
    phrase.onend = () => fini();
    phrase.onerror = () => fini();
    window.speechSynthesis.speak(phrase);
  });
}

/**
 * Lit les paroles dans l'ordre. Lève `ErreurApi` si le serveur ne peut pas parler (rien n'a alors été joué).
 * Rend le type de voix utilisé, à signaler à la personne quand elle est automatique.
 */
export async function jouerParoles(paroles: Parole[], vitesse = 1): Promise<VoixUtilisee> {
  arreter();
  const mon = jeton;
  derniere = { paroles, vitesse };
  const reponses = await Promise.all(paroles.map((p) => synthetiser(p.texte, p.langue))); // tout d'abord : pas de trou entre deux phrases
  if (mon !== jeton) return 'enregistree';
  let voix: VoixUtilisee = 'enregistree';
  for (let i = 0; i < paroles.length; i++) {
    for (const segment of reponses[i]!.segments as SegmentAudio[]) {
      if (mon !== jeton) return voix;
      if (segment.type === 'audio') {
        if (segment.origin === 'synthetic') voix = 'automatique';
        await jouerWav(depuisBase64(segment.data), vitesse, mon);
      } else {
        const valeur = paroles[i]!.valeurs[segment.name];
        if (valeur !== undefined) await lireMontant(valeur, paroles[i]!.langue, vitesse, mon);
      }
    }
  }
  return voix;
}

/** « Répète » : rejoue la dernière réponse parlée. Faux s'il n'y en a pas. */
export function peutRepeter() {
  return derniere !== null;
}
export function rejouerDerniere() {
  return derniere ? jouerParoles(derniere.paroles, derniere.vitesse) : Promise.resolve(null);
}

export function arreterParoles() {
  arreter();
}
