/**
 * La fenêtre Kama unique : en-tête fixe + contenu qui défile + barre de saisie en bas
 * (champ « Écris ta question », flèche d'envoi, et micro rond à côté, comme une messagerie).
 * Seul le contenu change d'une action à l'autre (règle d'or n° 6).
 * Repris de la maquette Lovable « Fenêtre Kama » ; le rond « K » est remplacé par le logo.
 */
import { forwardRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUp, Mic, Square, X } from 'lucide-react';
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
  /** Question écrite : envoyée à Kama comme une question orale. */
  onEnvoyer?: (texte: string) => void;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
};

export const KamaWindow = forwardRef<HTMLElement, Props>(function KamaWindow(
  { mic = 'idle', avecMicro = true, onClose, onMic, onEnvoyer, className = '', style, children },
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

      {avecMicro && <BarreSaisie mic={mic} micLabel={micLabel} micDisabled={micDisabled} onMic={onMic} onEnvoyer={onEnvoyer} />}
    </section>
  );
});

/**
 * Barre de saisie : champ arrondi + flèche d'envoi (visible dès qu'on écrit) + micro rond à droite.
 * Entrée envoie. Zones cliquables de 44 px au moins ; pendant l'écoute, le champ est en pause et le micro devient « arrêter ».
 */
function BarreSaisie({
  mic,
  micLabel,
  micDisabled,
  onMic,
  onEnvoyer,
}: {
  mic: MicMode;
  micLabel: string;
  micDisabled: boolean;
  onMic?: () => void;
  onEnvoyer?: (texte: string) => void;
}) {
  const [texte, setTexte] = useState('');
  const placeholder = useTexte(mic === 'listening' ? "Je t'écoute…" : 'Écris ta question…');
  const etiquette = useTexte('Écris ta question à Kama');
  const envoyer = useTexte('Envoyer');
  const occupe = mic === 'listening' || mic === 'thinking';
  const pret = texte.trim().length > 0 && !occupe && !!onEnvoyer;

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!pret) return;
    onEnvoyer!(texte.trim());
    setTexte('');
  }

  return (
    <footer className="flex shrink-0 items-center gap-2 border-t border-kama-ink/10 bg-kama-white px-3 py-3">
      {onEnvoyer && (
        <form
          onSubmit={soumettre}
          className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-kama-ink/15 bg-kama-cream/50 pl-4 pr-1 transition-colors focus-within:border-kama-ink focus-within:bg-kama-white"
        >
          <input
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            disabled={occupe}
            maxLength={300}
            placeholder={placeholder}
            aria-label={etiquette}
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-kama-ink outline-none placeholder:text-kama-ink/55 disabled:cursor-not-allowed"
          />
          {pret && (
            <button
              type="submit"
              aria-label={envoyer}
              title={envoyer}
              className="hit-44 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-kama-ink text-kama-white transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
            >
              <ArrowUp className="size-5" aria-hidden />
            </button>
          )}
        </form>
      )}
      <button
        type="button"
        onClick={onMic}
        disabled={micDisabled}
        aria-label={micLabel}
        title={micLabel}
        aria-pressed={mic === 'listening'}
        className={`grid size-12 shrink-0 cursor-pointer place-items-center rounded-full border-0 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink disabled:cursor-not-allowed ${
          mic === 'listening' ? 'bg-kama-ink text-kama-white' : micDisabled ? 'bg-kama-ink/10 text-kama-ink/40' : 'bg-kama-orange text-kama-ink'
        } ${onEnvoyer ? '' : 'mx-auto size-14'}`}
      >
        {mic === 'listening' ? <Square className="size-5 fill-current" aria-hidden /> : <Mic className="size-6" aria-hidden />}
      </button>
    </footer>
  );
}
