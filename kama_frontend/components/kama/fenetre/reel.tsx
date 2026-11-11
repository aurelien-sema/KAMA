/**
 * Contenus de la fenêtre construits à partir de la VRAIE page (et non des exemples Lovable).
 * La page est relue au moment d'afficher le contenu ; rien n'est stocké.
 *
 * Badge « Pas encore traduit » partout : les explications sont des gabarits en français
 * tant que les textes validés en ghomálá' et en pidgin ne sont pas fournis (règle d'or n° 4).
 */
import { useMemo } from 'react';
import type { IdElement } from '@/config/page-test';
import { GABARITS, texteAEcouter, type Ligne } from '@/config/gabarits';
import {
  elementPourTexte,
  explicationErreur,
  lirePage,
  lireTransactions,
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
  | { type: 'selection'; texte: string };

type Props = { vue: VueReelle; onShowMe: (id: IdElement) => void };

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
    case 'selection': {
      const id = elementPourTexte(lecture, vue.texte);
      if (id) return <ExplicationElement id={id} lecture={lecture} onShowMe={onShowMe} />;
      // Texte quelconque : Kama ne l'invente pas, il le montre et propose de l'écouter en français.
      return <UntranslatedContent texte={vue.texte} langue={langue?.nom} />;
    }
  }
}

function ExpliquerPage({ lecture, onShowMe }: { lecture: LecturePage; onShowMe: (id: IdElement) => void }) {
  const etape = lecture.etape;
  if (!etape) {
    const t1 = 'Kama ne reconnaît pas encore cette partie de la page.';
    const t2 = "Touche une pastille Kama à côté d'un montant ou d'un bouton.";
    return (
      <KamaResponse status="untranslated" speech={`${t1} ${t2}`}>
        <p className="m-0 font-semibold">{t1}</p>
        <p className="m-0">{t2}</p>
      </KamaResponse>
    );
  }
  // On ne propose « Montre-moi » que pour les éléments réellement présents sur la page.
  const etapes = etape.etapes.filter((e) => lecture.elements.has(e.cible));
  return (
    <ExplainPageContent
      status="untranslated"
      phrase={etape.phrase}
      etapes={etapes}
      onShowMe={(cible) => onShowMe(cible as IdElement)}
    />
  );
}

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
  if (!e) {
    const t = 'Kama ne trouve plus cet élément sur la page.';
    return (
      <KamaResponse status="untranslated" speech={t}>
        <p className="m-0">{t}</p>
      </KamaResponse>
    );
  }

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
  const contenu = lignes.map((l, i) => (
    <p key={i} className={`m-0 ${i === 0 ? 'font-semibold' : ''}`}>
      {rendre(l)}
    </p>
  ));

  return (
    <div className="flex flex-col gap-3">
      <span className="self-start rounded-md border border-bank-border bg-bank-bg px-2 py-1 text-xs text-bank-text">
        Élément choisi : <strong>{e.def.nom}</strong>
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
          <MontreMoi onClick={() => onShowMe(id)} />
        </div>
      </KamaResponse>
    </div>
  );
}

function rendre(ligne: Ligne) {
  return ligne.map((m, i) => (typeof m === 'string' ? m : <Amount key={i}>{m.montant}</Amount>));
}
