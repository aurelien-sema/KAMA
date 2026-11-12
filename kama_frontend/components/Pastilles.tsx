/**
 * Pastilles Kama posées à côté des éléments importants de la page (maquette Lovable
 * « Icônes dans la page ») : solde, montant, frais, total, bouton Confirmer, message d'erreur.
 *  - Pastille Ø 24 px dans une zone cliquable de 44 × 44 px, à 8 px à droite de l'élément
 *    (à gauche s'il n'y a pas de place) ;
 *  - au survol ou au focus clavier, infobulle « Kama t'explique » (après 300 ms) ;
 *  - au clic : la fenêtre Kama s'ouvre sur l'explication de cet élément.
 * Les pastilles vivent dans le Shadow DOM de Kama, par-dessus la page : la page n'est pas modifiée.
 */
import { traduireKama, useTexte } from '@/lib/use-texte';
import { useLangueCourante } from '@/lib/langue-courante';
import { useEffect, useReducer } from 'react';
import { AVEC_PASTILLE, nomDecouverte, type LecturePage } from '@/lib/lecture-page';
import { KamaLogo } from '@/components/kama/primitives';

const ZONE = 44;
const PASTILLE = 24;
const ECART = 8;

/**
 * `cible` = identifiant d'un élément connu (config/banques/) ou clé d'un élément
 * découvert tout seul par Kama (montant, alerte ou nouveau message inconnus).
 */
export function Pastilles({ lecture, onOuvrir }: { lecture: LecturePage; onOuvrir: (cible: string) => void }) {
  // Recalcule les positions quand la page défile ou que la fenêtre change de taille.
  const [, rafraichir] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let image = 0;
    const planifier = () => {
      cancelAnimationFrame(image);
      image = requestAnimationFrame(rafraichir);
    };
    window.addEventListener('scroll', planifier, { capture: true, passive: true });
    window.addEventListener('resize', planifier);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener('scroll', planifier, { capture: true });
      window.removeEventListener('resize', planifier);
    };
  }, []);

  const importants = [
    ...[...lecture.elements.values()]
      .filter((e) => e.def.pastille)
      .map((e) => ({ cible: e.def.id as string, ancre: e.ancre, nom: e.def.nom })),
    ...lecture.decouvertes
      .filter((d) => AVEC_PASTILLE.includes(d.nature))
      .map((d) => ({ cible: d.cle, ancre: d.ancre, nom: nomDecouverte(d) })),
  ].filter((p) => p.ancre.isConnected);
  return (
    <>
      {importants.map((p) => (
        <Pastille key={p.cible} ancre={p.ancre} nom={p.nom} onClick={() => onOuvrir(p.cible)} />
      ))}
    </>
  );
}

function Pastille({ ancre, nom: nomFr, onClick }: { ancre: Element; nom: string; onClick: () => void }) {
  const langue = useLangueCourante();
  const explique = useTexte("Kama t'explique");
  const nom = traduireKama(langue?.code, nomFr);
  const r = rectangleDuTexte(ancre);
  if (!r || r.bottom < 0 || r.top > window.innerHeight) return null;

  const decalage = (ZONE - PASTILLE) / 2;
  let left = r.right + ECART - decalage;
  // Pas de place à droite (bord de l'écran ou onglet Kama) : on la met à gauche.
  if (left + ZONE > window.innerWidth - 64) left = r.left - ECART - PASTILLE - decalage;
  const top = r.top + r.height / 2 - ZONE / 2;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${explique} : ${nom}`}
      style={{ left, top }}
      className="group fixed z-[2147483646] grid size-11 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-kama-ink"
    >
      <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-kama-white shadow-md ring-2 ring-kama-orange transition-transform group-hover:scale-110">
        <KamaLogo taille={20} />
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-kama-ink px-3 py-1 text-sm font-medium text-kama-white opacity-0 transition-opacity delay-300 duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {explique}
      </span>
    </button>
  );
}

/** Rectangle serré autour du texte (et non de tout le bloc), pour coller la pastille au texte. */
function rectangleDuTexte(el: Element): DOMRect | null {
  if (el.matches('button, a, [role="button"]')) return el.getBoundingClientRect();
  const plage = document.createRange();
  plage.selectNodeContents(el);
  const r = plage.getBoundingClientRect();
  if (r.width || r.height) return r;
  const b = el.getBoundingClientRect();
  return b.width || b.height ? b : null;
}
