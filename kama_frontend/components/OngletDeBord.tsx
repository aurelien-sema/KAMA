/**
 * Onglet de bord : demi-pilule blanche collée au bord droit.
 * Maquette Lovable « Onglet de bord » :
 *  1. Repos : 44 × 44 px, centré verticalement.
 *  2. Survol / focus clavier : s'élargit à 96 px et affiche « Kama » (150 ms).
 *  3. Ouvert : le clic ouvre / ferme le menu (géré par KamaApp).
 *  4. Déplacement : appui maintenu + glisser vertical (> 4 px), à 16 px minimum des bords ;
 *     contour quasi-noir 2 px + ombre renforcée ; la position est mémorisée ; pas d'ouverture du menu.
 */
import { forwardRef, useRef, useState } from 'react';
import { KamaLogo } from '@/components/kama/primitives';
import { topBorne } from '@/lib/position-onglet';
import { useTexte } from '@/lib/use-texte';

const HAUTEUR = 44;
const SEUIL_GLISSER = 4;

type Props = {
  position: number;
  menuOuvert: boolean;
  /** `auClavier` : ouvert avec Entrée ou Espace (le focus ira alors dans le menu). */
  onClic: (auClavier: boolean) => void;
  onDeplace: (position: number) => void;
  onDeplacementFini: (position: number) => void;
};

export const OngletDeBord = forwardRef<HTMLButtonElement, Props>(function OngletDeBord(
  { position, menuOuvert, onClic, onDeplace, onDeplacementFini },
  ref,
) {
  const [glisse, setGlisse] = useState(false);
  const depart = useRef<{ y: number; position: number } | null>(null);
  const aGlisse = useRef(false);
  const ouvrir = useTexte('Ouvrir Kama');

  function positionDepuis(clientY: number) {
    const marge = 16 + HAUTEUR / 2;
    const y = Math.min(Math.max(clientY, marge), window.innerHeight - marge);
    return y / window.innerHeight;
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    depart.current = { y: e.clientY, position };
    aGlisse.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!depart.current) return;
    if (!aGlisse.current && Math.abs(e.clientY - depart.current.y) <= SEUIL_GLISSER) return;
    if (!aGlisse.current) {
      aGlisse.current = true;
      setGlisse(true);
    }
    onDeplace(positionDepuis(e.clientY));
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!depart.current) return;
    depart.current = null;
    if (aGlisse.current) {
      setGlisse(false);
      onDeplacementFini(positionDepuis(e.clientY));
    }
  }

  function onClick(e: React.MouseEvent) {
    // Un glisser-déposer ne doit pas ouvrir le menu.
    if (aGlisse.current) {
      aGlisse.current = false;
      return;
    }
    onClic(e.detail === 0); // detail 0 : clic venu du clavier
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={ouvrir}
      aria-haspopup="true"
      aria-expanded={menuOuvert}
      aria-controls="kama-menu"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ top: topBorne(position, HAUTEUR), touchAction: 'none' }}
      className={`group fixed right-0 z-[2147483647] flex h-11 -translate-y-1/2 select-none items-center gap-2 overflow-hidden rounded-l-full border-0 bg-kama-white pl-2 transition-[width] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink ${
        glisse
          ? 'w-11 cursor-grabbing shadow-xl ring-2 ring-kama-ink'
          : 'w-11 cursor-pointer shadow-md hover:w-24 focus-visible:w-24'
      }`}
    >
      <KamaLogo taille={28} />
      <span className="whitespace-nowrap font-display text-sm text-kama-ink">Kama</span>
    </button>
  );
});
