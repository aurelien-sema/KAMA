/**
 * Traduit les phrases d'une réponse de la fenêtre et suit l'état : en cours, traduit, original (pas de traduction),
 * ou pas de connexion. `reessayer()` relance après un « Réessayer ».
 */
import { useCallback, useEffect, useState } from 'react';
import type { Langue } from '@/config/langues';
import { valeursEntete } from './lecture-page';
import { traduireLignes, traduireTexteLibre, type Requete, type Resultat } from './traduction';
import type { ElementApi } from './api';

export type EtatTraduction = { statut: 'chargement' } | Resultat;

const ORIGINAL: EtatTraduction = { statut: 'original', raison: 'aucune_langue' };

function useResultat(cle: string, lancer: (() => Promise<Resultat>) | null): [EtatTraduction, () => void] {
  const [etat, setEtat] = useState<EtatTraduction>(lancer ? { statut: 'chargement' } : ORIGINAL);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    if (!lancer) {
      setEtat(ORIGINAL);
      return;
    }
    let annule = false;
    setEtat({ statut: 'chargement' });
    lancer().then((r) => {
      if (!annule) setEtat(r);
    });
    return () => {
      annule = true;
    };
    // `cle` résume tout ce qui compte (texte, langue, nature) ; `lancer` est recréé à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, essai]);

  const reessayer = useCallback(() => setEssai((n) => n + 1), []);
  return [etat, reessayer];
}

/** Traduit des lignes de gabarit. `requetes` null : rien à traduire (élément absent de la page). */
export function useTraductionLignes(requetes: Requete[] | null, langue: Langue | null) {
  const actif = !!requetes && !!langue;
  return useResultat(JSON.stringify([langue?.code, requetes]), actif ? () => traduireLignes(requetes!, langue!) : null);
}

/** Traduit un texte libre (texte sélectionné, message de la banque). */
export function useTraductionTexte(
  texte: string | null,
  element: ElementApi,
  langue: Langue | null,
  connues: string[] = valeursEntete(),
) {
  const actif = !!texte && !!langue;
  return useResultat(
    JSON.stringify([langue?.code, element, texte, connues]),
    actif ? () => traduireTexteLibre(texte!, element, langue!, connues) : null,
  );
}
