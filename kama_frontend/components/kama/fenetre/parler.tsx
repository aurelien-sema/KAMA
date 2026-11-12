/**
 * « Parler à Kama » et consentements : contenus de la fenêtre qui passent par la traduction comme les autres.
 * (Les textes fixes sont des phrases de Kama : validées, ils s'affichent dans la langue choisie ; sinon en français.)
 */
import { CONSENTEMENT, CONSENTEMENT_MICRO } from '@/config/consentement';
import type { Ligne } from '@/config/gabarits';
import { PHRASES } from '@/config/phrases';
import type { PhaseParler } from '@/lib/use-parler';
import { aplatir, useReponse } from '@/lib/use-reponse';
import {
  ConsentementContent,
  ParlerMessageContent,
  Reflexion,
  TalkIdleContent,
  TalkListeningContent,
  TalkThinkingContent,
} from './contents';

export function Consentement({ micro, onAccepter, onRefuser }: { micro?: boolean; onAccepter: () => void; onRefuser: () => void }) {
  const c = micro ? CONSENTEMENT_MICRO : CONSENTEMENT;
  // Un consentement n'est valable que compris : « critique » donc traduit seulement s'il est validé par un locuteur.
  const r = useReponse([[c.titre], ...c.points.map((p) => [p]), [c.accepter], [c.refuser]], 'warning');
  if (r.chargement) return <Reflexion />;
  const textes = r.lignes.map(aplatir);
  return (
    <ConsentementContent
      status={r.status}
      paroles={r.paroles}
      titre={textes[0]!}
      points={textes.slice(1, 1 + c.points.length)}
      accepter={textes[1 + c.points.length]!}
      refuser={textes[2 + c.points.length]!}
      speechFr={[c.titre, ...c.points].join(' ')}
      onAccepter={onAccepter}
      onRefuser={onRefuser}
    />
  );
}

type CleMessage = 'non-compris' | 'indisponible' | 'micro-refuse' | 'micro-absent' | 'hors-ligne';
const MESSAGES: Record<CleMessage, readonly string[]> = {
  'non-compris': PHRASES.voix.nonCompris,
  indisponible: PHRASES.voix.indisponible,
  'micro-refuse': PHRASES.voix.microRefuse,
  'micro-absent': PHRASES.voix.microAbsent,
  'hors-ligne': PHRASES.voix.horsLigne,
};
/** Le dernier texte d'un message est le bouton « Réessayer », sauf pour « voix indisponible » (aucune action possible). */
const AVEC_ACTION: CleMessage[] = ['non-compris', 'micro-refuse', 'micro-absent', 'hors-ligne'];

function Message({ cle, onRetry }: { cle: CleMessage; onRetry: () => void }) {
  const textes = MESSAGES[cle];
  const r = useReponse(textes.map((t): Ligne => [t]));
  if (r.chargement) return <Reflexion />;
  const t = r.lignes.map(aplatir);
  const action = AVEC_ACTION.includes(cle);
  return (
    <ParlerMessageContent
      texte={t[0]!}
      detail={t[1]}
      actionLabel={action ? t[t.length - 1] : undefined}
      onAction={onRetry}
      paroles={r.paroles?.slice(0, action ? -1 : undefined)}
      speechFr={textes.slice(0, action ? -1 : undefined).join(' ')}
    />
  );
}

export function ParlerContenu({ phase, onRetry }: { phase: PhaseParler | null; onRetry: () => void }) {
  switch (phase) {
    case 'ecoute':
      return <TalkListeningContent />;
    case 'reflexion':
      return <TalkThinkingContent />;
    case 'non-compris':
    case 'indisponible':
    case 'micro-refuse':
    case 'micro-absent':
    case 'hors-ligne':
      return <Message cle={phase} onRetry={onRetry} />;
    default:
      return <TalkIdleContent />;
  }
}
