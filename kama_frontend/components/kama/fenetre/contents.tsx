/**
 * Contenus de la fenêtre Kama, un par état.
 * Repris de la maquette Lovable « Fenêtre Kama » (contents.tsx), avec deux changements :
 *  - icônes lucide à la place des emojis ;
 *  - textes et montants passés en paramètres : ils viendront de la page bancaire (DOM),
 *    jamais d'un modèle de langue (règle d'or n° 1). Les données d'exemple sont dans `exemples.ts`.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, Eye, Mic, ShieldCheck, Volume2, WifiOff } from 'lucide-react';
import { TranslationBadge } from '@/components/kama/primitives';
import { lireEnFrancais } from '@/lib/voix';
import type { Parole } from '@/lib/traduction';
import { Amount, KamaLine, KamaResponse, StatusBadge, UserBubble, WindowButton, type TranslationStatus } from './parts';

export type Etape = { cible: string; texte: string };
export type Operation = { date: string; libelle: string; montant: string; sens: 'entree' | 'sortie' };

/** Bouton « Montre-moi » : fait défiler jusqu'à l'élément et le surligne (étape suivante). */
export function MontreMoi({ onClick }: { onClick?: () => void }) {
  return (
    <WindowButton onClick={onClick}>
      <Eye className="size-4" aria-hidden /> Montre-moi
    </WindowButton>
  );
}

/* 1 — Parler : attente */
export function TalkIdleContent() {
  const text = "Pose ta question. Par exemple : qu'est-ce que je dois faire ici ?";
  return (
    <div className="flex h-full flex-col justify-end gap-3">
      <KamaLine speech={text}>
        <p className="m-0 font-semibold">Pose ta question.</p>
        <p className="m-0 mt-1 text-kama-ink/80">Par exemple : « qu'est-ce que je dois faire ici ? »</p>
      </KamaLine>
    </div>
  );
}

/* 2 — Parler : écoute. Les barres suivront le niveau du micro (aucune animation en boucle). */
const WAVE = [8, 14, 22, 30, 18, 36, 26, 40, 20, 32, 14, 24, 34, 16, 28, 10, 20, 12];
export function TalkListeningContent() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <span className="inline-flex items-center gap-2 rounded-full bg-kama-cream px-3 py-1.5 text-sm font-semibold text-kama-ink">
        <Mic className="size-4" aria-hidden />
        Micro actif
      </span>
      <div className="flex h-12 items-center gap-1" aria-hidden>
        {WAVE.map((h, i) => (
          <span key={i} className="w-1.5 rounded-full bg-kama-orange" style={{ height: h }} />
        ))}
      </div>
      <div className="w-full">
        <KamaLine speech="Je t'écoute. Parle maintenant.">
          <p className="m-0 text-center font-semibold">Je t'écoute. Parle maintenant.</p>
        </KamaLine>
      </div>
    </div>
  );
}

/* 3 — Parler : réflexion */
export function TalkThinkingContent({ question }: { question?: string }) {
  return (
    <div className="flex h-full flex-col justify-end gap-4">
      {question && <UserBubble>{question}</UserBubble>}
      <div className="flex items-center gap-3 rounded-2xl rounded-bl-md bg-kama-cream px-4 py-3" role="status">
        <span className="text-[15px] font-semibold text-kama-ink">Kama réfléchit</span>
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

/* 4 — Parler : réponse (exemple de la maquette : question sur les frais) */
export function TalkAnswerContent({ question, frais }: { question: string; frais: string }) {
  return (
    <div className="flex flex-col gap-4">
      <UserBubble>{question}</UserBubble>
      <KamaResponse
        status="verified"
        speech={`Les frais sont de ${frais}. C'est ce que la banque prend pour faire le transfert.`}
      >
        <p className="m-0">
          Les frais sont de <Amount>{frais}</Amount>.
        </p>
        <p className="m-0">C'est ce que la banque prend pour faire le transfert.</p>
      </KamaResponse>
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
}: {
  phrase: string;
  etapes: Etape[];
  onShowMe?: (cible: string) => void;
  status?: TranslationStatus;
  paroles?: Parole[];
}) {
  return (
    <KamaResponse status={status} paroles={paroles} speech={`${phrase} ${etapes.map((s, i) => `${i + 1}. ${s.texte}`).join(' ')}`}>
      <p className="m-0 font-semibold">{phrase}</p>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {etapes.map((s, i) => (
          <li key={s.cible} className="flex items-center gap-2.5 rounded-xl border border-kama-ink/10 py-px pl-2 pr-px">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-kama-ink text-sm font-bold text-kama-white">
              {i + 1}
            </span>
            <span className="flex-1 text-sm leading-tight">{s.texte}</span>
            <MontreMoi onClick={() => onShowMe?.(s.cible)} />
          </li>
        ))}
      </ol>
    </KamaResponse>
  );
}

/* 6 — Résumer mes transactions */
export function SummaryContent({
  entrees,
  sorties,
  operations,
  status = 'verified',
  bilan,
  introListe,
  paroles,
}: {
  entrees: string;
  sorties: string;
  operations: Operation[];
  status?: TranslationStatus;
  /** Phrase du bilan dans la langue choisie (montants de la page déjà remis). Par défaut : le français ci-dessous. */
  bilan?: ReactNode;
  introListe?: string;
  paroles?: Parole[];
}) {
  return (
    <KamaResponse
      status={status}
      paroles={paroles}
      speech={`Sur cette page : ${entrees} entrées, ${sorties} sorties. ${operations
        .map((o) => `${o.date}, ${o.libelle}, ${o.montant}`)
        .join('. ')}`}
    >
      <p className="m-0 font-semibold">
        {bilan ?? (
          <>
            Sur cette page : <Amount>{entrees}</Amount> entrées, <Amount>{sorties}</Amount> sorties.
          </>
        )}
      </p>
      <p className="m-0 text-sm text-kama-ink/70">{introListe ?? `Les ${operations.length} dernières opérations :`}</p>
      <ul className="m-0 flex list-none flex-col divide-y divide-kama-ink/10 rounded-xl border border-kama-ink/10 p-0">
        {operations.map((o) => (
          <li key={o.date + o.libelle} className="flex items-center gap-3 px-3 py-2.5">
            <span className="w-11 shrink-0 text-sm text-kama-ink/70">{o.date}</span>
            <span className="flex-1 text-sm">{o.libelle}</span>
            <Amount className={`text-sm ${o.sens === 'entree' ? 'text-kama-success' : 'text-kama-error'}`}>
              {o.montant}
            </Amount>
          </li>
        ))}
      </ul>
    </KamaResponse>
  );
}

/* 7 — Pas de transactions sur cette page */
export function NoTransactionsContent({
  destination = 'Va sur la page Historique.',
  onShowMe,
  status = 'auto',
  phrase = "Cette page n'a pas tes transactions.",
  paroles,
}: {
  destination?: string;
  onShowMe?: (cible: string) => void;
  status?: TranslationStatus;
  phrase?: string;
  paroles?: Parole[];
}) {
  return (
    <KamaResponse status={status} paroles={paroles} speech={`${phrase} ${destination}`}>
      <p className="m-0">{phrase}</p>
      <p className="m-0 font-semibold">{destination}</p>
      {onShowMe && (
        <div>
          <MontreMoi onClick={() => onShowMe('historique')} />
        </div>
      )}
    </KamaResponse>
  );
}

/* 8 — Explication d'un élément (exemple de la maquette : pastille Frais) */
export function ElementExplainContent({ libelle, frais, total }: { libelle: string; frais: string; total: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="self-start rounded-md border border-bank-border bg-bank-bg px-2 py-1 text-xs text-bank-text">
        Élément choisi : <strong>{libelle}</strong>
      </span>
      <KamaResponse
        status="verified"
        speech={`${libelle} : ${frais}. C'est ce que la banque prend pour faire le transfert. Au total, ${total} vont sortir de ton compte.`}
      >
        <p className="m-0">
          <span className="font-semibold">{libelle} :</span> <Amount>{frais}</Amount>.
        </p>
        <p className="m-0">C'est ce que la banque prend pour faire le transfert.</p>
        <p className="m-0">
          Au total, <Amount>{total}</Amount> vont sortir de ton compte.
        </p>
      </KamaResponse>
    </div>
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
}: {
  messageBanque: string;
  code?: string;
  titre: string;
  conseil?: string;
  status?: TranslationStatus;
  paroles?: Parole[];
  /** Message de la banque dans la langue choisie, avec son propre badge, sous le message original. */
  messageTraduit?: ReactNode;
}) {
  const speech = [titre, conseil ?? ''].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-bank-border bg-bank-bg p-3">
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-bank-muted">Message de la banque</p>
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

/* 10 — Pas de connexion */
export function OfflineContent({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center" role="alert">
      <span className="grid size-14 place-items-center rounded-full bg-kama-cream text-kama-ink">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <div className="w-full text-left">
        <KamaLine speech="Pas d'internet. Kama ne peut pas expliquer pour le moment.">
          <p className="m-0 flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Pas d'internet.</span> Kama ne peut pas expliquer pour le moment.
            </span>
          </p>
        </KamaLine>
      </div>
      <WindowButton variant="solid" onClick={onRetry}>
        Réessayer
      </WindowButton>
    </div>
  );
}

/* 11 — Traduction indisponible : texte original + « Écouter en français » */
export function UntranslatedContent({ texte, langue }: { texte: string; langue?: string }) {
  return (
    <article className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status="untranslated" />
        <TranslationBadge />
      </div>
      <p className="m-0 text-[15px] leading-snug text-kama-ink">{texte}</p>
      <p className="m-0 text-sm text-kama-ink/70">
        {langue ? `Ce texte n'existe pas encore en ${langue}.` : "Ce texte n'existe pas encore dans ta langue."}
      </p>
      <div>
        <WindowButton onClick={() => lireEnFrancais(texte)}>
          <Volume2 className="size-4" aria-hidden /> Écouter en français
        </WindowButton>
      </div>
    </article>
  );
}

/* 12 — Réflexion en attendant la traduction ou le serveur (court : le glossaire local répond tout de suite) */
export function Reflexion() {
  return <TalkThinkingContent />;
}

/* 13 — Pas de connexion au serveur : la réponse reste affichée en français, avec une icône, une phrase et « Réessayer » (UX 3.8) */
export function BandeauHorsLigne({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border-2 border-kama-ink p-3" role="alert">
      <p className="m-0 flex items-start gap-2 text-sm text-kama-ink">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">Pas de connexion internet.</span> Kama montre la réponse en français.
        </span>
      </p>
      <div>
        <WindowButton variant="solid" onClick={onRetry}>
          Réessayer
        </WindowButton>
      </div>
    </div>
  );
}

/* 14 — Parler : message simple (je n'ai pas compris, voix indisponible, micro refusé…) avec une action possible */
export function ParlerMessageContent({
  texte,
  detail,
  actionLabel,
  onAction,
}: {
  texte: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-end gap-3" role="status">
      <KamaLine speech={detail ? `${texte} ${detail}` : texte}>
        <p className="m-0 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span className="font-semibold">{texte}</span>
        </p>
        {detail && <p className="m-0 mt-1 text-kama-ink/80">{detail}</p>}
      </KamaLine>
      {actionLabel && (
        <div>
          <WindowButton variant="solid" onClick={onAction}>
            {actionLabel}
          </WindowButton>
        </div>
      )}
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
  onAccepter,
  onRefuser,
}: {
  titre: string;
  points: string[];
  accepter: string;
  refuser: string;
  status?: TranslationStatus;
  paroles?: Parole[];
  onAccepter: () => void;
  onRefuser: () => void;
}) {
  return (
    <KamaResponse status={status} paroles={paroles} speech={[titre, ...points].join(' ')}>
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
  return (
    <KamaResponse status={status} paroles={paroles} speech={original}>
      <p className="m-0 text-[15px] leading-snug">{traduction}</p>
      <p className="m-0 border-t border-kama-ink/10 pt-2 text-sm text-kama-ink/70">
        Texte de la page : <span className="text-kama-ink">{original}</span>
      </p>
    </KamaResponse>
  );
}
