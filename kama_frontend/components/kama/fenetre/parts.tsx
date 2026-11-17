/**
 * Briques du contenu de la fenêtre Kama : indicateur de fiabilité, montant, lecteur audio,
 * réponse, ligne de Kama, bulle de l'utilisateur, bouton secondaire.
 * Repris de la maquette Lovable « Fenêtre Kama » (parts.tsx).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CircleSlash, Languages, Pause, Play, Volume2 } from 'lucide-react';
import { arreterLecture } from '@/lib/voix';
import { useLectureAuto } from '@/lib/langue-courante';
import { traduireKama, useTexte } from '@/lib/use-texte';
import { useLangueCourante } from '@/lib/langue-courante';
import { jouerParoles, prechargerParoles } from '@/lib/audio';
import type { Parole } from '@/lib/traduction';

export type TranslationStatus = 'verified' | 'auto' | 'untranslated';

const STATUS = {
  auto: { label: 'Traduction automatique', Icon: Languages },
  untranslated: { label: 'Pas encore traduit', Icon: CircleSlash },
} as const;

/**
 * Indicateur de fiabilité (règle d'or n° 4), discret (décision d'Omar du 2026-11-13) : une petite icône, sans texte.
 * Son nom (« Pas encore traduit », « Traduction automatique ») s'affiche au survol et est lu par les lecteurs d'écran.
 * Texte vérifié par un locuteur : aucune icône.
 */
export function StatusBadge({ status }: { status: TranslationStatus }) {
  const info = status === 'verified' ? null : STATUS[status];
  const label = useTexte(info?.label ?? '');
  if (!info) return null;
  const { Icon } = info;
  return (
    <span role="img" aria-label={label} title={label} className="grid size-6 shrink-0 place-items-center text-kama-ink/55">
      <Icon className="size-4" aria-hidden />
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

/**
 * ▶ + barre de progression + vitesse 1x / 0,75x. Hauteur 44 px.
 * `paroles` : la réponse dans la langue choisie, lue par le serveur. Sans elles (ou si le serveur ne peut pas parler),
 * aucune lecture : la ligne d'état affiche une annonce en pidgin.
 */
export function AudioPlayer({ paroles }: { paroles?: Parole[] }) {
  const [rate, setRate] = useState<1 | 0.75>(1);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const lectureAuto = useLectureAuto();
  const code = useLangueCourante()?.code;
  const t = (fr: string) => traduireKama(code, fr);
  const notePasDeVoix = "Kama n'arrive pas à joindre le serveur. Réessaie dans un instant.";

  async function demarrer(vitesse: number) {
    setPlaying(true);
    if (paroles?.length) {
      try {
        const voix = await jouerParoles(paroles, vitesse);
        setNote(voix === 'automatique' ? 'Voix automatique' : null);
        setPlaying(false);
        return;
      } catch {
        // Le serveur ne peut pas parler : aucune lecture, l'annonce pidgin le dit.
      }
    }
    setNote(notePasDeVoix);
    setPlaying(false);
  }

  // Préférence « Audio » : lecture automatique à l'ouverture.
  // Dans tous les cas, la lecture s'arrête si le contenu change ou si la fenêtre se ferme.
  useEffect(() => {
    prechargerParoles(paroles); // l'audio se prépare pendant que la personne lit
    if (lectureAuto) void demarrer(1);
    return () => arreterLecture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    if (playing) {
      arreterLecture();
      setPlaying(false);
      return;
    }
    void demarrer(rate);
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-kama-cream p-1 pr-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('Mettre en pause') : t('Écouter la réponse')}
        className="hit-44 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-kama-orange text-kama-ink focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5 translate-x-px" aria-hidden />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* La voix du navigateur ne donne pas sa progression : la barre sera active avec les audios enregistrés. */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-kama-ink/15" aria-hidden>
          <div className="h-full w-0 rounded-full bg-kama-ink" />
        </div>
        <span className="text-[11px] text-kama-ink/70">{playing ? t('Lecture…') : t(note ?? 'Prêt à lire')}</span>
      </div>
      <div className="flex shrink-0 rounded-full bg-kama-white p-0.5" role="group" aria-label={t('Vitesse de lecture')}>
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

/** Une réponse de Kama : lecteur audio (avec l'indicateur de fiabilité à côté), puis le texte. */
export function KamaResponse({
  status,
  paroles,
  children,
}: {
  status: TranslationStatus;
  /** Texte français conservé pour les appelants existants ; l'audio ne vient que de `paroles`. */
  speech: string;
  paroles?: Parole[];
  children: ReactNode;
}) {
  return (
    <article className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <AudioPlayer paroles={paroles} />
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex flex-col gap-2 text-[15px] leading-snug text-kama-ink">{children}</div>
    </article>
  );
}

/** Courte phrase de Kama hors réponse (consigne, message système), avec son bouton haut-parleur. */
export function KamaLine({ paroles, children }: { speech: string; paroles?: Parole[]; children: ReactNode }) {
  const ecouter = useTexte('Écouter');
  const pasDeVoix = useTexte("Kama n'arrive pas à joindre le serveur. Réessaie dans un instant.");
  const [note, setNote] = useState(false);
  useEffect(() => prechargerParoles(paroles), [paroles]);
  async function lire() {
    setNote(false);
    if (paroles?.length) {
      try {
        await jouerParoles(paroles);
        return;
      } catch {
        // Le serveur ne peut pas parler : aucune lecture, l'annonce pidgin le dit.
      }
    }
    setNote(true);
  }
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 text-[15px] leading-snug text-kama-ink">
        {children}
        {note && (
          <span role="status" className="mt-1 block text-[11px] text-kama-ink/70">
            {pasDeVoix}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => void lire()}
        aria-label={ecouter}
        className="hit-44 grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-kama-cream text-kama-ink focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        <Volume2 className="size-5" aria-hidden />
      </button>
    </div>
  );
}

/** Question de l'utilisateur, transcrite. */
export function UserBubble({ children }: { children: ReactNode }) {
  const toi = useTexte('Toi');
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[11px] font-semibold text-kama-ink/60">{toi}</span>
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
