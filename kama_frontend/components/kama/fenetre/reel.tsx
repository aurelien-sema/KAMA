/**
 * Contenus de la fenêtre construits à partir de la VRAIE page (et non des exemples Lovable).
 * La page est relue au moment d'afficher le contenu ; rien n'est stocké.
 *
 * Chaque réponse passe par la traduction (lib/traduction.ts) : glossaire local validé d'abord, puis le serveur avec des textes
 * masqués. Tant qu'une phrase n'est pas validée en ghomálá' ou en pidgin, Kama montre le gabarit français avec le badge
 * « Pas encore traduit » (règle d'or n° 4). Les montants sont ceux de la page, recopiés tels quels (règle d'or n° 1).
 */
import { useMemo } from 'react';
import type { ElementApi } from '@/lib/api';
import type { IdElement } from '@/config/page-test';
import { ERREURS } from '@/config/page-test';
import { GABARITS, texteAEcouter, type Ligne } from '@/config/gabarits';
import { bilanTransactions, listeOperations, PHRASES } from '@/config/phrases';
import {
  elementPourTexte,
  explicationErreur,
  lirePage,
  lireTransactions,
  normaliser,
  type ElementTrouve,
  type LecturePage,
} from '@/lib/lecture-page';
import { useLangueCourante } from '@/lib/langue-courante';
import { aplatir, useReponse } from '@/lib/use-reponse';
import { useTraductionTexte } from '@/lib/use-traduction';
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
  | { type: 'selection'; texte: string };

type Props = { vue: VueReelle; onShowMe: (id: IdElement) => void };

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
    case 'selection': {
      const id = elementPourTexte(lecture, vue.texte);
      if (id) return <ExplicationElement id={id} lecture={lecture} onShowMe={onShowMe} />;
      // Texte quelconque : traduit s'il est validé ou s'il n'est pas critique ; sinon Kama le montre et propose de l'écouter en français.
      return <SelectionLibre texte={vue.texte} />;
    }
  }
}

function SelectionLibre({ texte }: { texte: string }) {
  const langue = useLangueCourante();
  const [t, reessayer] = useTraductionTexte(texte, 'text', langue);
  if (t.statut === 'chargement') return <Reflexion />;
  if (t.statut === 'ok') {
    return <SelectionTraduiteContent original={texte} traduction={rendre(t.lignes[0]!)} status={t.badge} paroles={t.paroles} />;
  }
  return (
    <>
      {t.statut === 'hors-ligne' && <BandeauHorsLigne onRetry={reessayer} />}
      <UntranslatedContent texte={texte} langue={langue?.nom} />
    </>
  );
}

function ExpliquerPage({ lecture, onShowMe }: { lecture: LecturePage; onShowMe: (id: IdElement) => void }) {
  const etape = lecture.etape;
  // On ne propose « Montre-moi » que pour les éléments réellement présents sur la page.
  const etapes = etape ? etape.etapes.filter((e) => lecture.elements.has(e.cible)) : [];
  const [t1, t2] = PHRASES.pageNonReconnue;
  const lignes: Ligne[] = etape ? [[etape.phrase], ...etapes.map((e) => [e.texte])] : [[t1], [t2]];
  const r = useReponse(lignes);

  if (r.chargement) return <Reflexion />;
  const retour = r.horsLigne ? <BandeauHorsLigne onRetry={r.reessayer} /> : null;

  if (!etape) {
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
        onShowMe={(cible) => onShowMe(cible as IdElement)}
      />
    </>
  );
}

function ResumerTransactions({ lecture }: { lecture: LecturePage }) {
  const operations = lireTransactions(lecture);
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
        <NoTransactionsContent status={r.status} paroles={r.paroles} phrase={aplatir(r.lignes[0]!)} destination={aplatir(r.lignes[1]!)} />
      </>
    );
  }
  // Les libellés et montants des opérations restent affichés tels quels et ne sont jamais envoyés (sécurité).
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

function ExplicationElement({
  id,
  lecture,
  onShowMe,
}: {
  id: IdElement;
  lecture: LecturePage;
  onShowMe: (id: IdElement) => void;
}) {
  const e = lecture.elements.get(id);
  if (!e) return <ElementIntrouvable />;

  // Erreur ou alerte de la banque : message original + explication franche.
  if (e.def.nature === 'erreur') return <ReponseErreur e={e} />;

  return <ReponseGabarit id={id} e={e} total={lecture.elements.get('total')?.valeur} onShowMe={onShowMe} />;
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

function ReponseErreur({ e }: { e: ElementTrouve }) {
  // Aucun calcul : Kama ne produit jamais un montant qui n'est pas écrit sur la page.
  const explication = explicationErreur(e.code, e.message);
  const lignes: Ligne[] = [[explication.titre], [explication.conseil]];
  const r = useReponse(lignes, 'error');

  // Message inconnu de Kama (ex. « Message important » ajouté par le jury) : on tente aussi de le traduire. S'il est critique,
  // le serveur ne le traduit que s'il est validé ; sinon le texte original reste seul affiché.
  const langue = useLangueCourante();
  const inconnu = !(e.code && ERREURS[e.code]) && !!e.message;
  const nature = normaliser(e.libelleTexte);
  const element: ElementApi = /alerte de sécurité|security warning/.test(nature)
    ? 'warning'
    : /erreur est survenue|error occurred/.test(nature)
      ? 'error'
      : 'text';
  const [m] = useTraductionTexte(inconnu ? e.message! : null, element, langue);

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
        messageBanque={e.message ?? e.libelleTexte}
        code={e.code}
        titre={aplatir(r.lignes[0]!)}
        conseil={aplatir(r.lignes[1]!)}
        messageTraduit={messageTraduit}
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
  onShowMe: (id: IdElement) => void;
}) {
  const gabarit = GABARITS[id];
  const base = gabarit ? gabarit({ libelle: e.libelleTexte, valeur: e.valeur, total }) : null;
  const r = useReponse(base ? base.lignes : null, ELEMENT_API[id] ?? 'text');
  if (!base) return null;
  if (r.chargement) return <Reflexion />;

  const contenu = r.lignes.map((l, i) => (
    <p key={i} className={`m-0 ${i === 0 ? 'font-semibold' : ''}`}>
      {rendre(l)}
    </p>
  ));

  return (
    <div className="flex flex-col gap-3">
      <span className="self-start rounded-md border border-bank-border bg-bank-bg px-2 py-1 text-xs text-bank-text">
        Élément choisi : <strong>{e.def.nom}</strong>
      </span>
      {r.horsLigne && <BandeauHorsLigne onRetry={r.reessayer} />}
      <KamaResponse status={r.status} paroles={r.paroles} speech={texteAEcouter(base.lignes)}>
        {base.alerte ? (
          <div className="flex gap-2.5 rounded-xl border-2 border-kama-error p-3" role="alert">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-kama-error" aria-hidden />
            <div className="flex flex-col gap-1">{contenu}</div>
          </div>
        ) : (
          contenu
        )}
        <div>
          <MontreMoi onClick={() => onShowMe(id)} />
        </div>
      </KamaResponse>
    </div>
  );
}

function rendre(ligne: Ligne) {
  return ligne.map((m, i) => (typeof m === 'string' ? m : <Amount key={i}>{m.montant}</Amount>));
}

