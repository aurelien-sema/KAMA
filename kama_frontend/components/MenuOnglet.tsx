/**
 * Menu de l'onglet de bord (état 3 de la maquette Lovable « Onglet de bord »).
 * 248 px de large, 12 px à gauche de l'onglet ; boutons de 56 px de haut minimum, texte 16 px.
 * Chaque bouton ouvre la fenêtre Kama sur le mode choisi ; le bouton haut-parleur lit le libellé.
 * Icônes : lucide-react (pas d'emoji, rendu identique sur tous les ordinateurs).
 */
import { forwardRef } from 'react';
import { Banknote, FileText, Mic, type LucideIcon } from 'lucide-react';
import { SpeakButton, TranslationBadge } from '@/components/kama/primitives';
import { useLangueCourante } from '@/lib/langue-courante';
import { topBorne } from '@/lib/position-onglet';
import { traduireLibelle } from '@/lib/use-texte';

export type ModeKama = 'parler' | 'expliquer' | 'resumer';

export const ACTIONS: { mode: ModeKama; Icone: LucideIcon; libelle: string }[] = [
  { mode: 'parler', Icone: Mic, libelle: 'Parler à Kama' },
  { mode: 'expliquer', Icone: FileText, libelle: 'Expliquer cette page' },
  { mode: 'resumer', Icone: Banknote, libelle: 'Résumer mes transactions' },
];

/** Hauteur approximative du menu, pour qu'il ne sorte pas de l'écran. */
const HAUTEUR_MENU = 250;

type Props = { position: number; onChoisir: (mode: ModeKama) => void };

export const MenuOnglet = forwardRef<HTMLDivElement, Props>(function MenuOnglet({ position, onChoisir }, ref) {
  const langue = useLangueCourante();
  return (
    <div
      ref={ref}
      id="kama-menu"
      role="group"
      aria-label="Menu Kama"
      style={{ top: topBorne(position, HAUTEUR_MENU) }}
      className="animate-kama-appear fixed right-14 z-[2147483647] flex w-[248px] -translate-y-1/2 flex-col gap-2 rounded-2xl bg-kama-white p-3 shadow-xl"
    >
      {ACTIONS.map(({ mode, Icone, libelle }) => (
        <div key={mode} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChoisir(mode)}
            className="flex min-h-14 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border-0 bg-kama-cream px-3 text-left text-base font-bold text-kama-ink hover:bg-kama-orange focus-visible:outline-2 focus-visible:outline-kama-ink"
          >
            <Icone className="size-6 shrink-0" strokeWidth={2.25} aria-hidden />
            {traduireLibelle(langue?.code, libelle)}
          </button>
          <SpeakButton texte={libelle} label={`Écouter : ${libelle}`} />
        </div>
      ))}
      <TranslationBadge />
    </div>
  );
});
