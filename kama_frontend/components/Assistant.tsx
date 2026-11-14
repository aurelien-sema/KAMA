/**
 * « Parler à Kama » : l'assistant vocal.
 *
 * Parcours d'une question (backend/ARCHITECTURE.md) :
 *   appui sur le micro → (1re fois : accord pour le micro) → le service worker vérifie que le serveur
 *   comprend la voix dans cette langue → KAMA écoute (document caché de l'extension, pas la page de la
 *   banque) → voix en WAV 16 kHz → service worker → serveur, qui renvoie seulement une INTENTION
 *   (« les frais »…) → Kama répond LOCALEMENT, avec les mêmes contenus que le menu et les pastilles :
 *   les montants sont lus dans la page au moment de répondre, jamais fournis par le serveur.
 *
 * Tout ce que Kama dit passe par la traduction (lib/use-reponse.ts) et se lit à voix haute : une
 * question posée à voix haute reçoit une réponse parlée.
 *
 * Plus tard, un modèle de langue pourra répondre aux questions hors de ces intentions ; il ne
 * produira jamais de montant (règle d'or n° 1).
 *
 * La conversation reste affichée tant que la fenêtre est ouverte ; rien n'est stocké.
 * La voix ne passe jamais par la page : elle va du document caché au service worker, qui la
 * garde en mémoire seulement le temps de pouvoir « Réessayer ».
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Mic, RotateCw, ShieldCheck } from 'lucide-react';
import type { MicMode } from '@/components/kama/fenetre/KamaWindow';
import { Reflexion, TalkIdleContent, TalkListeningContent } from '@/components/kama/fenetre/contents';
import { Consentement } from '@/components/kama/fenetre/parler';
import { Amount, KamaLine, StatusBadge, UserBubble, WindowButton } from '@/components/kama/fenetre/parts';
import { ContenuReel, type VueReelle } from '@/components/kama/fenetre/reel';
import type { Langue } from '@/config/langues';
import { PHRASES } from '@/config/phrases';
import { jouerParoles } from '@/lib/audio';
import { contextePage } from '@/lib/contexte-page';
import { demasquer } from '@/lib/masquage';
import type { Parole } from '@/lib/traduction';
import { LectureAuto, useLectureAuto } from '@/lib/langue-courante';
import { lirePage } from '@/lib/lecture-page';
import type { ErreurMicro, EvenementMicro, Intention, ResultatIntention } from '@/lib/messages';
import { demanderAutorisationMicro, ouvrirMicro, type Micro } from '@/lib/micro';
import { reglageConsentementMicro, useReglage } from '@/lib/reglages';
import { aplatir, useReponse } from '@/lib/use-reponse';
import { useTexte } from '@/lib/use-texte';
import { arreterLecture, lireTexte } from '@/lib/voix';

type Etat = 'attente' | 'accord' | 'ecoute' | 'envoi';

/** « Réessayer » : renvoyer la même voix (`envoi`), ou réécouter (`ecoute`) quand rien n'a été envoyé. */
type Reprise = 'envoi' | 'ecoute';

type Bulle =
  | { id: number; de: 'toi'; duree: number; compris?: string }
  | { id: number; de: 'kama'; titre: string; texte?: string; reessayer?: Reprise; autoriser?: boolean }
  /** Réponse construite à partir de la page (solde, frais, explication…). */
  | { id: number; de: 'reponse'; vue: VueReelle }
  /** Réponse du modèle local : pidgin, badge « Traduction automatique », jamais de montant inventé. */
  | { id: number; de: 'machine'; texte: string; valeurs: Record<string, string> };

const NB_BARRES = 18;

type MontrerFn = (cible: string) => void;

export function useAssistant({ langue, onShowMe }: { langue: Langue | null; onShowMe: MontrerFn }) {
  const [consentement, setConsentement] = useReglage(reglageConsentementMicro);
  const [etat, setEtat] = useState<Etat>('attente');
  const [bulles, setBulles] = useState<Bulle[]>([]);
  /** La dernière bulle ajoutée : seule elle est lue à voix haute (pas les anciennes, au retour sur la conversation). */
  const [aLire, setALire] = useState<number | null>(null);
  const [niveaux, setNiveaux] = useState<number[]>(() => Array(NB_BARRES).fill(0));
  const compteur = useRef(0);
  /** Valeurs de la page derrière les {xN} du contexte : elles ne quittent pas l'extension. */
  const valeursContexte = useRef<Record<string, string>>({});

  // Le micro de Kama (via le service worker). Les événements passent par une référence pour
  // toujours utiliser la dernière version de `traiter`.
  const traiterRef = useRef<(e: EvenementMicro | { type: 'coupe' }) => void>(() => {});
  const micro = useRef<Micro | null>(null);
  micro.current ??= ouvrirMicro((e) => traiterRef.current(e));
  useEffect(() => () => micro.current?.fermer(), []);

  type SansId<B> = B extends Bulle ? Omit<B, 'id'> : never;
  function ajouter(b: SansId<Bulle>, lire = true) {
    const id = ++compteur.current;
    setBulles((liste) => [...liste, { ...b, id } as Bulle]);
    if (lire) setALire(id);
  }
  const kama = (b: Message) => ajouter({ ...b, de: 'kama' });

  /** Appui sur le bouton micro, en bas de la fenêtre. */
  function appuiMicro() {
    if (etat === 'ecoute') return micro.current?.arreter();
    if (etat === 'envoi') return;
    if (!consentement) return setEtat('accord');
    ecouter();
  }

  function ecouter() {
    arreterLecture(); // Kama se tait pour écouter
    setALire(null);
    setNiveaux(Array(NB_BARRES).fill(0));
    setEtat('ecoute');
    // Contexte lu maintenant et masqué ici : seules les balises {xN} partiront au serveur.
    const contexte = contextePage();
    valeursContexte.current = contexte.valeurs;
    micro.current?.demarrer(langue?.code ?? 'fr', contexte.texte);
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
        ajouter({ de: 'toi', duree: e.duree }, false);
        return setEtat('envoi');
      case 'resultat':
        setEtat('attente');
        return repondre(e.resultat);
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
    if (r.ok && r.reponse) {
      // Question hors grammaire fermee : on montre le pidgin entendu, puis la reponse machine.
      if (r.entendu) noterCompris(`« ${r.entendu} »`);
      ajouter({ de: 'machine', texte: r.reponse, valeurs: valeursContexte.current });
      return;
    }
    // Question comprise : on note sous le message vocal ce que Kama a compris.
    if (r.ok && SENS[r.intention]) noterCompris(SENS[r.intention]);
    const reponse = reponsePour(r, bulles);
    if ('vue' in reponse) ajouter({ de: 'reponse', vue: reponse.vue });
    else if ('repete' in reponse) {
      const { id: _, ...copie } = reponse.repete;
      ajouter(copie as SansId<Bulle>);
    } else kama(reponse);
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

  function reessayer(reprise: Reprise) {
    if (etat !== 'attente') return;
    if (reprise === 'ecoute') return ecouter();
    setEtat('envoi');
    micro.current?.reessayer();
  }

  function accepter() {
    setConsentement(true);
    ecouter();
  }

  function refuser() {
    setEtat('attente');
    kama({ titre: "D'accord, je ne t'écoute pas.", texte: 'Tu peux toujours utiliser « Expliquer cette page » ou les pastilles Kama.' });
  }

  /** Fenêtre fermée : on coupe le micro et on oublie la conversation. */
  function reinitialiser() {
    micro.current?.fermer();
    setBulles([]);
    setALire(null);
    setEtat('attente');
  }

  const mic: MicMode = etat === 'ecoute' ? 'listening' : etat === 'envoi' ? 'thinking' : 'idle';

  const contenu = (
    <Conversation
      etat={etat}
      bulles={bulles}
      aLire={aLire}
      niveaux={niveaux}
      onAccepter={accepter}
      onRefuser={refuser}
      onReessayer={reessayer}
      onAutoriser={demanderAutorisationMicro}
      onShowMe={onShowMe}
      onQuitter={() => setALire(null)}
    />
  );

  return { mic, appuiMicro, reinitialiser, ecoute: etat === 'ecoute', contenu };
}

/* ---------------------------------------------------------------------------------------- */

type Message = { titre: string; texte?: string; reessayer?: Reprise; autoriser?: boolean };

const MESSAGES_MICRO: Record<ErreurMicro, [string, string]> = {
  refuse: [
    "Kama n'a pas encore le droit d'utiliser le micro.",
    "Appuie sur « Autoriser le micro » : une page de Kama s'ouvre. Reviens ensuite ici et appuie encore sur le micro.",
  ],
  absent: [PHRASES.voix.microAbsent[0], PHRASES.voix.microAbsent[1]],
  indisponible: ['Le micro ne marche pas pour le moment.', 'Ferme les autres applications qui utilisent le micro, puis réessaie.'],
};

/** Ce que Kama a compris, affiché sous le message vocal (« Kama a compris : les frais »). */
const SENS: Record<Intention, string> = {
  ask_balance: 'ton solde',
  ask_fees: 'les frais',
  ask_total: 'le total',
  what_to_do: 'quoi faire ici',
  explain_error: 'le message de la banque',
  summarize_transactions: '', // résumé retiré le 2026-11-13 : la réponse sera revue avec le modèle de langue
  repeat: 'répéter',
  unknown: '',
};

type Reponse = { vue: VueReelle } | { repete: Bulle } | Message;

/** Quand l'élément demandé n'est pas sur la page : Kama le dit, il n'invente rien. */
const ABSENT: Record<'solde' | 'frais' | 'total' | 'erreur', Message> = {
  solde: { titre: 'Je ne vois pas ton solde sur cette page.', texte: 'Va sur la page de ta banque où ton solde est écrit.' },
  frais: { titre: 'Je ne vois pas de frais sur cette page.', texte: 'Les frais s’affichent quand tu prépares un transfert.' },
  total: { titre: 'Je ne vois pas de total sur cette page.', texte: 'Le total s’affiche quand tu prépares un transfert.' },
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
    // Résumé des transactions retiré : en attendant le modèle de langue, Kama dit qu'il n'a pas compris.
    case 'summarize_transactions':
    case 'unknown':
      return { titre: PHRASES.voix.nonCompris[0], texte: PHRASES.voix.nonCompris[1] };
  }
}

/** Codes du serveur (backend) et du service worker (`network`, `timeout`, `serveur_absent`). */
function messageErreur(code: string): Message {
  switch (code) {
    case 'network':
    case 'timeout':
    case 'busy':
      return { titre: PHRASES.voix.horsLigne[0], texte: PHRASES.voix.horsLigne[1], reessayer: 'envoi' };
    case 'serveur_absent':
      // Rien n'a été envoyé : « Réessayer » réécoute.
      return { titre: PHRASES.voix.horsLigne[0], texte: PHRASES.voix.horsLigne[1], reessayer: 'ecoute' };
    case 'rate_limited':
      return { titre: 'Trop de questions en peu de temps.', texte: 'Attends un peu, puis appuie sur « Réessayer ».', reessayer: 'envoi' };
    case 'invalid_audio':
    case 'invalid_duration':
      return { titre: "Je n'ai pas bien entendu.", texte: 'Appuie sur le micro et repose ta question.' };
    case 'asr_unavailable':
      return { titre: PHRASES.voix.indisponible[0], texte: PHRASES.voix.indisponible[1] };
    default:
      return { titre: 'Kama a eu un problème.', texte: 'Appuie sur « Réessayer ».', reessayer: 'envoi' };
  }
}

/* ---------------------------------------------------------------------------------------- */

function Conversation({
  etat,
  bulles,
  aLire,
  niveaux,
  onAccepter,
  onRefuser,
  onReessayer,
  onAutoriser,
  onShowMe,
  onQuitter,
}: {
  etat: Etat;
  bulles: Bulle[];
  aLire: number | null;
  niveaux: number[];
  onAccepter: () => void;
  onRefuser: () => void;
  onReessayer: (reprise: Reprise) => void;
  onAutoriser: () => void;
  onShowMe: MontrerFn;
  onQuitter: () => void;
}) {
  const fin = useRef<HTMLDivElement>(null);
  const lectureAuto = useLectureAuto();
  const reessayer = useTexte('Réessayer');
  const autoriser = useTexte('Autoriser le micro');
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'nearest' });
  }, [bulles.length, etat]);
  // On quitte la conversation : en y revenant, les anciennes réponses ne sont pas relues.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => onQuitter(), []);

  if (etat === 'ecoute') return <TalkListeningContent niveaux={niveaux} />;

  const derniere = bulles.at(-1);
  return (
    <div className="flex min-h-full flex-col justify-end gap-4">
      {bulles.length === 0 && etat !== 'accord' && <TalkIdleContent />}

      {bulles.map((b) => (
        // Seule la dernière bulle ajoutée se lit toute seule.
        <LectureAuto.Provider key={b.id} value={lectureAuto && b.id === aLire}>
          {b.de === 'toi' ? (
            <MessageVocal duree={b.duree} compris={b.compris} />
          ) : b.de === 'machine' ? (
            <ReponseMachine texte={b.texte} valeurs={b.valeurs} />
          ) : b.de === 'reponse' ? (
            <ContenuReel vue={b.vue} onShowMe={onShowMe} />
          ) : (
            <ReponseKama titre={b.titre} texte={b.texte}>
              {b.reessayer && b === derniere && etat === 'attente' && (
                <WindowButton onClick={() => onReessayer(b.reessayer!)}>
                  <RotateCw className="size-4" aria-hidden /> {reessayer}
                </WindowButton>
              )}
              {b.autoriser && b === derniere && (
                <WindowButton variant="solid" onClick={onAutoriser}>
                  <ShieldCheck className="size-4" aria-hidden /> {autoriser}
                </WindowButton>
              )}
            </ReponseKama>
          )}
        </LectureAuto.Provider>
      ))}

      {etat === 'envoi' && <Reflexion />}

      {etat === 'accord' && <Consentement micro onAccepter={onAccepter} onRefuser={onRefuser} />}
      <div ref={fin} />
    </div>
  );
}

function MessageVocal({ duree, compris }: { duree: number; compris?: string }) {
  const messageVocal = useTexte('Message vocal');
  const aCompris = useTexte('Kama a compris :');
  const sens = useTexte(compris ?? '');
  return (
    <div className="flex flex-col items-end gap-1">
      <UserBubble>
        <span className="inline-flex items-center gap-1.5">
          <Mic className="size-4" aria-hidden /> {messageVocal} · {Math.max(1, Math.round(duree))} s
        </span>
      </UserBubble>
      {compris && (
        <span className="text-xs text-kama-ink/70">
          {aCompris} {sens}
        </span>
      )}
    </div>
  );
}

/**
 * Réponse du modèle local : pidgin avec ses {xN} remplacés par les valeurs de la page, badge
 * « Traduction automatique », lue avec la voix pidgin du serveur (repli : voix du navigateur).
 */
function ReponseMachine({ texte, valeurs }: { texte: string; valeurs: Record<string, string> }) {
  const lectureAuto = useLectureAuto();
  const lu = useRef(false);
  const paroles = useMemo<Parole[]>(() => [{ texte, valeurs, langue: 'wes' }], [texte, valeurs]);
  const morceaux = demasquer(texte, valeurs) ?? [texte];
  const dit = morceaux.map((m) => (typeof m === 'string' ? m : m.montant)).join('');

  useEffect(() => {
    if (!lectureAuto || lu.current) return;
    lu.current = true;
    jouerParoles(paroles).catch(() => lireTexte(dit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureAuto]);

  return (
    <KamaLine speech={dit} paroles={paroles}>
      <div className="flex items-start gap-2">
        <p className="m-0">
          {morceaux.map((m, i) => (typeof m === 'string' ? m : <Amount key={i}>{m.montant}</Amount>))}
        </p>
        <StatusBadge status="auto" />
      </div>
    </KamaLine>
  );
}

/** Message court de Kama : traduit s'il est validé, lu à voix haute s'il vient d'arriver. */
function ReponseKama({ titre, texte, children }: { titre: string; texte?: string; children?: ReactNode }) {
  const lignes = texte ? [[titre], [texte]] : [[titre]];
  const r = useReponse(lignes);
  const lectureAuto = useLectureAuto();
  const speechFr = [titre, texte].filter(Boolean).join(' ');
  const lu = useRef(false);

  useEffect(() => {
    if (!lectureAuto || r.chargement || lu.current) return;
    lu.current = true;
    if (r.paroles?.length) jouerParoles(r.paroles).catch(() => lireTexte(speechFr));
    else lireTexte(speechFr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureAuto, r.chargement]);

  if (r.chargement) return <Reflexion />;
  return (
    <div className="flex flex-col gap-2">
      <KamaLine speech={speechFr} paroles={r.paroles}>
        <p className="m-0 font-semibold">{aplatir(r.lignes[0]!)}</p>
        {r.lignes[1] && <p className="m-0 mt-1 text-kama-ink/80">{aplatir(r.lignes[1])}</p>}
      </KamaLine>
      {children && <div>{children}</div>}
    </div>
  );
}
