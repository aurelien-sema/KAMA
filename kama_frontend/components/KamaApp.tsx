/**
 * Tout ce que Kama affiche dans la page : onglet de bord, menu, fenêtre Kama unique,
 * pastilles, surlignage « Montre-moi » et barre de sélection.
 * Kama ne clique jamais à la place de l'utilisateur et ne touche pas au contenu de la banque.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { OngletDeBord } from '@/components/OngletDeBord';
import { MenuOnglet, type ModeKama } from '@/components/MenuOnglet';
import { Pastilles } from '@/components/Pastilles';
import { Surlignage } from '@/components/Surlignage';
import { BarreSelection } from '@/components/BarreSelection';
import { ChoixLangue } from '@/components/kama/ChoixLangue';
import { KamaWindow, KAMA_WINDOW_HEIGHT } from '@/components/kama/fenetre/KamaWindow';
import { TalkIdleContent } from '@/components/kama/fenetre/contents';
import { ContenuReel, type VueReelle } from '@/components/kama/fenetre/reel';
import { trouverLangue, type IdLangue } from '@/config/langues';
import { LangueCourante, LectureAuto } from '@/lib/langue-courante';
import { lirePage, nomDecouverte, trouverDecouverte } from '@/lib/lecture-page';
import { estMessageKama } from '@/lib/messages';
import { enregistrerPositionOnglet, lirePositionOnglet, POSITION_PAR_DEFAUT, topBorne } from '@/lib/position-onglet';
import { reglageActif, reglageLangue, reglageMode, useReglage } from '@/lib/reglages';
import { useLecturePage } from '@/lib/use-lecture-page';
import { arreterLecture } from '@/lib/voix';

/** Ce que montre la fenêtre Kama. */
type Vue = { type: 'choix-langue' } | { type: 'parler' } | VueReelle;

function cleDeVue(v: Vue) {
  return JSON.stringify(v);
}

export function KamaApp() {
  const [idLangue, setIdLangue] = useReglage(reglageLangue);
  const [actif] = useReglage(reglageActif);
  const [mode] = useReglage(reglageMode);
  const langue = trouverLangue(idLangue);

  const [position, setPosition] = useState(POSITION_PAR_DEFAUT);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [vue, setVue] = useState<Vue | null>(null);
  /** Demande faite avant le choix de la langue : on l'affiche juste après le choix. */
  const [enAttente, setEnAttente] = useState<Vue | null>(null);
  const [surligne, setSurligne] = useState<{ zone: Element; nom: string } | null>(null);

  const lecture = useLecturePage(actif);

  const racine = useRef<HTMLDivElement>(null);
  const onglet = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const fenetre = useRef<HTMLElement>(null);

  const dansKama = useCallback(
    (e: Event) => (racine.current ? e.composedPath().includes(racine.current) : false),
    [],
  );

  useEffect(() => {
    lirePositionOnglet().then(setPosition);
  }, []);

  // Kama désactivé dans le popup : tout se ferme.
  useEffect(() => {
    if (!actif) {
      arreterLecture();
      setMenuOuvert(false);
      setVue(null);
      setSurligne(null);
    }
  }, [actif]);

  // Clavier : à l'ouverture, le focus va dans le menu puis dans la fenêtre.
  useEffect(() => {
    if (menuOuvert) menu.current?.querySelector('button')?.focus();
  }, [menuOuvert]);
  useEffect(() => {
    if (vue) fenetre.current?.focus();
  }, [vue]);

  /** Ouvre la fenêtre. Si aucune langue n'est choisie, Kama la demande d'abord. */
  function ouvrir(v: Vue) {
    setMenuOuvert(false);
    if (!langue && v.type !== 'choix-langue') {
      setEnAttente(v);
      setVue({ type: 'choix-langue' });
      return;
    }
    setVue(v);
  }

  function fermerFenetre() {
    arreterLecture();
    setVue(null);
    setEnAttente(null);
    onglet.current?.focus();
  }

  function clicOnglet() {
    if (!langue) {
      // Pas de langue : le premier clic ouvre le choix de la langue, pas le menu.
      if (vue?.type === 'choix-langue') fermerFenetre();
      else ouvrir({ type: 'choix-langue' });
      return;
    }
    setMenuOuvert((o) => !o);
  }

  function choisirDansMenu(m: ModeKama) {
    ouvrir(m === 'parler' ? { type: 'parler' } : { type: m });
  }

  function choisirLangue(id: IdLangue) {
    setIdLangue(id);
    if (enAttente) {
      setVue(enAttente);
      setEnAttente(null);
    } else {
      setVue(null);
      setMenuOuvert(true);
    }
  }

  /** « Montre-moi » : `cible` = élément connu ou élément découvert par Kama. */
  function montrer(cible: string) {
    const lecture = lirePage();
    const e = lecture.elements.get(cible as never);
    if (e) return setSurligne({ zone: e.zone, nom: e.def.nom });
    const d = trouverDecouverte(lecture, cible);
    if (d) setSurligne({ zone: d.zone, nom: nomDecouverte(d) });
  }

  /** Clic sur une pastille : élément connu ou élément découvert. */
  function ouvrirPastille(cible: string) {
    const connu = lecture.elements.has(cible as never);
    ouvrir(connu ? { type: 'element', id: cible as never } : { type: 'decouverte', cle: cible });
  }

  // Messages du popup : « Kama est-il là ? » et « Expliquer cette page ».
  const ouvrirRef = useRef(ouvrir);
  ouvrirRef.current = ouvrir;
  const actifRef = useRef(actif);
  actifRef.current = actif;
  useEffect(() => {
    const ecouter = (message: unknown, _expediteur: unknown, repondre: (r: unknown) => void) => {
      if (!estMessageKama(message)) return;
      if (message.type === 'kama:ping') repondre(true);
      if (message.type === 'kama:ouvrir') {
        if (actifRef.current) ouvrirRef.current({ type: 'expliquer' });
        repondre(true);
      }
    };
    try {
      browser.runtime.onMessage.addListener(ecouter);
    } catch {
      return;
    }
    return () => {
      try {
        browser.runtime.onMessage.removeListener(ecouter);
      } catch {
        // Extension rechargée : rien à retirer.
      }
    };
  }, []);

  // Fermeture du menu : Échap ou clic en dehors. Fermeture de la fenêtre : Échap depuis Kama.
  useEffect(() => {
    if (!menuOuvert && !vue) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !dansKama(e)) return;
      if (menuOuvert) {
        setMenuOuvert(false);
        onglet.current?.focus();
      } else if (vue) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOuvert, vue]);

  // Désactivé : Kama n'ajoute plus rien dans la page (il écoute seulement le popup).
  if (!actif) return <div ref={racine} className="kama-racine" />;

  return (
    <LangueCourante.Provider value={langue}>
      <LectureAuto.Provider value={mode === 'audio'}>
        <div ref={racine} className="kama-racine">
          <Pastilles lecture={lecture} onOuvrir={ouvrirPastille} />
          <Surlignage cible={surligne?.zone ?? null} onFin={() => setSurligne(null)} dansKama={dansKama} />
          <BarreSelection dansKama={dansKama} onExpliquer={(texte) => ouvrir({ type: 'selection', texte })} />

          <OngletDeBord
            ref={onglet}
            position={position}
            menuOuvert={menuOuvert}
            onClic={clicOnglet}
            onDeplace={setPosition}
            onDeplacementFini={(p) => {
              setPosition(p);
              enregistrerPositionOnglet(p);
            }}
          />

          {menuOuvert && <MenuOnglet ref={menu} position={position} onChoisir={choisirDansMenu} />}

          {vue && (
            <KamaWindow
              key={cleDeVue(vue)}
              ref={fenetre}
              avecMicro={vue.type !== 'choix-langue'}
              onClose={fermerFenetre}
              className="fixed right-14 z-[2147483647] -translate-y-1/2"
              style={{
                top: topBorne(position, KAMA_WINDOW_HEIGHT),
                height: `min(${KAMA_WINDOW_HEIGHT}px, calc(100vh - 32px))`,
              }}
            >
              {vue.type === 'choix-langue' ? (
                <ChoixLangue onChoisir={choisirLangue} onPasMaintenant={fermerFenetre} />
              ) : vue.type === 'parler' ? (
                <TalkIdleContent />
              ) : (
                <ContenuReel vue={vue} onShowMe={montrer} />
              )}
            </KamaWindow>
          )}

          {/* Annonce pour les lecteurs d'écran quand « Montre-moi » surligne un élément. */}
          <p className="sr-only" aria-live="polite">
            {surligne ? `Kama te montre : ${surligne.nom}` : ''}
          </p>
        </div>
      </LectureAuto.Provider>
    </LangueCourante.Provider>
  );
}
