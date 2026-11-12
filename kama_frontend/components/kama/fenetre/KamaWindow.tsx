/**
 * La fenêtre Kama unique : en-tête fixe + contenu qui défile + micro en bas.
 * Seul le contenu change d'une action à l'autre (règle d'or n° 6).
 * Repris de la maquette Lovable « Fenêtre Kama » ; le rond « K » est remplacé par le logo.
 */
import { forwardRef, type ReactNode } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { KamaLogo } from '@/components/kama/primitives';
import { useLangueCourante } from '@/lib/langue-courante';
import { useTexte } from '@/lib/use-texte';

export const KAMA_WINDOW_WIDTH = 360;
export const KAMA_WINDOW_HEIGHT = 520;

export type MicMode = 'idle' | 'listening' | 'thinking' | 'offline';

const MIC_LABEL: Record<MicMode, string> = {
  idle: 'Appuie pour parler',
  listening: 'Appuie pour arrêter',
  thinking: 'Patiente un instant…',
  offline: 'Micro indisponible sans internet',
};

type Props = {
  mic?: MicMode;
  /** false : pas de micro en bas (ex. écran de choix de la langue). */
  avecMicro?: boolean;
  onClose?: () => void;
  onMic?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
};

export const KamaWindow = forwardRef<HTMLElement, Props>(function KamaWindow(
  { mic = 'idle', avecMicro = true, onClose, onMic, className = '', style, children },
  ref,
) {
  const langue = useLangueCourante();
  const micDisabled = mic === 'thinking' || mic === 'offline';
  const micLabel = useTexte(MIC_LABEL[mic]);
  const fermer = useTexte('Fermer Kama');
  const fenetre = useTexte('Fenêtre Kama');

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label={fenetre}
      className={`animate-kama-appear flex flex-col overflow-hidden rounded-2xl border border-kama-ink/10 bg-kama-white shadow-kama outline-none ${className}`}
      style={{ width: KAMA_WINDOW_WIDTH, height: KAMA_WINDOW_HEIGHT, ...style }}
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-kama-ink/10 pl-4 pr-1.5">
        <KamaLogo taille={32} />
        <span className="font-display text-base leading-none text-kama-ink">Kama</span>
        {langue ? (
          <span className="ml-auto rounded-full bg-kama-cream px-3 py-1 text-xs font-semibold text-kama-ink">
            {langue.nom}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={fermer}
          className="hit-44 grid cursor-pointer place-items-center rounded-full border-0 bg-transparent text-kama-ink hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-kama-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

      {avecMicro && (
      <footer className="flex h-[104px] shrink-0 flex-col items-center justify-center gap-1 border-t border-kama-ink/10 bg-kama-white">
        <button
          type="button"
          onClick={onMic}
          disabled={micDisabled}
          aria-label={micLabel}
          aria-pressed={mic === 'listening'}
          className={`grid size-14 cursor-pointer place-items-center rounded-full border-0 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink disabled:cursor-not-allowed ${
            mic === 'listening'
              ? 'bg-kama-ink text-kama-white'
              : micDisabled
                ? 'bg-kama-ink/10 text-kama-ink/40'
                : 'bg-kama-orange text-kama-ink'
          }`}
        >
          {mic === 'listening' ? (
            <Square className="size-6 fill-current" aria-hidden />
          ) : (
            <Mic className="size-7" aria-hidden />
          )}
        </button>
        <span className="text-sm font-medium text-kama-ink">{micLabel}</span>
      </footer>
      )}
    </section>
  );
});
