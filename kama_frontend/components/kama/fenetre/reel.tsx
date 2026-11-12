/**
 * Contenus de la fenêtre construits à partir de la VRAIE page (et non des exemples Lovable).
 * La page est relue au moment d'afficher le contenu ; rien n'est stocké.
 *
 * Deux sortes d'éléments :
 *  - les éléments connus (config/banques/), expliqués par leurs gabarits ;
 *  - les éléments découverts par Kama (contenu inédit) : montants, alertes, nouveaux messages.
 *    Kama les recopie tels quels et dit franchement qu'il ne les connaît pas encore.
 *
 * Chaque réponse passe par la traduction (lib/traduction.ts) : glossaire local validé d'abord, puis le serveur avec des textes
 * masqués. Tant qu'une phrase n'est pas traduite, Kama montre le gabarit français avec le badge « Pas encore traduit »
 * (règle d'or n° 4). Les montants sont ceux de la page, recopiés tels quels et jamais envoyés (règle d'or n° 1).
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

/** Nature de l'élément pour le serveur : tout ce qui touche à l'argent ou à la sécurité est « critique ». */
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
      if (!d) return <PlusSurLaPage />;
      return <ExplicationDecouverte d={d} onShowMe={onShowMe} />;
    }
    case 'selection': {
      const id = elementPourTexte(lecture, vue.texte);
      if (id) return <ExplicationElement id={id} lecture={lecture} onShowMe={onShowMe} />;
      // Texte quelconque : traduit s'il est validé ou s'il n'est pas critique ; sinon Kama le montre tel quel.
      return <TexteLibre texte={vue.texte} />;
    }
  }
}

/** Texte de la page (sélection, nouveau message découvert) : traduit si possible, sinon montré tel quel. */
function TexteLibre({ texte, onShowMe }: { texte: string; onShowMe?: () => void }) {
  const langue = useLangueCourante();
  const [t, reessayer] = useTraductionTexte(texte, 'text', langue);
  if (t.statut === 'chargement') return <Reflexion />;
  if (t.statut === 'ok') {
    return <SelectionTraduiteContent original={texte} traduction={rendre(t.lignes[0]!)} status={t.badge} paroles={t.paroles} />;
  }
  return (
    <>
      {t.statut === 'hors-ligne' && <BandeauHorsLigne onRetry={reessayer} />}
      <UntranslatedContent texte={texte} langue={langue?.nom} onShowMe={onShowMe} />
    </>
  );
}

/** Élément qui n'est plus sur la page (elle a changé entre-temps). */
function PlusSurLaPage() {
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
const PAGE_INCONNUE = "Kama ne connaît pas encore cette page. Voici ce qu'il y voit.";

type EtapeLue = { cible: string; ligne: Ligne };

/** Étapes ajoutées pour ce que Kama a découvert tout seul (alertes, messages apparus). */
function etapesDecouvertes(lecture: LecturePage): EtapeLue[] {
  return lecture.decouvertes
    .filter((d) => d.nature === 'alerte' || d.nature === 'nouveau')
    .map((d) => ({ cible: d.cle, ligne: [d.nature === 'alerte' ? TEXTE_ALERTE : TEXTE_NOUVEAU] }));
}

/**
 * Écran que Kama ne connaît pas : il dit ce qu'il voit (titre, messages, montants, boutons), avec les textes de la page
 * recopiés tels quels, et « Montre-moi » pour chacun. Les montants restent des montants (jamais envoyés à la traduction).
 */
function etapesEcranInconnu(lecture: LecturePage): EtapeLue[] {
  let premierTitre = true;
  return lecture.decouvertes
    .map((d): EtapeLue => {
      switch (d.nature) {
        case 'titre': {
          const ligne: Ligne = premierTitre ? [`La page s'appelle « ${d.texte} ».`] : [`Partie « ${d.texte} ».`];
          premierTitre = false;
          return { cible: d.cle, ligne };
        }
        case 'alerte':
          return { cible: d.cle, ligne: [TEXTE_ALERTE] };
        case 'nouveau':
          return { cible: d.cle, ligne: [TEXTE_NOUVEAU] };
        case 'montant':
          return { cible: d.cle, ligne: [`${d.libelle ?? 'Montant affiché'} : `, { montant: d.valeur ?? '' }, '.'] };
        case 'bouton':
          return { cible: d.cle, ligne: [`Bouton « ${d.texte} ». C'est toi qui décides d'appuyer.`] };
      }
    })
    .slice(0, 8);
}

function ExpliquerPage({ lecture, onShowMe }: { lecture: LecturePage; onShowMe: MontrerFn }) {
  const etape = lecture.etape;
  const etapes: EtapeLue[] = etape
    ? // On ne propose « Montre-moi » que pour les éléments réellement présents sur la page.
      [
        ...etapesDecouvertes(lecture),
        ...etape.etapes.filter((e) => lecture.elements.has(e.cible)).map((e) => ({ cible: e.cible, ligne: [e.texte] as Ligne })),
      ]
    : etapesEcranInconnu(lecture);
  const [t1, t2] = PHRASES.pageNonReconnue;
  const sansRien = !etape && !etapes.length;
  const lignes: Ligne[] = sansRien ? [[t1], [t2]] : [[etape ? etape.phrase : PAGE_INCONNUE], ...etapes.map((e) => e.ligne)];
  const r = useReponse(lignes);

  if (r.chargement) return <Reflexion />;
  const retour = r.horsLigne ? <BandeauHorsLigne onRetry={r.reessayer} /> : null;

  if (sansRien) {
    return (
      <>
        {retour}
        <KamaResponse status={r.status} paroles={r.paroles} speech={`${t1} ${t2}`}>
          <p className="m-0 font-semibold">{aplatir(r.lignes[0]!)}</p>
          <p className="m-0">{aplatir(r.lignes[1]!)}</p>
        </KamaResponse>
      </>
    );
  }
  return (
    <>
      {retour}
      <ExplainPageContent
        status={r.status}
        paroles={r.paroles}
        phrase={aplatir(r.lignes[0]!)}
        etapes={etapes.map((e, i) => ({ cible: e.cible, texte: aplatir(r.lignes[i + 1]!) }))}
        speechFr={texteAEcouter(lignes)}
        onShowMe={onShowMe}
      />
    </>
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
  return (
    <>
      {retour}
      <SummaryContent
        status={r.status}
        paroles={r.paroles}
        entrees={String(entrees)}
        sorties={String(sorties)}
        operations={operations}
        bilan={rendre(r.lignes[0]!)}
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
  if (!e) return <PlusSurLaPage />;

  // Erreur ou alerte de la banque : message original + explication franche.
  if (e.def.nature === 'erreur') return <ReponseErreur code={e.code} message={e.message} libelleTexte={e.libelleTexte} />;

  const gabarit = GABARITS[id];
  if (!gabarit) return null;
  const { lignes, alerte } = gabarit({ libelle: e.def.libelles[0] ?? e.libelleTexte, valeur: e.valeur, total: lecture.elements.get('total')?.valeur });
  return (
    <Explication
      nomFr={e.def.nom}
      libellePage={e.libelleTexte}
      lignes={lignes}
      alerte={alerte}
      element={ELEMENT_API[id] ?? 'text'}
      onShowMe={() => onShowMe(id)}
    />
  );
}

function ExplicationDecouverte({ d, onShowMe }: { d: Decouverte; onShowMe: MontrerFn }) {
  switch (d.nature) {
    case 'alerte':
      return <ReponseErreur code={d.code} message={d.texte} libelleTexte={d.texte ?? ''} />;
    case 'montant': {
      const { lignes } = gabaritMontantInconnu({ libelle: d.libelle, valeur: d.valeur! });
      return <Explication nomFr={nomDecouverte(d)} lignes={lignes} element="amount" onShowMe={() => onShowMe(d.cle)} />;
    }
    default:
      return <TexteLibre texte={d.texte ?? ''} onShowMe={() => onShowMe(d.cle)} />;
  }
}

function ReponseErreur({ code, message, libelleTexte }: { code?: string; message?: string; libelleTexte: string }) {
  // Aucun calcul : Kama ne produit jamais un montant qui n'est pas écrit sur la page.
  const explication = explicationErreur(code, message);
  const lignes: Ligne[] = [[explication.titre], [explication.conseil]];
  const r = useReponse(lignes, 'error');

  // Le message de la banque lui-même : traduit s'il figure dans le glossaire de la page de test (validé par un locuteur), ou s'il est
  // inconnu de Kama (ex. « Message important » ajouté par le jury). S'il est critique, le serveur ne le traduit que s'il y est autorisé ;
  // sinon le texte original reste seul affiché.
  const langue = useLangueCourante();
  const nature = normaliser(libelleTexte);
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
        messageBanque={message ?? libelleTexte}
        code={code}
        titre={aplatir(r.lignes[0]!)}
        conseil={aplatir(r.lignes[1]!)}
        messageTraduit={messageTraduit}
        speechFr={texteAEcouter(lignes)}
      />
    </>
  );
}

function Explication({
  nomFr,
  libellePage,
  lignes,
  alerte,
  element,
  onShowMe,
}: {
  nomFr: string;
  /** Libellé tel qu'écrit sur la page (traduit s'il est dans le glossaire de la page de test). */
  libellePage?: string;
  lignes: Ligne[];
  alerte?: boolean;
  element: ElementApi;
  onShowMe: () => void;
}) {
  const langue = useLangueCourante();
  const nomTraduit = libellePage ? traduireLibelle(langue?.code, libellePage) : undefined;
  const nom = nomTraduit && nomTraduit !== libellePage ? nomTraduit : traduireKama(langue?.code, nomFr);
  const elementChoisi = traduireKama(langue?.code, 'Élément choisi :');
  const r = useReponse(lignes, element);
  if (r.chargement) return <Reflexion />;

  const contenu = r.lignes.map((l, i) => (
    <p key={i} className={`m-0 ${i === 0 ? 'font-semibold' : ''}`}>
      {rendre(l)}
    </p>
  ));
  return (
    <div className="flex flex-col gap-3">
      <span className="self-start rounded-md border border-bank-border bg-bank-bg px-2 py-1 text-xs text-bank-text">
        {elementChoisi} <strong>{nom}</strong>
      </span>
      {r.horsLigne && <BandeauHorsLigne onRetry={r.reessayer} />}
      <KamaResponse status={r.status} paroles={r.paroles} speech={texteAEcouter(lignes)}>
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
