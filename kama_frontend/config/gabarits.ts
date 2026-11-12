/**
 * GABARITS DES EXPLICATIONS (en français pour l'instant).
 *
 * Un gabarit est une suite de morceaux : du texte fixe, et des emplacements `{ montant }`
 * remplis avec le montant LU DANS LA PAGE, tel quel (règle d'or n° 1). Le texte fixe sera
 * remplacé par les phrases validées en ghomálá' et en pidgin (règle d'or n° 4) : seul ce
 * fichier changera, pas l'affichage.
 *
 * `libelle` = le libellé tel qu'écrit dans la page (« Frais », « Total à débiter »…).
 */
import type { IdElement } from './page-test';

export type Morceau = string | { montant: string };
export type Ligne = Morceau[];

type Donnees = { libelle: string; valeur?: string; total?: string };

export const GABARITS: Partial<Record<IdElement, (d: Donnees) => { lignes: Ligne[]; alerte?: boolean }>> = {
  solde: ({ libelle, valeur }) => ({
    lignes: [[`${libelle} : `, { montant: valeur! }, '.'], ["C'est l'argent que tu as maintenant sur ton compte."]],
  }),

  'montant-saisie': ({ total }) => ({
    lignes: [
      ["Ici, tu écris combien d'argent tu veux envoyer."],
      ['Écris seulement des chiffres. Vérifie bien avant de continuer.'],
      ...(total ? [['Au total, ', { montant: total }, ' vont sortir de ton compte.'] as Ligne] : []),
    ],
  }),

  montant: ({ libelle, valeur }) => ({
    lignes: [[`${libelle} : `, { montant: valeur! }, '.'], ["C'est l'argent que la personne va recevoir."]],
  }),

  frais: ({ libelle, valeur, total }) => ({
    lignes: [
      [`${libelle} : `, { montant: valeur! }, '.'],
      ["C'est ce que la banque prend pour faire le transfert."],
      ...(total ? [['Au total, ', { montant: total }, ' vont sortir de ton compte.'] as Ligne] : []),
    ],
  }),

  total: ({ libelle, valeur }) => ({
    lignes: [
      [`${libelle} : `, { montant: valeur! }, '.'],
      ["C'est tout l'argent qui va sortir de ton compte : le montant plus les frais."],
    ],
  }),

  confirmer: ({ total }) => ({
    alerte: true,
    lignes: [
      ["Ce bouton envoie l'argent pour de vrai."],
      ...(total ? [['Au total, ', { montant: total }, ' vont sortir de ton compte.'] as Ligne] : []),
      ["Avant d'appuyer, vérifie le nom et le numéro de la personne."],
      ["C'est toi qui appuies. Kama n'appuie jamais à ta place."],
    ],
  }),
};

/**
 * Montant que la configuration ne connaît pas (contenu inédit) : Kama le recopie tel quel avec
 * le texte écrit juste avant lui, et dit franchement qu'il ne connaît pas encore cette information.
 */
export function gabaritMontantInconnu({ libelle, valeur }: { libelle?: string; valeur: string }) {
  return {
    lignes: [
      [libelle ? `${libelle} : ` : 'Montant affiché : ', { montant: valeur }, '.'] as Ligne,
      ["Kama ne connaît pas encore cette information. Il recopie le montant tel qu'il est écrit sur la page."] as Ligne,
    ],
  };
}

/** Texte lu à voix haute : les montants sont dits exactement comme ils sont écrits. */
export function texteAEcouter(lignes: Ligne[]) {
  return lignes.map((l) => l.map((m) => (typeof m === 'string' ? m : m.montant)).join('')).join(' ');
}
