/**
 * Tout ce que Kama affiche dans la page : onglet de bord, menu et fenêtre Kama unique.
 * Kama ne clique jamais à la place de l'utilisateur et ne touche pas au contenu de la banque.
 */
import { useEffect, useRef, useState } from 'react';
import { OngletDeBord } from '@/components/OngletDeBord';
import { MenuOnglet, type ModeKama } from '@/components/MenuOnglet';
import { KamaWindow, KAMA_WINDOW_HEIGHT } from '@/components/kama/fenetre/KamaWindow';
import {
  ContenuFenetre,
  MarqueurExemple,
  micPour,
  utiliseDesExemples,
  type EtatFenetre,
} from '@/components/kama/fenetre/etats';
import {
  enregistrerPositionOnglet,
  lirePositionOnglet,
  POSITION_PAR_DEFAUT,
  topBorne,
} from '@/lib/position-onglet';
import { arreterLecture } from '@/lib/voix';

/** État de la fenêtre ouvert par chaque bouton du menu. */
const ETAT_INITIAL: Record<ModeKama, EtatFenetre> = {
  parler: 'parler-attente',
  expliquer: 'expliquer',
  resumer: 'resumer',
};

export function KamaApp() {
  const [position, setPosition] = useState(POSITION_PAR_DEFAUT);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [etat, setEtat] = useState<EtatFenetre | null>(null);

  const racine = useRef<HTMLDivElement>(null);
  const onglet = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const fenetre = useRef<HTMLElement>(null);

  useEffect(() => {
    lirePositionOnglet().then(setPosition);
  }, []);

  // Clavier : à l'ouverture, le focus va dans le menu puis dans la fenêtre.
  useEffect(() => {
    if (menuOuvert) menu.current?.querySelector('button')?.focus();
  }, [menuOuvert]);
  useEffect(() => {
    if (etat) fenetre.current?.focus();
  }, [etat]);

  function fermerFenetre() {
    arreterLecture();
    setEtat(null);
    onglet.current?.focus();
  }

  // Fermeture du menu : Échap ou clic en dehors. Fermeture de la fenêtre : Échap depuis Kama.
  useEffect(() => {
    if (!menuOuvert && !etat) return;

    function dansKama(e: Event) {
      return racine.current ? e.composedPath().includes(racine.current) : false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !dansKama(e)) return;
      if (menuOuvert) {
        setMenuOuvert(false);
        onglet.current?.focus();
      } else if (etat) {
        fermerFenetre();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (!menuOuvert) return;
      const chemin = e.composedPath();
      if (menu.current && chemin.includes(menu.current)) return;
      if (onglet.current && chemin.includes(onglet.current)) return;
      setMenuOuvert(false);
    }

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [menuOuvert, etat]);

  function choisir(m: ModeKama) {
    setMenuOuvert(false);
    setEtat(ETAT_INITIAL[m]);
  }

  return (
    <div ref={racine} className="kama-racine">
      <OngletDeBord
        ref={onglet}
        position={position}
        menuOuvert={menuOuvert}
        onClic={() => setMenuOuvert((o) => !o)}
        onDeplace={setPosition}
        onDeplacementFini={(p) => {
          setPosition(p);
          enregistrerPositionOnglet(p);
        }}
      />

      {menuOuvert && <MenuOnglet ref={menu} position={position} onChoisir={choisir} />}

      {etat && (
        <KamaWindow
          key={etat}
          ref={fenetre}
          mic={micPour(etat)}
          onClose={fermerFenetre}
          className="fixed right-14 z-[2147483647] -translate-y-1/2"
          style={{
            top: topBorne(position, KAMA_WINDOW_HEIGHT),
            height: `min(${KAMA_WINDOW_HEIGHT}px, calc(100vh - 32px))`,
          }}
        >
          {utiliseDesExemples(etat) && <MarqueurExemple />}
          <ContenuFenetre etat={etat} />
        </KamaWindow>
      )}
    </div>
  );
}
