/**
 * Barre de sélection (maquette Lovable « Sélection de texte ») : apparaît quand l'utilisateur
 * surligne au moins 2 caractères dans la page bancaire.
 *  - 8 px au-dessus du début de la sélection (en dessous s'il n'y a pas de place) ;
 *  - [Expliquer] ouvre la fenêtre Kama avec ce texte ; [Écouter] le lit à voix haute ;
 *  - boutons de 44 px minimum, fond orange et texte quasi-noir au survol / focus ;
 *  - disparaît quand la sélection est vidée ou que la page défile.
 * Jamais sur ce que l'utilisateur tape dans un champ (protocole : données saisies non traitées).
 */
import { useEffect, useState } from 'react';
import { MessageCircleQuestion, Volume2 } from 'lucide-react';
import { KamaLogo } from '@/components/kama/primitives';
import { useLangueCourante } from '@/lib/langue-courante';
import { traduireLibelle } from '@/lib/use-texte';
import { lireEnFrancais } from '@/lib/voix';

const HAUTEUR = 52;
const LARGEUR = 270;
const ECART = 8;
const LONGUEUR_MAX = 500;

type Props = { dansKama: (e: Event) => boolean; onExpliquer: (texte: string) => void };

export function BarreSelection({ dansKama, onExpliquer }: Props) {
  const langue = useLangueCourante();
  const [barre, setBarre] = useState<{ texte: string; top: number; left: number } | null>(null);

  useEffect(() => {
    function verifier(e: Event) {
      if (dansKama(e)) return;
      // On laisse le navigateur finir de mettre à jour la sélection.
      window.setTimeout(() => {
        const selection = document.getSelection();
        const texte = selection?.toString().replace(/\s+/g, ' ').trim() ?? '';
        const actif = document.activeElement;
        const dansUnChamp = !!actif && (actif.tagName === 'INPUT' || actif.tagName === 'TEXTAREA' || (actif as HTMLElement).isContentEditable);
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed || texte.length < 2 || dansUnChamp) {
          setBarre(null);
          return;
        }
        const plage = selection.getRangeAt(0);
        const r = plage.getClientRects()[0] ?? plage.getBoundingClientRect();
        let top = r.top - ECART - HAUTEUR;
        if (top < ECART) top = r.bottom + ECART;
        const left = Math.min(Math.max(ECART, r.left), window.innerWidth - LARGEUR - ECART);
        setBarre({ texte: texte.slice(0, LONGUEUR_MAX), top, left });
      }, 0);
    }
    function siVide() {
      const s = document.getSelection();
      if (!s || s.isCollapsed) setBarre(null);
    }
    const masquer = () => setBarre(null);

    document.addEventListener('mouseup', verifier);
    document.addEventListener('keyup', verifier);
    document.addEventListener('touchend', verifier);
    document.addEventListener('selectionchange', siVide);
    window.addEventListener('scroll', masquer, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mouseup', verifier);
      document.removeEventListener('keyup', verifier);
      document.removeEventListener('touchend', verifier);
      document.removeEventListener('selectionchange', siVide);
      window.removeEventListener('scroll', masquer, { capture: true });
    };
  }, [dansKama]);

  if (!barre) return null;

  const bouton =
    'inline-flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border-0 bg-transparent px-3 text-sm font-medium text-kama-ink hover:bg-kama-orange focus-visible:bg-kama-orange focus-visible:outline-2 focus-visible:outline-kama-ink';

  return (
    <div
      role="toolbar"
      aria-label="Kama : texte sélectionné"
      // Garder la sélection de la page quand on appuie sur la barre.
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: barre.top, left: barre.left }}
      className="animate-kama-appear fixed z-[2147483647] flex items-center gap-1 rounded-xl bg-kama-white p-1 pl-2 shadow-lg"
    >
      <KamaLogo taille={24} />
      <button
        type="button"
        className={bouton}
        onClick={() => {
          onExpliquer(barre.texte);
          setBarre(null);
        }}
      >
        <MessageCircleQuestion className="size-4" aria-hidden /> {traduireLibelle(langue?.code, 'Expliquer')}
      </button>
      <button type="button" className={bouton} onClick={() => lireEnFrancais(barre.texte)}>
        <Volume2 className="size-4" aria-hidden /> {traduireLibelle(langue?.code, 'Écouter')}
      </button>
    </div>
  );
}
