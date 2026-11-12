/**
 * Page de bienvenue de Kama (CLARIFICATIONS.md, P1) : confirme l'installation, puis 4 étapes :
 *   1. épingler l'icône de Kama ;
 *   2. choisir sa langue (3e endroit prévu pour ce choix, sans langue par défaut) ;
 *   3. autoriser le micro : c'est KAMA qui demande le micro, pas le site de la banque.
 *      Cette page appartient à l'extension, donc le navigateur affiche « Kama souhaite utiliser
 *      votre micro ». L'accord donné ici vaut aussi pour l'envoi de la voix (même texte que dans
 *      la fenêtre Kama) ;
 *   4. ouvrir la page de test.
 * Pas de maquette Lovable pour cette page : elle reprend la charte et les éléments de Kama.
 */
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ExternalLink, Mic, MicOff, Pin, Puzzle } from 'lucide-react';
import { KamaLogo, SpeakButton, TranslationBadge } from '@/components/kama/primitives';
import { LANGUES, trouverLangue } from '@/config/langues';
import { LangueCourante } from '@/lib/langue-courante';
import { reglageConsentementMicro, reglageLangue, useReglage } from '@/lib/reglages';

const PAGE_TEST = 'https://safinum.cm/hackathon-test';

type EtatMicro = 'inconnu' | 'autorise' | 'refuse' | 'absent';

export function Bienvenue() {
  const [idLangue, setIdLangue] = useReglage(reglageLangue);
  const langue = trouverLangue(idLangue);

  return (
    <LangueCourante.Provider value={langue}>
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-kama-white px-6 py-10 text-base text-kama-ink">
        <header className="flex items-center gap-4">
          <KamaLogo taille={64} />
          <div>
            <p className="m-0 font-display text-2xl leading-none">Kama</p>
            <h1 className="m-0 mt-2 text-3xl font-bold leading-tight">Kama est installé !</h1>
          </div>
        </header>
        <p className="m-0 text-lg">
          Kama t'explique ta banque en ligne dans ta langue. Encore 4 petites étapes.
        </p>

        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          <Etape numero={1} titre="Épingle Kama" fait={false}>
            <p className="m-0">
              En haut à droite de Chrome, clique sur la pièce de puzzle{' '}
              <Puzzle className="inline size-5 align-text-bottom" aria-label="pièce de puzzle" />, puis sur l'épingle{' '}
              <Pin className="inline size-5 align-text-bottom" aria-label="épingle" /> à côté de « Kama ».
            </p>
            <p className="m-0 text-kama-ink/70">L'icône de Kama reste alors visible : tu y trouves tes réglages.</p>
          </Etape>

          <Etape numero={2} titre="Choisis ta langue" fait={!!langue}>
            <div className="flex flex-col gap-2">
              {LANGUES.map((l) => {
                const choisie = l.id === idLangue;
                return (
                  <div
                    key={l.id}
                    className={`flex items-center rounded-xl border-2 pr-1 ${choisie ? 'border-kama-orange bg-kama-cream' : 'border-kama-ink bg-kama-white'}`}
                  >
                    <button
                      type="button"
                      onClick={() => setIdLangue(l.id)}
                      aria-pressed={choisie}
                      className="flex min-h-14 flex-1 cursor-pointer items-center gap-3 rounded-l-xl border-0 bg-transparent py-1.5 pl-3 text-left text-kama-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
                    >
                      <span className="flex flex-col">
                        <span className="text-[17px] font-bold leading-tight">{l.nom}</span>
                        <span className="text-sm leading-tight text-kama-ink/70">{l.region}</span>
                      </span>
                      {choisie && (
                        <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold">
                          <Check className="size-5" aria-hidden /> Choisie
                        </span>
                      )}
                    </button>
                    <SpeakButton texte={l.nom} label={`Écouter : ${l.nom}`} />
                  </div>
                );
              })}
              <TranslationBadge />
              <p className="m-0 text-sm text-kama-ink/70">Tu pourras changer de langue à tout moment avec l'icône de Kama.</p>
            </div>
          </Etape>

          <EtapeMicro />

          <Etape numero={4} titre="Essaie Kama" fait={false}>
            <p className="m-0">Ouvre la page de la banque. Touche l'onglet Kama, sur le bord droit de la page.</p>
            <a
              href={PAGE_TEST}
              className="inline-flex min-h-12 items-center gap-2 self-start rounded-full bg-kama-ink px-5 text-[18px] font-bold text-kama-white no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
            >
              Ouvrir la page de la banque <ExternalLink className="size-5" aria-hidden />
            </a>
          </Etape>
        </ol>
      </main>
    </LangueCourante.Provider>
  );
}

/** Étape 3 : autoriser le micro. C'est Kama (cette page de l'extension) qui demande le micro. */
function EtapeMicro() {
  const [, setConsentement] = useReglage(reglageConsentementMicro);
  const [etat, setEtat] = useState<EtatMicro>('inconnu');
  const section = useRef<HTMLLIElement>(null);

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
    if (location.hash === '#micro') {
      section.current?.scrollIntoView({ block: 'center' });
      section.current?.querySelector('button')?.focus();
    }
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
    <Etape ref={section} numero={3} titre="Autorise le micro" fait={etat === 'autorise'}>
      <p className="m-0">Pour parler à Kama et lui poser tes questions.</p>
      <p className="m-0 text-kama-ink/70">Ta voix est envoyée à Kama pour comprendre ta question. Elle n'est pas gardée.</p>
      {etat === 'autorise' ? (
        <p className="m-0 inline-flex items-center gap-2 font-semibold" role="status">
          <Check className="size-5" aria-hidden /> Micro autorisé. Tu peux parler à Kama.
          {location.hash === '#micro' && ' Retourne sur la page de ta banque.'}
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={autoriser}
            className="inline-flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-full border-0 bg-kama-ink px-5 text-[18px] font-bold text-kama-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
          >
            <Mic className="size-5" aria-hidden /> Autoriser le micro
          </button>
          <p className="m-0 text-sm text-kama-ink/70">Chrome va demander : « Kama souhaite utiliser votre micro ». Clique sur « Autoriser ».</p>
        </>
      )}
      {etat === 'refuse' && (
        <p className="m-0 flex items-start gap-2 rounded-xl border-2 border-kama-error p-3" role="alert">
          <MicOff className="mt-0.5 size-5 shrink-0 text-kama-error" aria-hidden />
          <span>
            Le micro est bloqué pour Kama. Clique sur l'icône du micro dans la barre d'adresse de cette page, choisis
            « Autoriser », puis appuie encore sur « Autoriser le micro ».
          </span>
        </p>
      )}
      {etat === 'absent' && (
        <p className="m-0 flex items-start gap-2 rounded-xl border-2 border-kama-error p-3" role="alert">
          <MicOff className="mt-0.5 size-5 shrink-0 text-kama-error" aria-hidden />
          <span>Aucun micro trouvé. Branche un micro ou un casque, puis réessaie.</span>
        </p>
      )}
    </Etape>
  );
}


const Etape = forwardRef<HTMLLIElement, { numero: number; titre: string; fait: boolean; children: ReactNode }>(
  function Etape({ numero, titre, fait, children }, ref) {
    return (
      <li ref={ref} className="flex gap-4 rounded-2xl border border-kama-ink/10 bg-kama-white p-5 shadow-sm">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold ${fait ? 'bg-kama-orange text-kama-ink' : 'bg-kama-ink text-kama-white'}`}
          aria-hidden
        >
          {fait ? <Check className="size-5" /> : numero}
        </span>
        <div className="flex flex-1 flex-col gap-3">
          <h2 className="m-0 text-xl font-bold">
            <span className="sr-only">Étape {numero} : </span>
            {titre}
            {fait && <span className="sr-only"> (fait)</span>}
          </h2>
          {children}
        </div>
      </li>
    );
  },
);
