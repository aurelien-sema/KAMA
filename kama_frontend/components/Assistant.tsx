/**
 * « Parler à Kama » : l'assistant vocal.
 *
 * Parcours d'une question (backend/ARCHITECTURE.md) :
 *   appui sur le micro → (1re fois : accord de l'utilisateur) → KAMA écoute (document caché de
 *   l'extension, pas la page de la banque) → voix en WAV 16 kHz → service worker → serveur,
 *   qui renvoie seulement une INTENTION (« les frais »…)
 *   → Kama répond LOCALEMENT, avec les mêmes contenus que le menu et les pastilles : les
 *   montants sont lus dans la page au moment de répondre, jamais fournis par le serveur.
 *
 * Plus tard, un modèle de langue pourra répondre aux questions hors de ces intentions ; il ne
 * produira jamais de montant (règle d'or n° 1).
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
import { ContenuReel, type VueReelle } from '@/components/kama/fenetre/reel';
import type { Langue } from '@/config/langues';
import { lirePage } from '@/lib/lecture-page';
import type { ErreurMicro, EvenementMicro, Intention, ResultatIntention } from '@/lib/messages';
import { demanderAutorisationMicro, ouvrirMicro, type Micro } from '@/lib/micro';
import { reglageConsentementMicro, useReglage } from '@/lib/reglages';
import { arreterLecture, lireEnFrancais } from '@/lib/voix';

type Etat = 'attente' | 'accord' | 'ecoute' | 'envoi';

type Bulle =
  | { id: number; de: 'toi'; duree: number; compris?: string }
  | { id: number; de: 'kama'; titre: string; texte?: string; reessayer?: boolean; autoriser?: boolean }
  /** Réponse construite à partir de la page (solde, frais, explication…). */
  | { id: number; de: 'reponse'; vue: VueReelle };

const NB_BARRES = 18;

type MontrerFn = (cible: string) => void;

export function useAssistant({
  langue,
  lectureAuto,
  onShowMe,
}: {
  langue: Langue | null;
  lectureAuto: boolean;
  onShowMe: MontrerFn;
}) {
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
        return repondre(e.resultat);
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

  function repondre(r: ResultatIntention) {
    // Question comprise : on note sous le message vocal ce que Kama a compris.
    if (r.ok && r.intention !== 'unknown') noterCompris(SENS[r.intention]);
    const reponse = reponsePour(r, bulles);
    if ('vue' in reponse) {
      // Contenu complet (lecteur audio inclus) : il se lit tout seul si l'utilisateur préfère l'audio.
      setBulles((liste) => [...liste, { id: ++compteur.current, de: 'reponse', vue: reponse.vue }]);
    } else if ('repete' in reponse) {
      const b = reponse.repete;
      if (b.de === 'kama' && lectureAuto) lireEnFrancais([b.titre, b.texte].filter(Boolean).join(' '));
      setBulles((liste) => [...liste, { ...b, id: ++compteur.current }]);
    } else {
      kama(reponse);
    }
  }

  function noterCompris(compris: string) {
    setBulles((liste) => {
      const i = liste.findLastIndex((b) => b.de === 'toi');
      if (i < 0) return liste;
      const copie = [...liste];
      copie[i] = { ...(copie[i] as Extract<Bulle, { de: 'toi' }>), compris };
      return copie;
    });
  }

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
      onShowMe={onShowMe}
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

/** Ce que Kama a compris, affiché sous le message vocal (« Kama a compris : les frais »). */
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

type Message = { titre: string; texte?: string; reessayer?: boolean };
type Reponse = { vue: VueReelle } | { repete: Bulle } | Message;

/** Quand l'élément demandé n'est pas sur la page : Kama le dit, il n'invente rien. */
const ABSENT: Record<'solde' | 'frais' | 'total' | 'erreur', Message> = {
  solde: { titre: 'Je ne vois pas ton solde sur cette page.', texte: 'Va sur la page de ta banque où ton solde est écrit.' },
  frais: {
    titre: 'Je ne vois pas de frais sur cette page.',
    texte: 'Les frais s’affichent quand tu prépares un transfert.',
  },
  total: {
    titre: 'Je ne vois pas de total sur cette page.',
    texte: 'Le total s’affiche quand tu prépares un transfert.',
  },
  erreur: {
    titre: 'Je ne vois pas de message d’erreur sur cette page.',
    texte: 'Si la banque affiche un message, touche la pastille Kama à côté.',
  },
};

/**
 * La réponse de Kama à une intention. La page est relue maintenant : Kama répond sur ce qui
 * est affiché, avec les montants exacts de la page (ou dit qu'il ne les voit pas).
 */
function reponsePour(r: ResultatIntention, bulles: Bulle[]): Reponse {
  if (!r.ok) return messageErreur(r.code);
  if (r.simulation && r.intention === 'unknown') {
    return {
      titre: "J'ai bien reçu ta question.",
      texte: "Mode simulation : le serveur de Kama n'est pas encore branché, je ne peux pas encore la comprendre.",
    };
  }
  const lecture = lirePage();
  const element = (id: 'solde' | 'frais' | 'total'): Reponse =>
    lecture.elements.has(id) ? { vue: { type: 'element', id } } : ABSENT[id];

  switch (r.intention) {
    case 'ask_balance':
      return element('solde');
    case 'ask_fees':
      return element('frais');
    case 'ask_total':
      return element('total');
    case 'what_to_do':
      return { vue: { type: 'expliquer' } };
    case 'summarize_transactions':
      return { vue: { type: 'resumer' } };
    case 'explain_error': {
      if (lecture.elements.has('erreur')) return { vue: { type: 'element', id: 'erreur' } };
      const alerte = lecture.decouvertes.find((d) => d.nature === 'alerte');
      return alerte ? { vue: { type: 'decouverte', cle: alerte.cle } } : ABSENT.erreur;
    }
    case 'repeat': {
      // La dernière réponse de Kama, telle quelle (les messages d'erreur ne sont pas répétés).
      const derniere = bulles.findLast((b) => b.de === 'reponse' || (b.de === 'kama' && !b.reessayer && !b.autoriser));
      return derniere
        ? { repete: derniere }
        : { titre: "Je n'ai encore rien dit.", texte: 'Appuie sur le micro et pose ta question.' };
    }
    case 'unknown':
      return { titre: "Je n'ai pas compris ta question.", texte: 'Redis-la autrement, avec des mots simples.' };
  }
}

function messageErreur(code: string): Message {
  switch (code) {
    case 'reseau':
    case 'busy':
      return {
        titre: "Je n'arrive pas à joindre Kama.",
        texte: 'Vérifie ta connexion internet, puis appuie sur « Réessayer ».',
        reessayer: true,
      };
    case 'rate_limited':
      return { titre: 'Trop de questions en peu de temps.', texte: 'Attends un peu, puis appuie sur « Réessayer ».', reessayer: true };
    case 'invalid_audio':
    case 'invalid_duration':
      return { titre: "Je n'ai pas bien entendu.", texte: 'Appuie sur le micro et repose ta question.' };
    case 'asr_unavailable':
      return {
        titre: 'Kama ne comprend pas encore la voix pour le moment.',
        texte: 'Utilise « Expliquer cette page » ou les pastilles Kama à côté des montants.',
      };
    default:
      return { titre: 'Kama a eu un problème.', texte: 'Appuie sur « Réessayer ».', reessayer: true };
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
  onShowMe,
}: {
  etat: Etat;
  bulles: Bulle[];
  niveaux: number[];
  onAccepter: () => void;
  onRefuser: () => void;
  onReessayer: () => void;
  onAutoriser: () => void;
  onShowMe: MontrerFn;
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
          <div key={b.id} className="flex flex-col items-end gap-1">
            <UserBubble>
              <span className="inline-flex items-center gap-1.5">
                <Mic className="size-4" aria-hidden /> Message vocal · {Math.max(1, Math.round(b.duree))} s
              </span>
            </UserBubble>
            {b.compris && <span className="text-xs text-kama-ink/70">Kama a compris : {b.compris}</span>}
          </div>
        ) : b.de === 'reponse' ? (
          <ContenuReel key={b.id} vue={b.vue} onShowMe={onShowMe} />
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
