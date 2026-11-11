/**
 * Traduction des phrases de Kama dans la langue choisie.
 *
 * Chemin imposé (sécurité et règlement) :
 *   texte → masquage dans l'extension → glossaire local (validé) → serveur (texte masqué seulement) → sinon l'original.
 * Les montants lus dans la page ne partent JAMAIS : ils sont remplacés par {x1}, {x2}… avant l'envoi et remis tels quels
 * (caractère pour caractère) à la réception. Si une traduction change les balises, elle est refusée.
 * Un texte critique (montant, alerte, négation) n'est traduit que s'il est validé : le serveur le garantit.
 */
import type { Ligne } from '@/config/gabarits';
import glossaire from '@/config/glossaire.json';
import interfaceJson from '@/config/interface.json';
import type { Langue } from '@/config/langues';
import { ErreurApi, traduireTexte, type ElementApi } from './api';
import { chercherGlossaire, type Glossaire } from './glossaire';
import { masquerLigne } from './lignes';
import { chercherInterface, type DonneesInterface } from './interface';
import { balisesDe, demasquer, estMasque, masquer } from './masquage';

/** Une phrase à traduire : une ligne du gabarit (texte fixe + montants lus dans la page) et sa nature. */
export type Requete = { ligne: Ligne; element: ElementApi };

/** Ce qu'il faut pour LIRE la phrase à voix haute : le texte traduit, encore masqué, et les valeurs de la page. */
export type Parole = { texte: string; valeurs: Record<string, string>; langue: string };

export type Resultat =
  | { statut: 'ok'; lignes: Ligne[]; paroles: Parole[]; badge: 'verified' | 'auto' }
  | { statut: 'original'; raison: string }
  | { statut: 'hors-ligne' };

type Une = { statut: 'ok'; morceaux: Ligne; parole: Parole; badge: 'verified' | 'auto' } | { statut: 'original'; raison: string } | { statut: 'hors-ligne' };

const cache = new Map<string, Promise<Une>>();

async function traduireMasque(texte: string, valeurs: Record<string, string>, element: ElementApi, langue: Langue): Promise<Une> {
  const fabriquer = (traduit: string, badge: 'verified' | 'auto'): Une => {
    if (balisesDe(traduit).join() !== balisesDe(texte).join()) return { statut: 'original', raison: 'balises_changees' };
    const morceaux = demasquer(traduit, valeurs);
    if (!morceaux) return { statut: 'original', raison: 'balises_changees' };
    return { statut: 'ok', morceaux, parole: { texte: traduit, valeurs, langue: langue.code }, badge };
  };

  const local = chercherGlossaire(glossaire as Glossaire, langue.code, texte);
  if (local) return fabriquer(local, 'verified'); // jamais de réseau pour une phrase déjà validée

  // Texte par défaut de Kama (libellé d'interface, jamais un montant ni un avertissement) : le brouillon s'affiche, étiqueté « automatique ».
  if (element === 'text') {
    const defaut = chercherInterface(interfaceJson as unknown as DonneesInterface, langue.code, texte);
    if (defaut) return fabriquer(defaut.texte, defaut.statut === 'valide' ? 'verified' : 'auto');
  }

  if (!estMasque(texte)) return { statut: 'original', raison: 'non_masque' }; // le serveur refuserait : on n'envoie pas

  const cle = `${langue.code}|${element}|${texte}`;
  let promesse = cache.get(cle);
  if (!promesse) {
    promesse = traduireTexte(texte, langue.code, element).then(
      (r): Une => {
        if (r.text === null || r.badge === 'untranslated') return { statut: 'original', raison: r.reason ?? 'untranslated' };
        return fabriquer(r.text, r.badge === 'verified' ? 'verified' : 'auto');
      },
      (e): Une => (e instanceof ErreurApi && e.reessayable ? { statut: 'hors-ligne' } : { statut: 'original', raison: e instanceof ErreurApi ? e.code : 'erreur' }),
    );
    cache.set(cle, promesse);
  }
  const resultat = await promesse;
  if (resultat.statut === 'hors-ligne') cache.delete(cle); // on réessaiera
  return resultat;
}

function combiner(resultats: Une[]): Resultat {
  if (resultats.some((r) => r.statut === 'hors-ligne')) return { statut: 'hors-ligne' };
  const refus = resultats.find((r) => r.statut === 'original');
  if (refus && refus.statut === 'original') return { statut: 'original', raison: refus.raison }; // une réponse mêlant deux langues serait trompeuse
  const ok = resultats as Extract<Une, { statut: 'ok' }>[];
  return {
    statut: 'ok',
    lignes: ok.map((r) => r.morceaux),
    paroles: ok.map((r) => r.parole),
    badge: ok.every((r) => r.badge === 'verified') ? 'verified' : 'auto',
  };
}

/** Traduit plusieurs lignes d'une même réponse. Toutes ou aucune : on ne mélange pas deux langues dans une réponse. */
export async function traduireLignes(requetes: Requete[], langue: Langue): Promise<Resultat> {
  if (!requetes.length) return { statut: 'original', raison: 'aucun_texte' };
  const resultats = await Promise.all(
    requetes.map((r) => {
      const { texte, valeurs } = masquerLigne(r.ligne);
      return traduireMasque(texte, valeurs, r.element, langue);
    }),
  );
  return combiner(resultats);
}

/**
 * Traduit un texte libre (texte sélectionné, message de la banque). Le masquage cherche les montants, numéros, e-mails
 * et noms ; `connues` : valeurs de la page à masquer en plus. Un texte presque entièrement masqué n'est pas envoyé.
 */
export async function traduireTexteLibre(texte: string, element: ElementApi, langue: Langue, connues: string[] = []): Promise<Resultat> {
  if (texte.length > 500) return { statut: 'original', raison: 'trop_long' };
  const m = masquer(texte, connues);
  const mots = m.texte.split(/\s+/).filter(Boolean);
  const libres = mots.filter((w) => !/^\{x\d+\}\W*$/.test(w));
  if (libres.length < 1 || libres.length < mots.length / 2) return { statut: 'original', raison: 'rien_a_traduire' };
  return combiner([await traduireMasque(m.texte, m.valeurs, element, langue)]);
}

/** Vide la mémoire des traductions (changement de langue). Elle ne contient que des textes masqués. */
export function oublierTraductions() {
  cache.clear();
}
