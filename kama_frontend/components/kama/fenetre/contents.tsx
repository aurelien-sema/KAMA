/**
 * Contenus de la fenêtre Kama, un par état.
 * Repris de la maquette Lovable « Fenêtre Kama » (contents.tsx), avec deux changements :
 *  - icônes lucide à la place des emojis ;
 *  - textes et montants passés en paramètres : ils viendront de la page bancaire (DOM),
 *    jamais d'un modèle de langue (règle d'or n° 1). Les données d'exemple sont dans `exemples.ts`.
 */
import { useState, type ReactNode } from 'react';
import { AlertTriangle, Eye, Mic, ShieldCheck, Volume2, WifiOff } from 'lucide-react';
import { jouerAnnonce } from '@/lib/annonces';
import type { Parole } from '@/lib/traduction';
import { useTexte } from '@/lib/use-texte';
import { aplatir, useReponse } from '@/lib/use-reponse';
import { KamaLine, KamaResponse, UserBubble, WindowButton, type TranslationStatus } from './parts';

export type Etape = { cible: string; texte: string };

/** Bouton « Montre-moi » : fait défiler jusqu'à l'élément et le surligne (étape suivante). */
export function MontreMoi({ onClick }: { onClick?: () => void }) {
  const libelle = useTexte('Montre-moi');
  return (
    <WindowButton onClick={onClick}>
      <Eye className="size-4" aria-hidden /> {libelle}
    </WindowButton>
  );
}

/* 1 — Parler : attente */
export function TalkIdleContent() {
  const text = "Pose ta question. Par exemple : qu'est-ce que je dois faire ici ?";
  const r = useReponse([['Pose ta question.'], ["Par exemple : « qu'est-ce que je dois faire ici ? »"]]);
  const [t1, t2] = r.lignes.map(aplatir);
  return (
    <div className="flex h-full flex-col justify-end gap-3">
      <KamaLine speech={text} paroles={r.paroles}>
        <p className="m-0 font-semibold">{t1}</p>
        <p className="m-0 mt-1 text-kama-ink/80">{t2}</p>
      </KamaLine>
    </div>
  );
}

/* 2 — Parler : écoute. Les barres suivent le niveau du micro (aucune animation en boucle). */
const WAVE = [8, 14, 22, 30, 18, 36, 26, 40, 20, 32, 14, 24, 34, 16, 28, 10, 20, 12];
export function TalkListeningContent({ niveaux }: { niveaux?: number[] }) {
  const microActif = useTexte('Micro actif');
  const r = useReponse([["Je t'écoute. Parle maintenant."]]);
  // Sans niveaux : les barres de la maquette. Avec : de 6 à 40 px selon le son.
  const barres = niveaux ? WAVE.map((_, i) => 6 + Math.round((niveaux[i] ?? 0) * 34)) : WAVE;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <span className="inline-flex items-center gap-2 rounded-full bg-kama-cream px-3 py-1.5 text-sm font-semibold text-kama-ink">
        <Mic className="size-4" aria-hidden />
        {microActif}
      </span>
      <div className="flex h-12 items-center gap-1" aria-hidden>
        {barres.map((h, i) => (
          <span key={i} className="w-1.5 rounded-full bg-kama-orange" style={{ height: h }} />
        ))}
      </div>
      <div className="w-full">
        <KamaLine speech="Je t'écoute. Parle maintenant." paroles={r.paroles}>
          <p className="m-0 text-center font-semibold">{aplatir(r.lignes[0]!)}</p>
        </KamaLine>
      </div>
    </div>
  );
}

/* 3 — Parler : réflexion */
export function TalkThinkingContent({ question }: { question?: string }) {
  const reflechit = useTexte('Kama réfléchit…').replace(/[.…]$/, '');
  return (
    <div className="flex h-full flex-col justify-end gap-4">
      {question && <UserBubble>{question}</UserBubble>}
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-kama-cream px-4 py-3" role="status">
        <span className="text-[15px] font-semibold text-kama-ink">{reflechit}</span>
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-kama-appear size-2 rounded-full bg-kama-ink"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}

/* 5 — Expliquer cette page : 1 phrase + étapes numérotées, chacune avec « Montre-moi » */
export function ExplainPageContent({
  phrase,
  etapes,
  onShowMe,
  status = 'auto',
  paroles,
  speechFr,
}: {
  phrase: string;
  etapes: Etape[];
  onShowMe?: (cible: string) => void;
  status?: TranslationStatus;
  paroles?: Parole[];
  speechFr?: string;
}) {
  const montreMoi = useTexte('Montre-moi');
  return (
    <KamaResponse
      status={status}
      paroles={paroles}
      speech={speechFr ?? `${phrase} ${etapes.map((s, i) => `${i + 1}. ${s.texte}`).join(' ')}`}
    >
      <p className="m-0 font-semibold">{phrase}</p>
      {/* Chaque étape est elle-même le bouton « Montre-moi » (décision d'Omar du 2026-11-13). */}
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {etapes.map((s, i) => (
          <li key={s.cible}>
            <button
              type="button"
              onClick={() => onShowMe?.(s.cible)}
              aria-label={`${s.texte} ${montreMoi}`}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-kama-ink/10 bg-kama-white py-1.5 pl-2 pr-3 text-left text-kama-ink hover:border-kama-ink/30 hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-kama-ink text-sm font-bold text-kama-white">
                {i + 1}
              </span>
              <span className="flex-1 text-sm leading-tight">{s.texte}</span>
              <Eye className="size-5 shrink-0" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </KamaResponse>
  );
}

/* 9 — Erreur bancaire expliquée : message original affiché + explication sans minimiser */
export function BankErrorContent({
  messageBanque,
  code,
  titre,
  conseil,
  status = 'verified',
  paroles,
  messageTraduit,
  speechFr,
}: {
  messageBanque: string;
  code?: string;
  titre: string;
  conseil?: string;
  status?: TranslationStatus;
  paroles?: Parole[];
  /** Message de la banque dans la langue choisie, avec son propre badge, sous le message original. */
  messageTraduit?: ReactNode;
  speechFr?: string;
}) {
  const speech = speechFr ?? [titre, conseil ?? ''].filter(Boolean).join(' ');
  const messageDeLaBanque = useTexte('Message de la banque');
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-bank-border bg-bank-bg p-3">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-bank-muted">{messageDeLaBanque}</p>
        <p className="m-0 mt-1 text-sm font-medium text-bank-text">{messageBanque}</p>
        {code && <p className="m-0 mt-1 font-mono text-[11px] text-bank-muted">{code}</p>}
      </div>
      {messageTraduit}
      <KamaResponse status={status} speech={speech} paroles={paroles}>
        <div className="flex gap-2.5 rounded-xl border-2 border-kama-error p-3" role="alert">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-kama-error" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="m-0 font-semibold">{titre}</p>
            {conseil && <p className="m-0">{conseil}</p>}
          </div>
        </div>
      </KamaResponse>
    </div>
  );
}

/* 11 — Traduction indisponible : texte original + annonce audio en pidgin (aucun repli français) */
export function UntranslatedContent({
  texte,
  langue,
  onShowMe,
}: {
  texte: string;
  langue?: string;
  /** Texte venu de la page (nouveau message) : « Montre-moi » le retrouve. */
  onShowMe?: () => void;
}) {
  const inexistant = useTexte("Ce texte n'existe pas encore dans ta langue.");
  const ecouterMessage = useTexte('Écouter le message');
  const pasDeTraduction = useTexte("Kama n'arrive pas bien à traduire ce texte. Lis-le bien ou demande à ta banque.");
  const [note, setNote] = useState(false);
  return (
    <article className="flex flex-col gap-3">
      <p className="m-0 text-[15px] leading-snug text-kama-ink">{texte}</p>
      <p className="m-0 text-sm text-kama-ink/70">
        {langue ? inexistant : "Ce texte n'existe pas encore dans ta langue."}
      </p>
      <div>
        <WindowButton
          onClick={() => {
            void jouerAnnonce('traduction').then((ok) => setNote(!ok));
          }}
        >
          <Volume2 className="size-4" aria-hidden /> {ecouterMessage}
        </WindowButton>
      </div>
      {note && (
        <p role="status" className="m-0 text-sm text-kama-ink/70">
          {pasDeTraduction}
        </p>
      )}
      {onShowMe && (
        <div>
          <MontreMoi onClick={onShowMe} />
        </div>
      )}
    </article>
  );
}

/* 12 — Réflexion en attendant la traduction ou le serveur (court : le glossaire local répond tout de suite) */
export function Reflexion() {
  return <TalkThinkingContent />;
}

/* 13 — Pas de connexion au serveur : la réponse reste affichée en français, avec une icône, une phrase et « Réessayer » (UX 3.8) */
export function BandeauHorsLigne({ onRetry }: { onRetry?: () => void }) {
  const reessayer = useTexte('Réessayer');
  const pasInternet = useTexte('Pas de connexion internet.');
  const enFrancais = useTexte('Kama montre la réponse en français.');
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border-2 border-kama-ink p-3" role="alert">
      <p className="m-0 flex items-start gap-2 text-sm text-kama-ink">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">{pasInternet}</span> {enFrancais}
        </span>
      </p>
      <div>
        <WindowButton variant="solid" onClick={onRetry}>
          {reessayer}
        </WindowButton>
      </div>
    </div>
  );
}

/* 15 — Consentement (premier usage, et séparément pour le micro) : aucune fonction ne démarre avant l'accord */
export function ConsentementContent({
  titre,
  points,
  accepter,
  refuser,
  status = 'untranslated',
  paroles,
  speechFr,
  onAccepter,
  onRefuser,
}: {
  titre: string;
  points: string[];
  accepter: string;
  refuser: string;
  status?: TranslationStatus;
  paroles?: Parole[];
  speechFr?: string;
  onAccepter: () => void;
  onRefuser: () => void;
}) {
  return (
    <KamaResponse status={status} paroles={paroles} speech={speechFr ?? [titre, ...points].join(' ')}>
      <p className="m-0 flex items-start gap-2 font-semibold">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span>{titre}</span>
      </p>
      <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm">
        {points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div className="mt-1 flex flex-wrap gap-2">
        <WindowButton variant="solid" onClick={onAccepter}>
          {accepter}
        </WindowButton>
        <WindowButton onClick={onRefuser}>{refuser}</WindowButton>
      </div>
    </KamaResponse>
  );
}

/* 16 — Texte sélectionné, traduit : la traduction avec son badge, puis le texte original de la page */
export function SelectionTraduiteContent({
  original,
  traduction,
  status,
  paroles,
}: {
  original: string;
  traduction: ReactNode;
  status: TranslationStatus;
  paroles?: Parole[];
}) {
  const texteDeLaPage = useTexte('Texte de la page :');
  return (
    <KamaResponse status={status} paroles={paroles} speech={original}>
      <p className="m-0 text-[15px] leading-snug">{traduction}</p>
      <p className="m-0 border-t border-kama-ink/10 pt-2 text-sm text-kama-ink/70">
        {texteDeLaPage} <span className="text-kama-ink">{original}</span>
      </p>
    </KamaResponse>
  );
}
