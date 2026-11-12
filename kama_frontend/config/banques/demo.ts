/**
 * BANQUE DÉMO — page bancaire FICTIVE de l'équipe (`banque-demo/`, lancée avec `npm run banque-demo`).
 *
 * Elle sert à montrer que Kama s'adapte à une autre banque avec ce seul fichier : autres mots
 * (« Commission », « Montant total prélevé », « Valider le virement »), autre écriture des
 * montants (« 25.000 XAF »), autre structure de page. Aucune donnée réelle.
 * Absente de la version livrée au jury (`demonstration: true`).
 *
 * Modèle pour ajouter une vraie banque : copier ce fichier et remplacer les libellés.
 */
import type { ConfigBanque } from './types';

export const DEMO: ConfigBanque = {
  id: 'demo',
  nom: 'Banque Démo (page fictive)',
  sites: ['http://localhost/*', 'http://127.0.0.1/*'],
  demonstration: true,

  elements: [
    { id: 'solde', libelles: ['Solde du compte'], nature: 'montant', pastille: true, nom: 'Solde du compte' },
    { id: 'montant-saisie', libelles: ['Montant du virement'], nature: 'champ', pastille: true, nom: 'Montant du virement' },
    { id: 'frais', libelles: ['Commission'], nature: 'montant', pastille: true, nom: 'Commission' },
    { id: 'total', libelles: ['Montant total prélevé'], nature: 'montant', pastille: true, nom: 'Montant total prélevé' },
    { id: 'confirmer', libelles: ['Valider le virement'], nature: 'bouton', pastille: true, nom: 'Bouton « Valider le virement »' },
    { id: 'erreur', libelles: ['Opération refusée'], nature: 'erreur', pastille: true, nom: 'Message de la banque' },
    { id: 'beneficiaire', libelles: ['Bénéficiaire'], nature: 'champ', pastille: false, nom: 'Bénéficiaire' },
    { id: 'reference', libelles: ['Référence du virement'], nature: 'repere', pastille: false, nom: 'Référence du virement' },
    { id: 'transactions', libelles: ['Dernières opérations'], nature: 'repere', pastille: false, nom: 'Dernières opérations' },
  ],

  etapes: [
    {
      id: 'recu',
      reperes: ['Virement envoyé'],
      phrase: 'Ton virement est parti.',
      etapes: [
        { cible: 'total', texte: "Regarde le total qui est sorti de ton compte." },
        { cible: 'reference', texte: 'Garde la référence : elle prouve ton virement.' },
      ],
    },
    {
      id: 'virement',
      reperes: ['Nouveau virement'],
      phrase: "Ici, tu envoies de l'argent à quelqu'un.",
      etapes: [
        { cible: 'solde', texte: "Regarde ton solde : c'est l'argent que tu as." },
        { cible: 'beneficiaire', texte: 'Écris le nom de la personne.' },
        { cible: 'montant-saisie', texte: 'Écris le montant à envoyer.' },
        { cible: 'frais', texte: 'Regarde la commission : c’est ce que la banque prend.' },
        { cible: 'total', texte: 'Regarde le total qui va sortir de ton compte.' },
        { cible: 'confirmer', texte: 'Appuie toi-même sur « Valider le virement ».' },
      ],
    },
  ],

  erreurs: {
    PROVISION: {
      titre: "Tu n'as pas assez d'argent pour ce virement.",
      conseil: 'Envoie un montant plus petit, ou mets de l’argent sur ton compte avant.',
    },
  },
  erreursParMessage: [[/provision insuffisante/i, 'PROVISION']],
};
