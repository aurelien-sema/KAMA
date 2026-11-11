/**
 * Relit la page bancaire dès qu'elle change : passage d'une étape à l'autre, montant recalculé,
 * bandeau d'erreur qui apparaît, texte ajouté par le jury après le chargement (protocole).
 * Aucun rechargement de page n'est nécessaire.
 */
import { useEffect, useState } from 'react';
import { lirePage, type LecturePage } from './lecture-page';

const VIDE: LecturePage = { elements: new Map(), etape: null };
const DELAI = 250;

export function useLecturePage(actif: boolean): LecturePage {
  const [lecture, setLecture] = useState<LecturePage>(VIDE);

  useEffect(() => {
    if (!actif) {
      setLecture(VIDE);
      return;
    }
    let minuterie = 0;
    const relire = () => {
      window.clearTimeout(minuterie);
      minuterie = window.setTimeout(() => setLecture(lirePage()), DELAI);
    };
    setLecture(lirePage());
    const observateur = new MutationObserver(relire);
    observateur.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
    window.addEventListener('resize', relire);
    return () => {
      observateur.disconnect();
      window.clearTimeout(minuterie);
      window.removeEventListener('resize', relire);
    };
  }, [actif]);

  return lecture;
}
