/**
 * Annonces audio pré-générées en pidgin, servies depuis l'extension (public/audio/wes).
 * Si le fichier manque, `jouerAnnonce` renvoie false : l'appelant affiche le texte pidgin, sans son.
 */
import { enregistrerArret } from './voix';

export type IdAnnonce = 'serveur' | 'traduction';

const FICHIERS: Record<IdAnnonce, string> = {
  serveur: 'audio/wes/annonce_serveur.wav',
  traduction: 'audio/wes/annonce_traduction.wav',
};

let audio: HTMLAudioElement | null = null;
let fin: ((ok: boolean) => void) | null = null;

export function arreterAnnonce() {
  const source = audio;
  const terminer = fin;
  audio = null;
  fin = null;
  if (source) {
    source.onended = null;
    source.onerror = null;
    source.pause();
    source.removeAttribute('src');
    source.load();
  }
  terminer?.(false);
}

enregistrerArret(arreterAnnonce);

export async function jouerAnnonce(id: IdAnnonce): Promise<boolean> {
  arreterAnnonce();
  const source = new Audio(`${browser.runtime.getURL('/')}${FICHIERS[id]}`);
  source.preload = 'auto';
  audio = source;

  return new Promise<boolean>((resolve) => {
    let termine = false;
    const conclure = (ok: boolean) => {
      if (termine) return;
      termine = true;
      if (audio === source) {
        audio = null;
        fin = null;
      }
      source.onended = null;
      source.onerror = null;
      resolve(ok);
    };
    fin = conclure;
    source.onended = () => conclure(true);
    source.onerror = () => conclure(false);
    void source.play().catch(() => conclure(false));
  });
}
