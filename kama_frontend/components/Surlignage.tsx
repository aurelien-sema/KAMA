/**
 * « Montre-moi » : fait défiler la page jusqu'à l'élément et l'entoure d'un contour orange
 * (maquette Lovable « Élément surligné ») : contour 3 px, rayon 6 px, halo orange 25 %,
 * 2 pulsations puis fixe. Disparaît au clic dans la page, à Échap, ou après 8 secondes.
 * Kama ne clique pas et ne modifie pas la page : le contour est dessiné par-dessus, dans son Shadow DOM.
 */
import { useEffect, useState } from 'react';

const DUREE = 8000;
const MARGE = 4;

type Props = {
  cible: Element | null;
  onFin: () => void;
  /** Vrai si l'événement vient de Kama (un clic dans la fenêtre ne doit pas effacer le contour). */
  dansKama: (e: Event) => boolean;
};

export function Surlignage({ cible, onFin, dansKama }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!cible) return;
    const moinsDeMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cible.scrollIntoView({ behavior: moinsDeMouvement ? 'auto' : 'smooth', block: 'center' });

    // Suit l'élément pendant le défilement (au plus 8 s).
    // S'il disparaît (changement d'étape dans la page), le surlignage s'arrête.
    let image = 0;
    const suivre = () => {
      const r = cible.getBoundingClientRect();
      if (!cible.isConnected || (r.width === 0 && r.height === 0)) {
        onFin();
        return;
      }
      setRect(r);
      image = requestAnimationFrame(suivre);
    };
    suivre();

    const minuterie = window.setTimeout(onFin, DUREE);
    const auClic = (e: PointerEvent) => {
      if (!dansKama(e)) onFin();
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFin();
    };
    document.addEventListener('pointerdown', auClic, true);
    document.addEventListener('keydown', auClavier, true);
    return () => {
      cancelAnimationFrame(image);
      window.clearTimeout(minuterie);
      document.removeEventListener('pointerdown', auClic, true);
      document.removeEventListener('keydown', auClavier, true);
      setRect(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cible]);

  if (!cible || !rect) return null;
  return (
    <div
      aria-hidden
      className="kama-surlignage pointer-events-none fixed z-[2147483646] rounded-[6px]"
      style={{
        top: rect.top - MARGE,
        left: rect.left - MARGE,
        width: rect.width + MARGE * 2,
        height: rect.height + MARGE * 2,
      }}
    />
  );
}
