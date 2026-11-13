/**
 * Briques du contenu de la fenêtre Kama : badge de fiabilité, montant, lecteur audio,
 * réponse, ligne de Kama, bulle de l'utilisateur, bouton secondaire.
 * Repris de la maquette Lovable « Fenêtre Kama » (parts.tsx).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { BadgeCheck, CircleSlash, Languages, Pause, Play, Volume2 } from 'lucide-react';
import { TranslationBadge } from '@/components/kama/primitives';
import { arreterLecture, lireEnFrancais } from '@/lib/voix';
import { useLectureAuto } from '@/lib/langue-courante';

export type TranslationStatus = 'verified' | 'auto' | 'untranslated';

const STATUS = {
  verified: { label: 'Vérifié', Icon: BadgeCheck, cls: 'bg-status-verified text-status-verified-foreground' },
  auto: { label: 'Traduction automatique', Icon: Languages, cls: 'bg-status-auto text-status-auto-foreground' },
  untranslated: {
    label: 'Pas encore traduit',
    Icon: CircleSlash,
    cls: 'bg-status-untranslated text-status-untranslated-foreground',
  },
} as const;

/** Badge en tête de chaque réponse. Icône + texte, jamais la couleur seule. */
export function StatusBadge({ status }: { status: TranslationStatus }) {
  const { label, Icon, cls } = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

/**
 * Montant : toujours en gras, chiffres exactement comme la banque les écrit,
 * jamais coupé en fin de ligne. `children` doit venir tel quel du DOM (règle d'or n° 1).
 */
export function Amount({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <strong className={`whitespace-nowrap font-bold tabular-nums ${className}`}>{children}</strong>;
}

/** ▶ + barre de progression + vitesse 1x / 0,75x. Hauteur 44 px. */
export function AudioPlayer({ text }: { text: string }) {
  const [rate, setRate] = useState<1 | 0.75>(1);
  const [playing, setPlaying] = useState(false);
  const lectureAuto = useLectureAuto();

  // Préférence « Audio » : lecture automatique à l'ouverture.
  // Dans tous les cas, la lecture s'arrête si le contenu change ou si la fenêtre se ferme.
  useEffect(() => {
    if (lectureAuto) {
      setPlaying(true);
      lireEnFrancais(text, 1, () => setPlaying(false));
    }
    return () => arreterLecture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    if (playing) {
      arreterLecture();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    lireEnFrancais(text, rate, () => setPlaying(false));
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-kama-cream p-1 pr-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Mettre en pause' : 'Écouter la réponse'}
        className="hit-44 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-kama-orange text-kama-ink focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 translate-x-px" aria-hidden />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* La voix du navigateur ne donne pas sa progression : la barre sera active avec les audios enregistrés. */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-kama-ink/15" aria-hidden>
          <div className="h-full w-0 rounded-full bg-kama-ink" />
        </div>
        <span className="text-[11px] text-kama-ink/70">{playing ? 'Lecture…' : 'Prêt à lire'}</span>
      </div>
      <div className="flex shrink-0 rounded-full bg-kama-white p-0.5" role="group" aria-label="Vitesse de lecture">
        {([1, 0.75] as const).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={rate === r}
            onClick={() => setRate(r)}
            className={`hit-44 cursor-pointer rounded-full border-0 px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-kama-ink ${
              rate === r ? 'bg-kama-ink text-kama-white' : 'bg-transparent text-kama-ink'
            }`}
          >
            {r === 1 ? '1x' : '0,75x'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Une réponse de Kama : badge en haut, lecteur audio, puis le texte. `speech` = texte lu. */
export function KamaResponse({
  status,
  speech,
  children,
}: {
  status: TranslationStatus;
  speech: string;
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <StatusBadge status={status} />
        <TranslationBadge />
      </div>
      <AudioPlayer text={speech} />
      <div className="flex flex-col gap-2 text-[15px] leading-snug text-kama-ink">{children}</div>
    </article>
  );
}

/** Courte phrase de Kama hors réponse (consigne, message système), avec son bouton haut-parleur. */
export function KamaLine({ speech, children }: { speech: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 text-[15px] leading-snug text-kama-ink">
        {children}
        <span className="mt-1.5 block">
          <TranslationBadge />
        </span>
      </div>
      <button
        type="button"
        onClick={() => lireEnFrancais(speech)}
        aria-label="Écouter"
        className="hit-44 grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-kama-cream text-kama-ink focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        <Volume2 className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** Question de l'utilisateur, transcrite. */
export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[11px] font-semibold text-kama-ink/60">Toi</span>
      <p className="m-0 max-w-[85%] rounded-2xl rounded-br-md bg-kama-ink px-3.5 py-2.5 text-[15px] leading-snug text-kama-white">
        {children}
      </p>
    </div>
  );
}

/** Action secondaire dans la fenêtre (Montre-moi, Réessayer…). 44 px de haut. */
export function WindowButton({
  children,
  onClick,
  variant = 'outline',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'outline' | 'solid';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hit-44 inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink ${
        variant === 'solid' ? 'border-0 bg-kama-ink text-kama-white' : 'border-2 border-kama-ink bg-kama-white text-kama-ink'
      }`}
    >
      {children}
    </button>
  );
}
