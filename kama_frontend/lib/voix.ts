/**
 * Lecture à voix haute avec la voix du navigateur (speechSynthesis), dans la langue de secours :
 * celle du navigateur, français ou anglais (lib/secours.ts). C'est le repli quand la voix en langue
 * nationale du serveur n'est pas disponible (« Écouter en français / Listen in English »).
 * La voix suit la langue du texte lu : un texte de la page resté en français est lu avec une voix française.
 */
import { detecterLangueSource } from './api';
import { LANGUE_SECOURS, secours } from './langue-secours';

export function lireTexte(texte: string, vitesse = 1, aLaFin?: () => void) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const lu = secours(texte);
  const phrase = new SpeechSynthesisUtterance(lu);
  phrase.lang = LANGUE_SECOURS === 'en' && detecterLangueSource(lu) === 'en' ? 'en-GB' : 'fr-FR';
  phrase.rate = vitesse;
  if (aLaFin) {
    phrase.onend = aLaFin;
    phrase.onerror = aLaFin;
  }
  window.speechSynthesis.speak(phrase);
}

/** Autres lectures à couper en même temps (la lecture en langue nationale de `audio.ts` s'y inscrit). */
const arretsSupplementaires: Array<() => void> = [];
export function enregistrerArret(arret: () => void) {
  arretsSupplementaires.push(arret);
}

export function arreterLecture() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  arretsSupplementaires.forEach((arret) => arret());
}
