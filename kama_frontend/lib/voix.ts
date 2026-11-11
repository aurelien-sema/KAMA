/**
 * Lecture à voix haute, provisoire : voix française du navigateur (speechSynthesis),
 * comme dans les maquettes Lovable. Elle correspond au repli « Écouter en français ».
 * Les audios pré-enregistrés en ewondo remplaceront cette lecture quand ils seront fournis.
 */
export function lireEnFrancais(texte: string, vitesse = 1, aLaFin?: () => void) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(texte);
  phrase.lang = 'fr-FR';
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
