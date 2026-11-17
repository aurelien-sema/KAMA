// Détection de la langue source d'un texte masqué : français ou anglais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detecterLangueSource } from '../lib/api.ts';

const FR = [
  'Votre solde est insuffisant pour ce transfert.',
  'Les frais de transfert sont de 500 FCFA.',
  'Confirmez le paiement de la facture.',
  "Le bénéficiaire n'est pas encore enregistré.",
  'Vérifiez le numéro avant de confirmer.',
  'Annulez ce transfert et réessayez.',
  'Solde disponible : {x1}.',
  'Frais : {x1}.',
  'Paiement reçu de {x1}.',
  "Impossible d'envoyer l'argent maintenant.",
  'Le montant doit être supérieur à zéro.',
  'La banque ne répond pas.',
  'Transfert gratuit.',
  'Retrait au guichet.',
  'Le compte est bloqué.',
  'Votre carte est bloquée.',
  'Le bénéficiaire est inconnu.',
  'Numéro de téléphone.',
];

const EN = [
  'Your balance is insufficient for this transfer.',
  'The transfer fee is 500 FCFA.',
  'Confirm the payment for this bill.',
  'This beneficiary has not been saved yet.',
  'Never share your secret code.',
  'The amount must be greater than zero.',
  'Cancel this transfer and try again.',
  'Available balance: {x1}.',
  'Fee: {x1}.',
  'Payment received from {x1}.',
  'You cannot send money right now.',
  'Check the number before you confirm.',
  'This account is blocked.',
  'Withdrawal of {x1} completed.',
  'The bank is not responding.',
  'Transfer completed.',
  'Free transfer.',
  'Merchant payment.',
  'Salary received.',
  'Light bill.',
  'Reference number.',
  'Send money.',
  'Confirm transfer.',
  'Insufficient balance.',
];

test('détecte le français, y compris les phrases courtes et les balises', () => {
  for (const texte of FR) assert.equal(detecterLangueSource(texte), 'fr', texte);
});

test("détecte l'anglais, y compris les phrases courtes et les balises", () => {
  for (const texte of EN) assert.equal(detecterLangueSource(texte), 'en', texte);
});

test('ignore les balises, les nombres et les égalités', () => {
  assert.equal(detecterLangueSource('{x1}'), 'fr');
  assert.equal(detecterLangueSource('1234 FCFA'), 'fr');
  assert.equal(detecterLangueSource('Total'), 'fr');
});
