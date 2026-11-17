/**
 * Encodage de la voix pour le serveur : WAV PCM 16 bits, 16 kHz, mono (seul format accepté, 30 secondes au plus).
 * Pas de bibliothèque : ce fichier n'importe rien et se teste sans navigateur.
 */

export const TAUX_SERVEUR = 16000;

/** Ramène des échantillons (-1 à 1) de `taux` Hz à 16 kHz, par interpolation linéaire. */
export function reechantillonner(x: Float32Array, taux: number): Float32Array {
  if (taux === TAUX_SERVEUR) return x;
  const longueur = Math.floor((x.length * TAUX_SERVEUR) / taux);
  const sortie = new Float32Array(longueur);
  const pas = taux / TAUX_SERVEUR;
  for (let i = 0; i < longueur; i++) {
    const position = i * pas;
    const a = Math.floor(position);
    const b = Math.min(a + 1, x.length - 1);
    const t = position - a;
    sortie[i] = x[a]! * (1 - t) + x[b]! * t;
  }
  return sortie;
}

export function secondes(x: Float32Array, taux: number) {
  return x.length / taux;
}

/** Fichier WAV complet (en-tête de 44 octets + échantillons) prêt à envoyer. */
export function encoderWav(x: Float32Array, taux: number): Uint8Array {
  const echantillons = reechantillonner(x, taux);
  const octets = new Uint8Array(44 + echantillons.length * 2);
  const vue = new DataView(octets.buffer);
  const texte = (decalage: number, s: string) => [...s].forEach((c, i) => vue.setUint8(decalage + i, c.charCodeAt(0)));
  texte(0, 'RIFF');
  vue.setUint32(4, 36 + echantillons.length * 2, true);
  texte(8, 'WAVE');
  texte(12, 'fmt ');
  vue.setUint32(16, 16, true);
  vue.setUint16(20, 1, true); // PCM
  vue.setUint16(22, 1, true); // mono
  vue.setUint32(24, TAUX_SERVEUR, true);
  vue.setUint32(28, TAUX_SERVEUR * 2, true);
  vue.setUint16(32, 2, true);
  vue.setUint16(34, 16, true);
  texte(36, 'data');
  vue.setUint32(40, echantillons.length * 2, true);
  echantillons.forEach((v, i) => vue.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, v)) * 32767), true));
  return octets;
}
