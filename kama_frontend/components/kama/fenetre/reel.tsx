/**
 * Contenus de la fenêtre construits à partir de la VRAIE page (et non des exemples Lovable).
 * La page est relue au moment d'afficher le contenu ; rien n'est stocké.
 *
 * Badge « Pas encore traduit » partout : les explications sont des gabarits en français
 * tant que les textes validés en ghomálá' et en pidgin ne sont pas fournis (règle d'or n° 4).
 *
 * Deux sortes d'éléments :
 *  - les éléments connus (config/banques/), expliqués par leurs gabarits ;
 *  - les éléments découverts par Kama (contenu inédit) : montants, alertes, nouveaux messages.
 *    Kama les recopie tels quels et dit franchement qu'il ne les connaît pas encore.
 */
import { useMemo } from 'react';
import type { IdElement } from '@/config/banques';
import { GABARITS, gabaritMontantInconnu, texteAEcouter, type Ligne } from '@/config/gabarits';
import {
  elementPourTexte,
  explicationErreur,
  lirePage,
  lireTransactions,
  nomDecouverte,
  trouverDecouverte,
  type Decouverte,
  type LecturePage,
} from '@/lib/lecture-page';
import { useLangueCourante } from '@/lib/langue-courante';
import {
  BankErrorContent,
  ExplainPageContent,
  MontreMoi,
  NoTransactionsContent,
  SummaryContent,
  UntranslatedContent,
} from './contents';
import { Amount, KamaResponse } from './parts';
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

export function ContenuReel({ vue, onShowMe }: Props) {
  // Lecture de la page au moment où la fenêtre affiche ce contenu.
  const lecture = useMemo(() => lirePage(), [vue]);
  const langue = useLangueCourante();

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
      // Texte quelconque : Kama ne l'invente pas, il le montre et propose de l'écouter en français.
      return <UntranslatedContent texte={vue.texte} langue={langue?.nom} />;
    }
  }
}

function PlusSurLaPage() {
  const t = 'Kama ne trouve plus cet élément sur la page.';
  return (
    <KamaResponse status="untranslated" speech={t}>
      <p className="m-0">{t}</p>
    </KamaResponse>
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
  if (!etape) return <ExpliquerEcranInconnu lecture={lecture} onShowMe={onShowMe} />;
  // On ne propose « Montre-moi » que pour les éléments réellement présents sur la page.
  const etapes = [...etapesDecouvertes(lecture), ...etape.etapes.filter((e) => lecture.elements.has(e.cible))];
  return <ExplainPageContent status="untranslated" phrase={etape.phrase} etapes={etapes} onShowMe={onShowMe} />;
}

/**
 * Écran que Kama ne connaît pas : il dit ce qu'il voit (titre, messages, montants, boutons),
 * avec les textes de la page recopiés tels quels, et « Montre-moi » pour chacun.
 */
function ExpliquerEcranInconnu({ lecture, onShowMe }: { lecture: LecturePage; onShowMe: MontrerFn }) {
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
          return { cible: d.cle, texte: TEXTE_ALERTE };
        case 'nouveau':
          return { cible: d.cle, texte: TEXTE_NOUVEAU };
        case 'montant':
          return { cible: d.cle, texte: `${d.libelle ?? 'Montant affiché'} : ${d.valeur}.` };
        case 'bouton':
          return { cible: d.cle, texte: `Bouton « ${d.texte} ». C'est toi qui décides d'appuyer.` };
      }
    })
    .slice(0, 8);

  if (!etapes.length) {
    const t1 = 'Kama ne reconnaît pas encore cette partie de la page.';
    const t2 = "Touche une pastille Kama à côté d'un montant ou d'un bouton.";
    return (
      <KamaResponse status="untranslated" speech={`${t1} ${t2}`}>
        <p className="m-0 font-semibold">{t1}</p>
        <p className="m-0">{t2}</p>
      </KamaResponse>
    );
  }
  return (
    <ExplainPageContent
      status="untranslated"
      phrase="Kama ne connaît pas encore cette page. Voici ce qu'il y voit."
      etapes={etapes}
      onShowMe={onShowMe}
    />
  );
}

/* ---------------------------------------------------------------------------------------- */

function ResumerTransactions({ lecture }: { lecture: LecturePage }) {
  const operations = lireTransactions(lecture);
  if (!operations.length) {
    return <NoTransactionsContent status="untranslated" destination="Va sur la première page : « Solde »." />;
  }
  const entrees = operations.filter((o) => o.sens === 'entree').length;
  return (
    <SummaryContent
      status="untranslated"
      entrees={String(entrees)}
      sorties={String(operations.length - entrees)}
      operations={operations}
    />
  );
}

/* ---------------------------------------------------------------------------------------- */
/* Explication d'un élément                                                                 */
/* ---------------------------------------------------------------------------------------- */

function ExplicationElement({ id, lecture, onShowMe }: { id: IdElement; lecture: LecturePage; onShowMe: MontrerFn }) {
  const e = lecture.elements.get(id);
  if (!e) return <PlusSurLaPage />;

  const total = lecture.elements.get('total')?.valeur;

  // Erreur ou alerte de la banque : message original + explication franche.
  if (e.def.nature === 'erreur') {
    // Aucun calcul : Kama ne produit jamais un montant qui n'est pas écrit sur la page.
    const explication = explicationErreur(e.code, e.message);
    return (
      <BankErrorContent
        status="untranslated"
        messageBanque={e.message ?? e.libelleTexte}
        code={e.code}
        titre={explication.titre}
        conseil={explication.conseil}
      />
    );
  }

  const gabarit = GABARITS[id];
  if (!gabarit) return null;
  const { lignes, alerte } = gabarit({ libelle: e.libelleTexte, valeur: e.valeur, total });
  return <Explication nom={e.def.nom} lignes={lignes} alerte={alerte} onShowMe={() => onShowMe(id)} />;
}

function ExplicationDecouverte({ d, onShowMe }: { d: Decouverte; onShowMe: MontrerFn }) {
  const langue = useLangueCourante();
  switch (d.nature) {
    case 'alerte': {
      const explication = explicationErreur(d.code, d.texte);
      return (
        <BankErrorContent
          status="untranslated"
          messageBanque={d.texte ?? ''}
          code={d.code}
          titre={explication.titre}
          conseil={explication.conseil}
        />
      );
    }
    case 'montant': {
      const { lignes } = gabaritMontantInconnu({ libelle: d.libelle, valeur: d.valeur! });
      return <Explication nom={nomDecouverte(d)} lignes={lignes} onShowMe={() => onShowMe(d.cle)} />;
    }
    default:
      return <UntranslatedContent texte={d.texte ?? ''} langue={langue?.nom} onShowMe={() => onShowMe(d.cle)} />;
  }
}

function Explication({
  nom,
  lignes,
  alerte,
  onShowMe,
}: {
  nom: string;
  lignes: Ligne[];
  alerte?: boolean;
  onShowMe: () => void;
}) {
  const contenu = lignes.map((l, i) => (
    <p key={i} className={`m-0 ${i === 0 ? 'font-semibold' : ''}`}>
      {rendre(l)}
    </p>
  ));
  return (
    <div className="flex flex-col gap-3">
      <span className="self-start rounded-md border border-bank-border bg-bank-bg px-2 py-1 text-xs text-bank-text">
        Élément choisi : <strong>{nom}</strong>
      </span>
      <KamaResponse status="untranslated" speech={texteAEcouter(lignes)}>
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
