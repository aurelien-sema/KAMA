/**
 * DONNÉES D'EXEMPLE — reprises telles quelles des maquettes Lovable.
 *
 * Elles servent uniquement à voir les contenus de la fenêtre tant que la lecture de la page
 * bancaire n'est pas branchée. Elles ne doivent JAMAIS être montrées comme de vraies
 * données : partout où elles sont utilisées, la fenêtre affiche le marqueur « Exemple ».
 * Les vrais montants viendront du DOM de la page, caractère pour caractère (règle d'or n° 1).
 */
import type { Etape, Operation } from './contents';

export const EXEMPLE_QUESTION = "C'est quoi les frais ici ?";

export const EXEMPLE_EXPLIQUER: { phrase: string; etapes: Etape[] } = {
  phrase: "Ici, tu envoies de l'argent à quelqu'un.",
  etapes: [
    { cible: 'beneficiaire', texte: 'Mets le nom de la personne.' },
    { cible: 'montant', texte: 'Mets le montant.' },
    { cible: 'frais', texte: 'Vérifie les frais.' },
    { cible: 'confirmer', texte: 'Appuie toi-même sur Confirmer.' },
  ],
};

export const EXEMPLE_RESUME: { entrees: string; sorties: string; operations: Operation[] } = {
  entrees: '3',
  sorties: '5',
  operations: [
    { date: '05/11', libelle: 'Argent reçu de Paul', montant: '+ 15 000 FCFA', sens: 'entree' },
    { date: '03/11', libelle: 'Retrait au guichet', montant: '− 20 000 FCFA', sens: 'sortie' },
    { date: '01/11', libelle: 'Paiement facture ENEO', montant: '− 8 450 FCFA', sens: 'sortie' },
  ],
};

export const EXEMPLE_ELEMENT = { libelle: 'Frais', frais: '500 FCFA', total: '25 500 FCFA' };

export const EXEMPLE_ERREUR = { messageBanque: 'Solde insuffisant', manque: '3 000 FCFA' };

export const EXEMPLE_NON_TRADUIT =
  'Ce bouton bloque ta carte. Utilise-le seulement si tu as perdu ta carte.';
