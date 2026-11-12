/**
 * « Parler à Kama » : l'assistant vocal.
 *
 * Parcours d'une question (backend/ARCHITECTURE.md) :
 *   appui sur le micro → (1re fois : accord de l'utilisateur) → KAMA écoute (document caché de
 *   l'extension, pas la page de la banque) → voix en WAV 16 kHz → service worker → serveur,
 *   qui renvoie seulement une INTENTION (« les frais »…)
 *   → Kama répondra localement, avec les montants lus dans la page (étape suivante du projet).
 *
 * Tant que le serveur n'est pas en ligne, le service worker répond en mode simulation.
 * La conversation reste affichée tant que la fenêtre est ouverte ; rien n'est stocké.
 * La voix ne passe jamais par la page : elle va du document caché au service worker, qui la
 * garde en mémoire seulement le temps de pouvoir « Réessayer ».
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Mic, RotateCw, ShieldCheck } from 'lucide-react';
import type { MicMode } from '@/components/kama/fenetre/KamaWindow';
import { TalkIdleContent, TalkListeningContent } from '@/components/kama/fenetre/contents';
import { KamaLine, UserBubble, WindowButton } from '@/components/kama/fenetre/parts';
import type { Langue } from '@/config/langues';
import type { ErreurMicro, EvenementMicro, Intention, ResultatIntention } from '@/lib/messages';
import { demanderAutorisationMicro, ouvrirMicro, type Micro } from '@/lib/micro';
import { reglageConsentementMicro, useReglage } from '@/lib/reglages';
import { arreterLecture, lireEnFrancais } from '@/lib/voix';

type Etat = 'attente' | 'accord' | 'ecoute' | 'envoi';

type Bulle =
  | { id: number; de: 'toi'; duree: number }
  | { id: number; de: 'kama'; titre: string; texte?: string; reessayer?: boolean; autoriser?: boolean };

const NB_BARRES = 18;

export function useAssistant({ langue, lectureAuto }: { langue: Langue | null; lectureAuto: boolean }) {
  const [consentement, setConsentement] = useReglage(reglageConsentementMicro);
  const [etat, setEtat] = useState<Etat>('attente');
  const [bulles, setBulles] = useState<Bulle[]>([]);
  const [niveaux, setNiveaux] = useState<number[]>(() => Array(NB_BARRES).fill(0));
  const compteur = useRef(0);

  // Le micro de Kama (via le service worker). Les événements passent par une référence pour
  // toujours utiliser la dernière version de `traiter`.
  const traiterRef = useRef<(e: EvenementMicro | { type: 'coupe' }) => void>(() => {});
  const micro = useRef<Micro | null>(null);
  micro.current ??= ouvrirMicro((e) => traiterRef.current(e));
  useEffect(() => () => micro.current?.fermer(), []);

  type BulleKama = Omit<Extract<Bulle, { de: 'kama' }>, 'id' | 'de'>;
  function kama(b: BulleKama) {
    setBulles((liste) => [...liste, { ...b, id: ++compteur.current, de: 'kama' }]);
    if (lectureAuto) lireEnFrancais([b.titre, b.texte].filter(Boolean).join(' '));
  }

  /** Appui sur le bouton micro, en bas de la fenêtre. */
  function appuiMicro() {
    if (etat === 'ecoute') return micro.current?.arreter();
    if (etat === 'envoi') return;
    if (!consentement) return setEtat('accord');
    ecouter();
  }

  function ecouter() {
    arreterLecture(); // Kama se tait pour écouter
    setNiveaux(Array(NB_BARRES).fill(0));
    setEtat('ecoute');
    micro.current?.demarrer(langue?.code ?? 'fr');
  }

  traiterRef.current = (e) => {
    switch (e.type) {
      case 'ecoute':
        return;
      case 'niveau':
        return setNiveaux((liste) => [...liste.slice(1), e.niveau]);
      case 'rien-entendu':
        setEtat('attente');
        return kama({ titre: "Je n'ai rien entendu.", texte: "Appuie sur le micro et parle près de l'ordinateur." });
      case 'envoi':
        setBulles((liste) => [...liste, { id: ++compteur.current, de: 'toi', duree: e.duree }]);
        return setEtat('envoi');
      case 'resultat': {
        setEtat('attente');
        const [titre, texte, reessayer] = messagePour(e.resultat);
        return kama({ titre, texte, reessayer });
      }
      case 'erreur': {
        setEtat('attente');
        const [titre, texte] = MESSAGES_MICRO[e.code] ?? MESSAGES_MICRO.indisponible;
        return kama({ titre, texte, autoriser: e.code === 'refuse' });
      }
      case 'coupe':
        if (etat === 'ecoute' || etat === 'envoi') {
          setEtat('attente');
          kama({ titre: 'Kama vient d’être mis à jour.', texte: 'Recharge la page (touche F5), puis repose ta question.' });
        }
        return;
    }
  };

  function reessayer() {
    if (etat !== 'attente') return;
    setEtat('envoi');
    micro.current?.reessayer();
  }

  function accepter() {
    setConsentement(true);
    ecouter();
  }

  function refuser() {
    setEtat('attente');
    kama({ titre: "D'accord, je ne t'écoute pas.", texte: "Tu peux toujours utiliser « Expliquer cette page » ou les pastilles Kama." });
  }

  /** Fenêtre fermée : on coupe le micro et on oublie la conversation. */
  function reinitialiser() {
    micro.current?.fermer();
    setBulles([]);
    setEtat('attente');
  }

  const mic: MicMode = etat === 'ecoute' ? 'listening' : etat === 'envoi' ? 'thinking' : 'idle';

  const contenu = (
    <Conversation
      etat={etat}
      bulles={bulles}
      niveaux={niveaux}
      onAccepter={accepter}
      onRefuser={refuser}
      onReessayer={reessayer}
      onAutoriser={demanderAutorisationMicro}
    />
  );

  return { mic, appuiMicro, reinitialiser, ecoute: etat === 'ecoute', contenu };
}

/* ---------------------------------------------------------------------------------------- */

const MESSAGES_MICRO: Record<ErreurMicro, [string, string]> = {
  refuse: [
    "Kama n'a pas encore le droit d'utiliser le micro.",
    "Appuie sur « Autoriser le micro » : une page de Kama s'ouvre. Reviens ensuite ici et appuie encore sur le micro.",
  ],
  absent: ['Aucun micro trouvé.', 'Branche un micro ou un casque, puis appuie encore sur le micro.'],
  indisponible: ['Le micro ne marche pas pour le moment.', 'Ferme les autres applications qui utilisent le micro, puis réessaie.'],
};

/** Ce que l'intention reconnue veut dire, pour le dire à l'utilisateur. */
const SENS: Record<Intention, string> = {
  ask_balance: 'ton solde',
  ask_fees: 'les frais',
  ask_total: 'le total',
  what_to_do: 'quoi faire ici',
  explain_error: 'le message de la banque',
  summarize_transactions: 'tes transactions',
  repeat: 'répéter',
  unknown: '',
};

/** [titre, texte, proposer « Réessayer »]. Les réponses aux questions viendront à l'étape suivante. */
function messagePour(r: ResultatIntention): [string, string?, boolean?] {
  if (r.ok) {
    if (r.simulation) {
      return [
        "J'ai bien reçu ta question.",
        "Mode simulation : le serveur de Kama n'est pas encore branché, je ne peux pas encore la comprendre.",
      ];
    }
    if (r.intention === 'unknown') return ["Je n'ai pas compris ta question.", 'Redis-la autrement, avec des mots simples.'];
    return [`Tu me demandes : ${SENS[r.intention]}.`, 'Ma réponse arrive dans une prochaine version.'];
  }
  switch (r.code) {
    case 'reseau':
    case 'busy':
      return ["Je n'arrive pas à joindre Kama.", "Vérifie ta connexion internet, puis appuie sur « Réessayer ».", true];
    case 'rate_limited':
      return ['Trop de questions en peu de temps.', 'Attends un peu, puis appuie sur « Réessayer ».', true];
    case 'invalid_audio':
    case 'invalid_duration':
      return ["Je n'ai pas bien entendu.", 'Appuie sur le micro et repose ta question.'];
    case 'asr_unavailable':
      return [
        'Kama ne comprend pas encore la voix pour le moment.',
        "Utilise « Expliquer cette page » ou les pastilles Kama à côté des montants.",
      ];
    default:
      return ['Kama a eu un problème.', 'Appuie sur « Réessayer ».', true];
  }
}

/* ---------------------------------------------------------------------------------------- */

function Conversation({
  etat,
  bulles,
  niveaux,
  onAccepter,
  onRefuser,
  onReessayer,
  onAutoriser,
}: {
  etat: Etat;
  bulles: Bulle[];
  niveaux: number[];
  onAccepter: () => void;
  onRefuser: () => void;
  onReessayer: () => void;
  onAutoriser: () => void;
}) {
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'nearest' });
  }, [bulles.length, etat]);

  if (etat === 'ecoute') return <TalkListeningContent niveaux={niveaux} />;

  const derniere = bulles.at(-1);
  return (
    <div className="flex min-h-full flex-col justify-end gap-4">
      {bulles.length === 0 && etat !== 'accord' && <TalkIdleContent />}

      {bulles.map((b) =>
        b.de === 'toi' ? (
          <UserBubble key={b.id}>
            <span className="inline-flex items-center gap-1.5">
              <Mic className="size-4" aria-hidden /> Message vocal · {Math.max(1, Math.round(b.duree))} s
            </span>
          </UserBubble>
        ) : (
          <ReponseKama key={b.id} titre={b.titre} texte={b.texte}>
            {b.reessayer && b === derniere && etat === 'attente' && (
              <WindowButton onClick={onReessayer}>
                <RotateCw className="size-4" aria-hidden /> Réessayer
              </WindowButton>
            )}
            {b.autoriser && b === derniere && (
              <WindowButton variant="solid" onClick={onAutoriser}>
                <ShieldCheck className="size-4" aria-hidden /> Autoriser le micro
              </WindowButton>
            )}
          </ReponseKama>
        ),
      )}

      {etat === 'envoi' && (
        <div className="flex items-center gap-3 self-start rounded-2xl rounded-bl-md bg-kama-cream px-4 py-3" role="status">
          <span className="text-[15px] font-semibold text-kama-ink">Kama réfléchit</span>
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="animate-kama-appear size-2 rounded-full bg-kama-ink" style={{ animationDelay: `${i * 160}ms` }} />
            ))}
          </span>
        </div>
      )}

      {etat === 'accord' && (
        <ReponseKama
          titre="Avant de t'écouter :"
          texte="Ta voix est envoyée à Kama pour comprendre ta question. Elle n'est pas gardée."
        >
          <div className="flex flex-wrap gap-2">
            <WindowButton variant="solid" onClick={onAccepter}>
              D'accord
            </WindowButton>
            <WindowButton onClick={onRefuser}>Non merci</WindowButton>
          </div>
        </ReponseKama>
      )}
      <div ref={fin} />
    </div>
  );
}

function ReponseKama({ titre, texte, children }: { titre: string; texte?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <KamaLine speech={[titre, texte].filter(Boolean).join(' ')}>
        <p className="m-0 font-semibold">{titre}</p>
        {texte && <p className="m-0 mt-1 text-kama-ink/80">{texte}</p>}
      </KamaLine>
      {children && <div>{children}</div>}
    </div>
  );
}
