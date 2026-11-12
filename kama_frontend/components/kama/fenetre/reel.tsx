/**
 * Contenus de la fenêtre construits à partir de la VRAIE page (et non des exemples Lovable).
 * La page est relue au moment d'afficher le contenu ; rien n'est stocké.
 *
 * Chaque réponse passe par la traduction (lib/traduction.ts) : glossaire local validé d'abord, puis le serveur avec des textes
 * masqués. Tant qu'une phrase n'est pas validée en ghomálá' ou en pidgin, Kama montre le gabarit français avec le badge
 * « Pas encore traduit » (règle d'or n° 4). Les montants sont ceux de la page, recopiés tels quels (règle d'or n° 1).
 *
 * Deux sortes d'éléments :
 *  - les éléments connus (config/banques/), expliqués par leurs gabarits ;
 *  - les éléments découverts par Kama (contenu inédit) : montants, alertes, nouveaux messages.
 *    Kama les recopie tels quels et dit franchement qu'il ne les connaît pas encore.
 */
import { useMemo } from 'react';
import type { ElementApi } from '@/lib/api';
import type { IdElement } from '@/config/banques';
import { GABARITS, gabaritMontantInconnu, texteAEcouter, type Ligne } from '@/config/gabarits';
import { bilanTransactions, listeOperations, PHRASES } from '@/config/phrases';
import {
  elementPourTexte,
  explicationErreur,
  lirePage,
  lireTransactions,
  nomDecouverte,
  normaliser,
  trouverDecouverte,
  type Decouverte,
  type ElementTrouve,
  type LecturePage,
} from '@/lib/lecture-page';
import { useLangueCourante } from '@/lib/langue-courante';
import { aplatir, useReponse } from '@/lib/use-reponse';
import { useTraductionTexte } from '@/lib/use-traduction';
import { traduireKama, traduireLibelle } from '@/lib/use-texte';
import {
  BandeauHorsLigne,
  BankErrorContent,
  ExplainPageContent,
  MontreMoi,
  NoTransactionsContent,
  Reflexion,
  SelectionTraduiteContent,
  SummaryContent,
  UntranslatedContent,
} from './contents';
import { Amount, KamaResponse, StatusBadge } from './parts';
import { AlertTriangle } from 'lucide-react';

export type VueReelle =
  | { type: 'expliquer' }
  | { type: 'resumer' }
  | { type: 'element'; id: IdElement }
  | { type: 'decouverte'; cle: string }
  | { type: 'selection'; texte: string };

/** `cible` = identifiant d'un élément connu ou clé d'un élément découvert. */
type MontrerFn = (cible: string) => void;

type Props = { vue: VueReelle; onShowMe: MontrerFn };

/** Nature de l'élément pour le serveur : tout ce qui touche à l'argent ou à la sécurité est « critique » (jamais de traduction automatique). */
const ELEMENT_API: Partial<Record<IdElement, ElementApi>> = {
  solde: 'balance',
  'montant-saisie': 'amount',
  montant: 'amount',
  frais: 'fee',
  total: 'total',
  confirmer: 'confirm',
  erreur: 'error',
};

export function ContenuReel({ vue, onShowMe }: Props) {
  // Lecture de la page au moment où la fenêtre affiche ce contenu.
  const lecture = useMemo(() => lirePage(), [vue]);

  switch (vue.type) {
    case 'expliquer':
      return <ExpliquerPage lecture={lecture} onShowMe={onShowMe} />;
    case 'resumer':
      return <ResumerTransactions lecture={lecture} />;
    case 'element':
      return <ExplicationElement id={vue.id} lecture={lecture} onShowMe={onShowMe} />;
    case 'decouverte': {
      const d = trouverDecouverte(lecture, vue.cle);
      if (!d) return <ElementIntrouvable />;
      return <ExplicationDecouverte d={d} onShowMe={onShowMe} />;
    }
    case 'selection': {
      const id = elementPourTexte(lecture, vue.texte);
      if (id) return <ExplicationElement id={id} lecture={lecture} onShowMe={onShowMe} />;
      // Texte quelconque : traduit s'il est validé ou s'il n'est pas critique ; sinon Kama le montre et propose de l'écouter en français.
      return <TexteLibre texte={vue.texte} />;
    }
  }
}

/**
 * Texte de la page que Kama ne connaît pas (sélection, nouveau message) : traduit s'il est validé ou s'il n'est pas critique ;
 * sinon Kama le montre tel quel et propose de l'écouter en français.
 */
function TexteLibre({ texte, onShowMe }: { texte: string; onShowMe?: () => void }) {
  const langue = useLangueCourante();
  const [t, reessayer] = useTraductionTexte(texte, 'text', langue);
  if (t.statut === 'chargement') return <Reflexion />;
  if (t.statut === 'ok') {
    return (
      <div className="flex flex-col gap-3">
        <SelectionTraduiteContent original={texte} traduction={rendre(t.lignes[0]!)} status={t.badge} paroles={t.paroles} />
        {onShowMe && (
          <div>
            <MontreMoi onClick={onShowMe} />
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      {t.statut === 'hors-ligne' && <BandeauHorsLigne onRetry={reessayer} />}
      <UntranslatedContent texte={texte} langue={langue?.nom} onShowMe={onShowMe} />
    </>
  );
}

function ElementIntrouvable() {
  const t = PHRASES.elementIntrouvable;
  const r = useReponse([[t]]);
  if (r.chargement) return <Reflexion />;
  return (
    <>
      {r.horsLigne && <BandeauHorsLigne onRetry={r.reessayer} />}
      <KamaResponse status={r.status} paroles={r.paroles} speech={t}>
        <p className="m-0">{aplatir(r.lignes[0]!)}</p>
      </KamaResponse>
    </>
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Expliquer cette page                                                                     */
/* ---------------------------------------------------------------------------------------- */

const TEXTE_ALERTE = 'La banque affiche un message important. Lis-le avant de continuer.';
const TEXTE_NOUVEAU = 'Un nouveau message est apparu sur la page. Lis-le.';

/** Étapes ajoutées pour ce que Kama a découvert tout seul (alertes, messages apparus). */
function etapesDecouvertes(lecture: LecturePage) {
  return lecture.decouvertes
    .filter((d) => d.nature === 'alerte' || d.nature === 'nouveau')
    .map((d) => ({ cible: d.cle, texte: d.nature === 'alerte' ? TEXTE_ALERTE : TEXTE_NOUVEAU }));
}

function ExpliquerPage({ lecture, onShowMe }: { lecture: LecturePage; onShowMe: MontrerFn }) {
  const etape = lecture.etape;
  // On ne propose « Montre-moi » que pour les éléments réellement présents sur la page.
  const etapes = etape ? [...etapesDecouvertes(lecture), ...etape.etapes.filter((e) => lecture.elements.has(e.cible))] : [];
  const lignes: Ligne[] | null = etape ? [[etape.phrase], ...etapes.map((e): Ligne => [e.texte])] : null;
  const r = useReponse(lignes);

  if (!etape) return <ExpliquerEcranInconnu lecture={lecture} onShowMe={onShowMe} />;
  if (r.chargement) return <Reflexion />;
  return (
    <>
      {r.horsLigne && <BandeauHorsLigne onRetry={r.reessayer} />}
      <ExplainPageContent
        status={r.status}
        paroles={r.paroles}
        phrase={aplatir(r.lignes[0]!)}
        etapes={etapes.map((e, i) => ({ cible: e.cible, texte: aplatir(r.lignes[i + 1]!) }))}
        speechFr={texteAEcouter(lignes!)}
        onShowMe={onShowMe}
      />
    </>
  );
}

/**
 * Écran que Kama ne connaît pas : il dit ce qu'il voit (titre, messages, montants, boutons),
 * avec les textes de la page recopiés tels quels, et « Montre-moi » pour chacun.
 * Seules les phrases fixes de Kama passent par la traduction : les textes de la page restent tels quels.
 */
function ExpliquerEcranInconnu({ lecture, onShowMe }: { lecture: LecturePage; onShowMe: MontrerFn }) {
  const langue = useLangueCourante();
  const tr = (fr: string) => traduireKama(langue?.code, fr);
  let premierTitre = true;
  const etapes = lecture.decouvertes
    .map((d) => {
      switch (d.nature) {
        case 'titre': {
          const t = premierTitre ? `La page s'appelle « ${d.texte} ».` : `Partie « ${d.texte} ».`;
          premierTitre = false;
          return { cible: d.cle, texte: t };
        }
        case 'alerte':
          return { cible: d.cle, texte: tr(TEXTE_ALERTE) };
        case 'nouveau':
          return { cible: d.cle, texte: tr(TEXTE_NOUVEAU) };
        case 'montant':
          return { cible: d.cle, texte: `${d.libelle ?? 'Montant affiché'} : ${d.valeur}.` };
        case 'bouton':
          return { cible: d.cle, texte: `Bouton « ${d.texte} ». C'est toi qui décides d'appuyer.` };
      }
    })
    .slice(0, 8);

  const phrase = etapes.length ? "Kama ne connaît pas encore cette page. Voici ce qu'il y voit." : null;
  const [t1, t2] = PHRASES.pageNonReconnue;
  const r = useReponse(phrase ? [[phrase]] : [[t1], [t2]]);
  if (r.chargement) return <Reflexion />;

  if (!phrase) {
    return (
      <>
        {r.horsLigne && <BandeauHorsLigne onRetry={r.reessayer} />}
        <KamaResponse status={r.status} paroles={r.paroles} speech={`${t1} ${t2}`}>
          <p className="m-0 font-semibold">{aplatir(r.lignes[0]!)}</p>
          <p className="m-0">{aplatir(r.lignes[1]!)}</p>
        </KamaResponse>
      </>
    );
  }
  return (
    <ExplainPageContent
      status="untranslated"
      phrase={aplatir(r.lignes[0]!)}
      etapes={etapes}
      speechFr={[phrase, ...etapes.map((e) => e.texte)].join(' ')}
      onShowMe={onShowMe}
    />
  );
}

/* ---------------------------------------------------------------------------------------- */

function ResumerTransactions({ lecture }: { lecture: LecturePage }) {
  const langue = useLangueCourante();
  const operations = lireTransactions(lecture).map((o) => ({
    ...o,
    libelleTraduit: traduireLibelle(langue?.code, o.libelle),
  }));
  const entrees = operations.filter((o) => o.sens === 'entree').length;
  const sorties = operations.length - entrees;
  const lignes: Ligne[] = operations.length
    ? [bilanTransactions(String(entrees), String(sorties)), listeOperations(String(operations.length))]
    : PHRASES.pasDeTransactions.map((t): Ligne => [t]);
  const r = useReponse(lignes, 'text');

  if (r.chargement) return <Reflexion />;
  const retour = r.horsLigne ? <BandeauHorsLigne onRetry={r.reessayer} /> : null;

  if (!operations.length) {
    return (
      <>
        {retour}
        <NoTransactionsContent
          status={r.status}
          paroles={r.paroles}
          phrase={aplatir(r.lignes[0]!)}
          destination={aplatir(r.lignes[1]!)}
          speechFr={texteAEcouter(lignes)}
        />
      </>
    );
  }
  // Les libellés viennent du glossaire local ; les montants restent ceux de la page et ne sont jamais envoyés (sécurité).
  // Pas encore traduit : le bilan français par défaut (avec « 1 entrée » au singulier).
  return (
    <>
      {retour}
      <SummaryContent
        status={r.status}
        paroles={r.paroles}
        entrees={String(entrees)}
        sorties={String(sorties)}
        operations={operations}
        bilan={r.status === 'untranslated' ? undefined : rendre(r.lignes[0]!)}
        introListe={aplatir(r.lignes[1]!)}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Explication d'un élément                                                                 */
/* ---------------------------------------------------------------------------------------- */

function ExplicationElement({ id, lecture, onShowMe }: { id: IdElement; lecture: LecturePage; onShowMe: MontrerFn }) {
  const e = lecture.elements.get(id);
  if (!e) return <ElementIntrouvable />;

  // Erreur ou alerte de la banque : message original + explication franche.
  if (e.def.nature === 'erreur') return <ReponseErreur code={e.code} message={e.message} libelle={e.libelleTexte} />;

  return <ReponseGabarit id={id} e={e} total={lecture.elements.get('total')?.valeur} onShowMe={onShowMe} />;
}

/**
 * Message d'erreur ou d'alerte de la banque (connu ou découvert par Kama) : message original + explication franche.
 * Aucun calcul : Kama ne produit jamais un montant qui n'est pas écrit sur la page.
 */
function ReponseErreur({ code, message, libelle }: { code?: string; message?: string; libelle: string }) {
  const explication = explicationErreur(code, message);
  const lignes: Ligne[] = [[explication.titre], [explication.conseil]];
  const r = useReponse(lignes, 'error');

  // Le message de la banque lui-même : traduit s'il figure dans le glossaire de la page de test (validé par un locuteur), ou s'il est
  // inconnu de Kama (ex. « Message important » ajouté par le jury). S'il est critique, le serveur ne le traduit que validé ; sinon
  // le texte original reste seul affiché.
  const langue = useLangueCourante();
  const nature = normaliser(libelle);
  const element: ElementApi = /alerte de sécurité|security warning/.test(nature)
    ? 'warning'
    : /erreur est survenue|error occurred/.test(nature)
      ? 'error'
      : 'text';
  const [m] = useTraductionTexte(message ?? null, element, langue);

  if (r.chargement) return <Reflexion />;
  const messageTraduit =
    m.statut === 'ok' ? (
      <div className="flex flex-col gap-1.5 rounded-lg border border-kama-ink/10 p-3">
        <StatusBadge status={m.badge} />
        <p className="m-0 text-sm font-medium">{rendre(m.lignes[0]!)}</p>
      </div>
    ) : null;

  return (
    <>
      {r.horsLigne && <BandeauHorsLigne onRetry={r.reessayer} />}
      <BankErrorContent
        status={r.status}
        paroles={r.paroles}
        messageBanque={message ?? libelle}
        code={code}
        titre={aplatir(r.lignes[0]!)}
        conseil={aplatir(r.lignes[1]!)}
        messageTraduit={messageTraduit}
        speechFr={texteAEcouter(lignes)}
      />
    </>
  );
}

function ReponseGabarit({
  id,
  e,
  total,
  onShowMe,
}: {
  id: IdElement;
  e: ElementTrouve;
  total?: string;
  onShowMe: MontrerFn;
}) {
  const gabarit = GABARITS[id];
  const base = gabarit ? gabarit({ libelle: e.def.libelles[0] ?? e.libelleTexte, valeur: e.valeur, total }) : null;
  const langue = useLangueCourante();
  const nomTraduit = traduireLibelle(langue?.code, e.libelleTexte);
  const nom = nomTraduit !== e.libelleTexte ? nomTraduit : traduireKama(langue?.code, e.def.nom);
  const r = useReponse(base ? base.lignes : null, ELEMENT_API[id] ?? 'text');
  if (!base) return null;
  if (r.chargement) return <Reflexion />;
  return (
    <Explication
      nom={nom}
      lignes={r.lignes}
      alerte={base.alerte}
      status={r.status}
      paroles={r.paroles}
      speechFr={texteAEcouter(base.lignes)}
      horsLigne={r.horsLigne ? r.reessayer : undefined}
      onShowMe={() => onShowMe(id)}
    />
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Éléments découverts par Kama (contenu inédit)                                            */
/* ---------------------------------------------------------------------------------------- */

function ExplicationDecouverte({ d, onShowMe }: { d: Decouverte; onShowMe: MontrerFn }) {
  switch (d.nature) {
    case 'alerte':
      return <ReponseErreur code={d.code} message={d.texte} libelle={d.texte ?? ''} />;
    case 'montant':
      return <MontantDecouvert d={d} onShowMe={() => onShowMe(d.cle)} />;
    default:
      return <TexteLibre texte={d.texte ?? ''} onShowMe={() => onShowMe(d.cle)} />;
  }
}

/**
 * Montant que Kama ne connaît pas : recopié tel quel avec son libellé de la page. Seule la phrase fixe
 * de Kama passe par la traduction ; le libellé de la page n'est pas envoyé.
 */
function MontantDecouvert({ d, onShowMe }: { d: Decouverte; onShowMe: () => void }) {
  const langue = useLangueCourante();
  const { lignes } = gabaritMontantInconnu({ libelle: d.libelle, valeur: d.valeur! });
  const r = useReponse([lignes[1]!], 'amount');
  if (r.chargement) return <Reflexion />;
  return (
    <Explication
      nom={traduireKama(langue?.code, nomDecouverte(d))}
      lignes={[lignes[0]!, ...r.lignes]}
      status={r.status}
      paroles={r.paroles}
      speechFr={texteAEcouter(lignes)}
      onShowMe={onShowMe}
    />
  );
}

/* ---------------------------------------------------------------------------------------- */

function Explication({
  nom,
  lignes,
  alerte,
  status,
  paroles,
  speechFr,
  horsLigne,
  onShowMe,
}: {
  nom: string;
  lignes: Ligne[];
  alerte?: boolean;
  status: 'verified' | 'auto' | 'untranslated';
  paroles?: Parameters<typeof KamaResponse>[0]['paroles'];
  speechFr: string;
  /** Traduction impossible faute de réseau : bandeau avec « Réessayer ». */
  horsLigne?: () => void;
  onShowMe: () => void;
}) {
  const langue = useLangueCourante();
  const elementChoisi = traduireKama(langue?.code, 'Élément choisi :');
  const contenu = lignes.map((l, i) => (
    <p key={i} className={`m-0 ${i === 0 ? 'font-semibold' : ''}`}>
      {rendre(l)}
    </p>
  ));
  return (
    <div className="flex flex-col gap-3">
      <span className="self-start rounded-md border border-bank-border bg-bank-bg px-2 py-1 text-xs text-bank-text">
        {elementChoisi} <strong>{nom}</strong>
      </span>
      {horsLigne && <BandeauHorsLigne onRetry={horsLigne} />}
      <KamaResponse status={status} paroles={paroles} speech={speechFr}>
        {alerte ? (
          <div className="flex gap-2.5 rounded-xl border-2 border-kama-error p-3" role="alert">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-kama-error" aria-hidden />
            <div className="flex flex-col gap-1">{contenu}</div>
          </div>
        ) : (
          contenu
        )}
        <div>
          <MontreMoi onClick={onShowMe} />
        </div>
      </KamaResponse>
    </div>
  );
}

function rendre(ligne: Ligne) {
  return ligne.map((m, i) => (typeof m === 'string' ? m : <Amount key={i}>{m.montant}</Amount>));
}
