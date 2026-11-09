/**
 * Les 11 états de la fenêtre Kama et le contenu à afficher pour chacun.
 * Un seul endroit décide quel contenu montrer et dans quel état est le micro.
 */
import type { MicMode } from './KamaWindow';
import {
  BankErrorContent,
  ElementExplainContent,
  ExplainPageContent,
  NoTransactionsContent,
  OfflineContent,
  SummaryContent,
  TalkAnswerContent,
  TalkIdleContent,
  TalkListeningContent,
  TalkThinkingContent,
  UntranslatedContent,
} from './contents';
import {
  EXEMPLE_ELEMENT,
  EXEMPLE_ERREUR,
  EXEMPLE_EXPLIQUER,
  EXEMPLE_NON_TRADUIT,
  EXEMPLE_QUESTION,
  EXEMPLE_RESUME,
} from './exemples';

export const ETATS = [
  { id: 'parler-attente', titre: '1. Parler — attente' },
  { id: 'parler-ecoute', titre: '2. Parler — écoute' },
  { id: 'parler-reflexion', titre: '3. Parler — réflexion' },
  { id: 'parler-reponse', titre: '4. Parler — réponse' },
  { id: 'expliquer', titre: '5. Expliquer cette page' },
  { id: 'resumer', titre: '6. Résumer mes transactions' },
  { id: 'pas-de-transactions', titre: '7. Pas de transactions ici' },
  { id: 'element', titre: "8. Explication d'un élément" },
  { id: 'erreur-banque', titre: '9. Erreur bancaire expliquée' },
  { id: 'hors-ligne', titre: '10. Pas de connexion' },
  { id: 'non-traduit', titre: '11. Traduction indisponible' },
] as const;

export type EtatFenetre = (typeof ETATS)[number]['id'];

/** États qui utilisent encore les données d'exemple de Lovable (affichent le marqueur « Exemple »). */
const AVEC_EXEMPLES: EtatFenetre[] = ['parler-reflexion', 'parler-reponse', 'expliquer', 'resumer', 'element', 'erreur-banque'];

export function utiliseDesExemples(etat: EtatFenetre) {
  return AVEC_EXEMPLES.includes(etat);
}

export function micPour(etat: EtatFenetre): MicMode {
  if (etat === 'parler-ecoute') return 'listening';
  if (etat === 'parler-reflexion') return 'thinking';
  if (etat === 'hors-ligne') return 'offline';
  return 'idle';
}

type Actions = { onShowMe?: (cible: string) => void; onRetry?: () => void };

export function ContenuFenetre({ etat, onShowMe, onRetry }: { etat: EtatFenetre } & Actions) {
  switch (etat) {
    case 'parler-attente':
      return <TalkIdleContent />;
    case 'parler-ecoute':
      return <TalkListeningContent />;
    case 'parler-reflexion':
      return <TalkThinkingContent question={EXEMPLE_QUESTION} />;
    case 'parler-reponse':
      return <TalkAnswerContent question={EXEMPLE_QUESTION} frais={EXEMPLE_ELEMENT.frais} />;
    case 'expliquer':
      return <ExplainPageContent {...EXEMPLE_EXPLIQUER} onShowMe={onShowMe} />;
    case 'resumer':
      return <SummaryContent {...EXEMPLE_RESUME} />;
    case 'pas-de-transactions':
      return <NoTransactionsContent onShowMe={onShowMe} />;
    case 'element':
      return <ElementExplainContent {...EXEMPLE_ELEMENT} />;
    case 'erreur-banque':
      return <BankErrorContent {...EXEMPLE_ERREUR} />;
    case 'hors-ligne':
      return <OfflineContent onRetry={onRetry} />;
    case 'non-traduit':
      return <UntranslatedContent texte={EXEMPLE_NON_TRADUIT} />;
  }
}

/** Marqueur affiché en haut de la fenêtre quand le contenu vient des données d'exemple. */
export function MarqueurExemple() {
  return (
    <p className="m-0 mb-3 rounded-lg border border-dashed border-kama-ink/40 px-2 py-1 text-xs font-semibold text-kama-ink">
      Exemple : données fictives de la maquette, pas celles de cette page.
    </p>
  );
}
