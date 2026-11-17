/**
 * Langues annoncées mais pas encore activables (bamoun, fulfulde) : affichées grisées dans les choix de langue
 * du popup et de la fenêtre Kama, sans autre mention (décision d'Omar du 2026-11-12 : le bouton désactivé suffit).
 * Ce sont des boutons désactivés : on ne peut pas les choisir, le lecteur d'écran les annonce « indisponible ».
 */
import { LANGUES_A_VENIR } from '@/config/langues';
import { useTexte } from '@/lib/use-texte';

export function LanguesAVenir({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {LANGUES_A_VENIR.map((l) => (
        <LangueAVenir key={l.id} nom={l.nom} region={l.region} compact={compact} />
      ))}
    </>
  );
}

function LangueAVenir({ nom, region, compact }: { nom: string; region: string; compact: boolean }) {
  const regionTraduite = useTexte(region);
  return (
    <button
      type="button"
      disabled
      className={`flex cursor-not-allowed flex-col items-start justify-center border-dashed border-kama-ink/25 bg-bank-bg text-left text-kama-ink opacity-60 ${
        compact ? 'min-h-11 rounded-md border py-1 pl-9 pr-2' : 'min-h-14 rounded-xl border-2 py-1.5 pl-3 pr-3'
      }`}
    >
      <span className={`${compact ? 'text-base font-medium' : 'text-[17px] font-bold'} leading-tight`}>{nom}</span>
      <span className={`${compact ? 'text-xs' : 'text-sm'} leading-tight text-kama-ink/75`}>{regionTraduite}</span>
    </button>
  );
}
