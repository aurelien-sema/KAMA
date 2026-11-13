/**
 * Écrans de consentement (premier usage, micro) : contenus de la fenêtre qui passent par la traduction comme les autres.
 * (Les textes fixes sont des phrases de Kama : validées, ils s'affichent dans la langue choisie ; sinon en français.)
 */
import { CONSENTEMENT, CONSENTEMENT_MICRO } from '@/config/consentement';
import { aplatir, useReponse } from '@/lib/use-reponse';
import { ConsentementContent, Reflexion } from './contents';

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
