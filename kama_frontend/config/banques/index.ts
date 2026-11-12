/**
 * Les banques connues de Kama : 1 banque = 1 fichier dans ce dossier, inscrit ici.
 * Pour ajouter une banque : copier `demo.ts`, remplacer les libellés par ceux de la nouvelle
 * page, puis l'ajouter à la liste `BANQUES`. Le code de Kama ne change pas.
 */
import { DEMO } from './demo';
import { SAFINUM } from './safinum';
import { BANQUE_INCONNUE, type ConfigBanque } from './types';

/**
 * Version livrée au jury (`npm run build:jury`) : sans les pages de démonstration locales.
 * `import.meta.env.MODE` vaut « jury » seulement pour cette version.
 */
export const VERSION_JURY = import.meta.env.MODE === 'jury';

export const BANQUES: ConfigBanque[] = [SAFINUM, ...(VERSION_JURY ? [] : [DEMO])];

/** Transforme un motif d'adresse (`https://site/chemin*`) en expression régulière. */
function motifVersRegex(motif: string) {
  const echappe = motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  // Comme dans le manifest, le port n'est pas pris en compte : `http://localhost/*` vaut pour tous.
  return new RegExp(`^${echappe.replace(/^(https?:\/\/[^/]+)/, (o) => `${o}(?::\\d+)?`)}$`);
}

/** La banque de cette adresse, ou la banque « inconnue » (Kama ne compte que sur ce qu'il repère seul). */
export function banquePourAdresse(adresse: string): ConfigBanque {
  return BANQUES.find((b) => b.sites.some((s) => motifVersRegex(s).test(adresse))) ?? BANQUE_INCONNUE;
}

/** La banque de la page affichée (relue à chaque fois : l'adresse peut changer sans rechargement). */
export function banqueCourante(): ConfigBanque {
  return banquePourAdresse(location.href);
}

export * from './types';
