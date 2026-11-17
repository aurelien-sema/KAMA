/**
 * Écran « Bienvenue ! Choisis ta langue ».
 * Utilisé à l'identique dans le popup (premier lancement) et dans la fenêtre Kama
 * (premier clic sur l'onglet tant qu'aucune langue n'est choisie).
 * Maquette Lovable « Popup — Premier lancement » : gros boutons de 56 px, un bouton d'écoute par langue.
 * Une seule colonne (et non deux comme dans la maquette, qui avait 6 langues) : avec 2 langues
 * et leur région, les boutons pleine largeur sont plus lisibles.
 */
import { LANGUES, type IdLangue } from '@/config/langues';
import { SpeakButton, TranslationBadge } from '@/components/kama/primitives';
import { LanguesAVenir } from '@/components/kama/LanguesAVenir';
import { useLangueCourante } from '@/lib/langue-courante';
import { traduireKama, useTexte } from '@/lib/use-texte';

const TITRE_FR = 'Bienvenue ! Choisis ta langue.';

type Props = { onChoisir: (id: IdLangue) => void; onPasMaintenant: () => void };

export function ChoixLangue({ onChoisir, onPasMaintenant }: Props) {
  const langue = useLangueCourante();
  const titre = useTexte(TITRE_FR);
  const pasMaintenant = useTexte('Pas maintenant');
  const ecouterPrefixe = useTexte('Écouter :');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="m-0 flex-1 text-xl font-bold text-kama-ink">{titre}</h2>
        <SpeakButton texte={titre} label={`${ecouterPrefixe} ${titre}`} />
      </div>

      <div className="flex flex-col gap-2">
        {LANGUES.map((l) => (
          <div key={l.id} className="flex items-center rounded-xl border-2 border-kama-ink bg-kama-white pr-1">
            <button
              type="button"
              onClick={() => onChoisir(l.id)}
              className="flex min-h-14 flex-1 cursor-pointer flex-col items-start justify-center rounded-l-xl border-0 bg-transparent py-1.5 pl-3 text-left text-kama-ink hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
            >
              <span className="text-[17px] font-bold leading-tight">{l.nom}</span>
              <span className="text-sm leading-tight text-kama-ink/70">{traduireKama(langue?.code, l.region)}</span>
            </button>
            <SpeakButton texte={l.nom} label={`${ecouterPrefixe} ${l.nom}`} />
          </div>
        ))}
        <LanguesAVenir />
      </div>

      <TranslationBadge />

      <button
        type="button"
        onClick={onPasMaintenant}
        className="hit-44 cursor-pointer self-start rounded-full border-0 bg-transparent px-2 text-sm font-semibold text-kama-ink underline underline-offset-4 hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        {pasMaintenant}
      </button>
    </div>
  );
}
