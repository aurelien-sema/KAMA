/**
 * Une réponse de la fenêtre : les lignes en français (gabarits) et leur traduction dans la langue choisie.
 *
 * Tant que la traduction n'existe pas (phrase pas encore validée, serveur absent), Kama montre le français avec le badge
 * « Pas encore traduit » : il n'invente rien (règle d'or n° 4). Les montants restent ceux de la page, caractère pour caractère.
 */
import { useEffect, useRef } from 'react';
import type { Ligne } from '@/config/gabarits';
import type { ElementApi } from './api';
import { useLangueCourante } from './langue-courante';
import { masquer } from './masquage';
import type { Parole } from './traduction';
import { useTraductionLignes } from './use-traduction';

const DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

export type Reponse = {
  /** Lignes à afficher : traduites, ou le français si la traduction n'existe pas. */
  lignes: Ligne[];
  status: 'verified' | 'auto' | 'untranslated';
  /** Réponse à lire avec la voix du serveur ; absent : lecture en français. */
  paroles?: Parole[];
  chargement: boolean;
  horsLigne: boolean;
  reessayer: () => void;
};

export function useReponse(lignesFr: Ligne[] | null, element: ElementApi = 'text'): Reponse {
  const langue = useLangueCourante();
  const [t, reessayer] = useTraductionLignes(lignesFr ? lignesFr.map((ligne) => ({ ligne, element })) : null, langue);
  const dejaSignale = useRef<string | null>(null);

  useEffect(() => {
    if (!DEV || !lignesFr || langue?.code !== 'wes' || t.statut === 'ok' || t.statut === 'chargement') return;
    const cle = JSON.stringify(lignesFr);
    if (dejaSignale.current === cle) return;
    dejaSignale.current = cle;
    console.warn(`[kama:fr] ${lignesFr.map((ligne) => masquer(aplatir(ligne)).texte).join(' / ')}`);
  }, [langue?.code, t, lignesFr]);

  const traduit = t.statut === 'ok';
  return {
    lignes: traduit ? t.lignes : (lignesFr ?? []),
    status: traduit ? t.badge : 'untranslated',
    paroles: traduit ? t.paroles : undefined,
    chargement: t.statut === 'chargement',
    horsLigne: t.statut === 'hors-ligne',
    reessayer,
  };
}

/** Une ligne sans montant, en texte simple. */
export function aplatir(ligne: Ligne) {
  return ligne.map((m) => (typeof m === 'string' ? m : m.montant)).join('');
}
