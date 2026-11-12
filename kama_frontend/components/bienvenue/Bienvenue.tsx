/**
 * Page d'accueil de Kama, ouverte toute seule à l'installation (CLARIFICATIONS.md, P1).
 *
 * Un seul écran, sans défilement (décision d'Omar du 2026-11-12) :
 *   1. un grand titre orange et les langues côte à côte ; Bamoun et Fulfulde sont grisés, non activables ;
 *   2. dès qu'une langue est choisie, trois étapes apparaissent en dessous : épingler Kama, autoriser le micro
 *      (c'est KAMA qui le demande, pas le site de la banque), ouvrir la page de la banque.
 * Les textes passent par la traduction : langue choisie, sinon langue du navigateur (français ou anglais).
 * Ils sont volontairement courts : peu de phrases à faire traduire et valider en langue nationale.
 */
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Check, ExternalLink, Mic, MicOff, Pin, Puzzle } from 'lucide-react';
import { KamaLogo, SpeakButton, TranslationBadge } from '@/components/kama/primitives';
import { LANGUES, LANGUES_A_VENIR, trouverLangue } from '@/config/langues';
import { LangueCourante, useLangueCourante } from '@/lib/langue-courante';
import { reglageConsentementMicro, reglageLangue, useReglage } from '@/lib/reglages';
import { traduireKama } from '@/lib/use-texte';

const PAGE_TEST = 'https://safinum.cm/hackathon-test';

type EtatMicro = 'inconnu' | 'autorise' | 'refuse' | 'absent';

export function Bienvenue() {
  const [idLangue] = useReglage(reglageLangue);
  return (
    <LangueCourante.Provider value={trouverLangue(idLangue)}>
      <Accueil />
    </LangueCourante.Provider>
  );
}

/** Traduction d'un texte fixe de la page : langue choisie, sinon langue du navigateur. */
function useTraduction() {
  const langue = useLangueCourante();
  return (texte: string) => traduireKama(langue?.code, texte);
}

function Accueil() {
  const [idLangue, setIdLangue] = useReglage(reglageLangue);
  const langue = trouverLangue(idLangue);
  const t = useTraduction();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-8 py-8 text-base text-kama-ink">
      <header className="flex items-center gap-6">
        <span className="animate-kama-appear grid size-28 shrink-0 place-items-center rounded-full bg-kama-cream">
          <KamaLogo taille={88} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-[40px] leading-[1.15] text-kama-orange">{t('Bienvenue ! Choisis ta langue.')}</h1>
          <p className="m-0 text-xl">{t('Kama t’explique ta banque en ligne dans ta langue.')}</p>
        </div>
      </header>

      <section aria-label={t('Choisir ma langue')} className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {LANGUES.map((l) => (
            <CarteLangue
              key={l.id}
              nom={l.nom}
              region={t(l.region)}
              choisie={l.id === idLangue}
              onChoisir={() => setIdLangue(l.id)}
            />
          ))}
          {LANGUES_A_VENIR.map((l) => (
            <CarteLangue key={l.id} nom={l.nom} region={t(l.region)} />
          ))}
        </div>
        <div className="self-end">
          <TranslationBadge />
        </div>
      </section>

      {langue && <Etapes />}
    </main>
  );
}

/** Une langue : grande carte cliquable. Sans `onChoisir`, la langue n'est pas encore disponible (grisée, désactivée). */
function CarteLangue({
  nom,
  region,
  choisie = false,
  onChoisir,
}: {
  nom: string;
  region: string;
  choisie?: boolean;
  onChoisir?: () => void;
}) {
  const t = useTraduction();
  const disponible = !!onChoisir;
  return (
    <div
      className={`relative flex min-h-32 rounded-2xl border-2 transition-colors ${
        !disponible
          ? 'border-dashed border-kama-ink/25 bg-bank-bg opacity-60'
          : choisie
            ? 'border-kama-orange bg-kama-cream shadow-md'
            : 'border-kama-ink bg-kama-white hover:bg-kama-cream'
      }`}
    >
      <button
        type="button"
        onClick={onChoisir}
        disabled={!disponible}
        aria-pressed={disponible ? choisie : undefined}
        className="flex flex-1 cursor-pointer flex-col items-start justify-start gap-1 rounded-2xl border-0 bg-transparent p-4 pr-14 pt-5 text-left text-kama-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 text-[22px] font-bold leading-tight">
          {choisie && (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-kama-orange text-kama-ink">
              <Check className="size-5" aria-hidden />
            </span>
          )}
          {nom}
        </span>
        <span className="text-[15px] leading-tight text-kama-ink/75">{region}</span>
      </button>
      {disponible && (
        <span className="absolute right-2 top-2.5">
          <SpeakButton texte={nom} label={`${t('Écouter :')} ${nom}`} />
        </span>
      )}
    </div>
  );
}

/** Les trois étapes, affichées une fois la langue choisie. */
function Etapes() {
  const t = useTraduction();
  return (
    <ol className="animate-kama-appear m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-3">
      <Etape numero={1} titre={t('Épingle Kama')}>
        <p className="m-0 flex items-center gap-2">
          <Puzzle className="size-6" aria-label={t('pièce de puzzle')} />
          <span aria-hidden>→</span>
          <Pin className="size-6" aria-label={t('épingle')} />
        </p>
        <p className="m-0 text-[15px]">{t('En haut à droite de ton navigateur.')}</p>
      </Etape>
      <EtapeMicro />
      <Etape numero={3} titre={t('Essaie Kama')}>
        <a
          href={PAGE_TEST}
          className="inline-flex min-h-12 items-center gap-2 self-start rounded-full bg-kama-ink px-5 text-[17px] font-bold text-kama-white no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
        >
          {t('Ouvrir ma banque')} <ExternalLink className="size-5" aria-hidden />
        </a>
      </Etape>
    </ol>
  );
}

/** Étape 2 : autoriser le micro. C'est Kama (cette page de l'extension) qui demande le micro. */
function EtapeMicro() {
  const t = useTraduction();
  const [, setConsentement] = useReglage(reglageConsentementMicro);
  const [etat, setEtat] = useState<EtatMicro>('inconnu');
  const etape = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // Micro déjà autorisé pour Kama ?
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((p) => {
        if (p.state === 'granted') setEtat('autorise');
        if (p.state === 'denied') setEtat('refuse');
      })
      .catch(() => {});
    // Ouverte depuis la fenêtre Kama (« Autoriser le micro ») : on va droit à cette étape.
    if (location.hash === '#micro') etape.current?.querySelector('button')?.focus();
  }, []);

  async function autoriser() {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      flux.getTracks().forEach((piste) => piste.stop()); // on ne garde rien : c'était juste l'autorisation
      setConsentement(true);
      setEtat('autorise');
    } catch (e) {
      setEtat((e as DOMException)?.name === 'NotFoundError' ? 'absent' : 'refuse');
    }
  }

  return (
    <Etape ref={etape} numero={2} titre={t('Autorise le micro')} fait={etat === 'autorise'}>
      {etat === 'autorise' ? (
        <p className="m-0 inline-flex items-center gap-2 font-semibold" role="status">
          <Check className="size-5" aria-hidden /> {t('Micro autorisé.')}
        </p>
      ) : etat === 'inconnu' ? (
        <button
          type="button"
          onClick={autoriser}
          className="inline-flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-full border-0 bg-kama-ink px-5 text-[17px] font-bold text-kama-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
        >
          <Mic className="size-5" aria-hidden /> {t('Autoriser le micro')}
        </button>
      ) : (
        <p className="m-0 flex items-start gap-2 text-[15px]" role="alert">
          <MicOff className="mt-0.5 size-5 shrink-0 text-kama-error" aria-hidden />
          {etat === 'absent'
            ? t('Aucun micro trouvé. Branche un micro ou un casque, puis réessaie.')
            : t("Micro bloqué. Clique sur l'icône du micro dans la barre d'adresse, puis « Autoriser ».")}
        </p>
      )}
      <p className="m-0 text-sm text-kama-ink/75">{t('Ta voix sert seulement à comprendre ta question. Elle n’est pas gardée.')}</p>
    </Etape>
  );
}

type PropsEtape = { numero: number; titre: string; fait?: boolean; children: ReactNode; ref?: Ref<HTMLLIElement> };

function Etape({ numero, titre, fait = false, children, ref }: PropsEtape) {
  const t = useTraduction();
  return (
    <li ref={ref} className="flex flex-col gap-3 rounded-2xl border border-kama-ink/10 bg-kama-white p-5 shadow-sm">
      <h2 className="m-0 flex items-center gap-3 text-lg font-bold">
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full text-base font-bold ${fait ? 'bg-kama-orange text-kama-ink' : 'bg-kama-ink text-kama-white'}`}
          aria-hidden
        >
          {fait ? <Check className="size-4" /> : numero}
        </span>
        <span className="sr-only">{t(`Étape ${numero} :`)} </span>
        {titre}
        {fait && <span className="sr-only"> {t('(fait)')}</span>}
      </h2>
      {children}
    </li>
  );
}
