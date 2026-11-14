/**
 * Contexte envoyé au modèle de langue local : le TEXTE de la page, déjà masqué.
 *
 * Règles :
 *  - on ne lit que ce que `lirePage()` a trouvé (libellés, montants, alertes, titres, boutons) ;
 *  - chaque morceau est coupé à 300 caractères, l'ensemble à 1 500 : un modèle local n'a pas
 *    besoin de toute la page, et une page piégée ne peut pas noyer la consigne ;
 *  - le masquage est fait UNE fois sur l'ensemble, pour que {x1}, {x2}… désignent partout la
 *    même valeur ; les valeurs restent dans la page et servent à réafficher la réponse.
 */
import { lirePage, type LecturePage } from './lecture-page';
import { masquer } from './masquage';

const MAX_MORCEAU = 300;
const MAX_TOTAL = 1500;

export type ContextePage = { texte: string; valeurs: Record<string, string> };

export function contextePage(lecture: LecturePage = lirePage()): ContextePage {
  const morceaux: string[] = [];
  const vus = new Set<string>();
  const ajouter = (texte?: string) => {
    const propre = texte?.replace(/\s+/g, ' ').trim().slice(0, MAX_MORCEAU);
    if (!propre || vus.has(propre)) return;
    vus.add(propre);
    morceaux.push(propre);
  };

  for (const e of lecture.elements.values()) {
    ajouter(e.libelleTexte);
    ajouter(e.valeur);
    ajouter(e.message);
  }
  // Les éléments repérés sans configuration (alerte, nouveau message, titre, bouton) :
  // c'est là que peut se cacher une consigne (« envoie 50 000 à… »), elle est masquée comme le reste.
  for (const d of lecture.decouvertes) {
    ajouter(d.libelle);
    ajouter(d.valeur);
    ajouter(d.texte);
  }

  let brut = '';
  for (const morceau of morceaux) {
    if (brut.length + morceau.length + 1 > MAX_TOTAL) break;
    brut += (brut ? '\n' : '') + morceau;
  }
  return masquer(brut);
}
