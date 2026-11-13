/**
 * Menu de l'onglet de bord : 2 boutons ronds à icônes, empilés à gauche de l'onglet (décision d'Omar du 2026-11-13 :
 * pas de texte ni de bouton d'écoute, il faut décider vite).
 *  - Parler à Kama (micro) · Expliquer cette page (document). « Résumer mes transactions » retiré le 2026-11-13.
 *  - Boutons de 56 px ; le nom de chaque bouton est donné aux lecteurs d'écran (`aria-label`) et s'affiche dans
 *    une infobulle au survol ou au focus clavier.
 * Icônes : lucide-react (pas d'emoji, rendu identique sur tous les ordinateurs).
 */
import { forwardRef } from 'react';
import { FileText, Mic, type LucideIcon } from 'lucide-react';
import { useLangueCourante } from '@/lib/langue-courante';
import { topBorne } from '@/lib/position-onglet';
import { traduireKama, useTexte } from '@/lib/use-texte';

export type ModeKama = 'parler' | 'expliquer';

export const ACTIONS: { mode: ModeKama; Icone: LucideIcon; libelle: string }[] = [
  { mode: 'parler', Icone: Mic, libelle: 'Parler à Kama' },
  { mode: 'expliquer', Icone: FileText, libelle: 'Expliquer cette page' },
];

/** Hauteur du menu (2 boutons de 56 px, espace et marges), pour qu'il ne sorte pas de l'écran. */
const HAUTEUR_MENU = 144;

type Props = { position: number; onChoisir: (mode: ModeKama) => void };

export const MenuOnglet = forwardRef<HTMLDivElement, Props>(function MenuOnglet({ position, onChoisir }, ref) {
  const langue = useLangueCourante();
  const menu = useTexte('Menu Kama');
  return (
    <div
      ref={ref}
      id="kama-menu"
      role="group"
      aria-label={menu}
      style={{ top: topBorne(position, HAUTEUR_MENU) }}
      className="animate-kama-appear fixed right-14 z-[2147483647] flex -translate-y-1/2 flex-col gap-2 rounded-full bg-kama-white p-2 shadow-xl ring-1 ring-kama-ink/5"
    >
      {ACTIONS.map(({ mode, Icone, libelle }) => {
        const texte = traduireKama(langue?.code, libelle);
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChoisir(mode)}
            aria-label={texte}
            className="group relative grid size-14 cursor-pointer place-items-center rounded-full border-0 bg-kama-cream text-kama-ink transition-colors hover:bg-kama-orange focus-visible:bg-kama-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
          >
            <Icone className="size-6" strokeWidth={2.25} aria-hidden />
            {/* Infobulle : nom du bouton, au survol ou au focus clavier (après 300 ms). */}
            <span
              aria-hidden
              className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-kama-ink px-3 py-1.5 text-sm font-semibold text-kama-white opacity-0 shadow-lg transition-opacity delay-300 duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {texte}
            </span>
          </button>
        );
      })}
    </div>
  );
});
