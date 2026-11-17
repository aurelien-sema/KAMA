// Langue de secours (langue du navigateur) : anglais depuis le français, montants recopiés tels quels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versSecours, ligneVersSecours } from '../lib/secours.ts';
import { ANGLAIS } from '../config/anglais.ts';

test('navigateur en français : texte inchangé', () => {
  assert.equal(versSecours('Bienvenue ! Choisis ta langue.', 'fr'), 'Bienvenue ! Choisis ta langue.');
});

test('phrase connue traduite', () => {
  assert.equal(versSecours('Bienvenue ! Choisis ta langue.', 'en'), 'Welcome! Choose your language.');
  assert.equal(versSecours('Montre-moi', 'en'), 'Show me');
});

test('les montants restent ceux de la page, au caractère près', () => {
  const fr = "Frais : 500 FCFA. C'est ce que la banque prend pour faire le transfert. Au total, 25 500 FCFA vont sortir de ton compte.";
  const en = versSecours(fr, 'en');
  assert.equal(en, 'Fees: 500 FCFA. This is what the bank takes to make the transfer. In total, 25 500 FCFA will leave your account.');
  assert.ok(en.includes('25 500 FCFA') && en.includes('500 FCFA'));
});

test('ligne de gabarit : les montants restent des objets montant identiques', () => {
  const ligne = ['Au total, ', { montant: '25.500 XAF' }, ' vont sortir de ton compte.'];
  assert.deepEqual(ligneVersSecours(ligne, 'en'), ['In total, ', { montant: '25.500 XAF' }, ' will leave your account.']);
  assert.equal(ligneVersSecours(ligne, 'fr'), ligne);
});

test('libellé inconnu de la page : la phrase reste telle quelle', () => {
  assert.equal(versSecours('Solde après opération : −52 500 FCFA.', 'en'), 'Solde après opération : −52 500 FCFA.');
});

test('texte entre guillemets : libellé de la page gardé, fonction de Kama traduite', () => {
  assert.equal(versSecours('Appuie toi-même sur « Confirmer le transfert ».', 'en'), 'Press “Confirmer le transfert” yourself.');
  assert.equal(
    versSecours('Tu peux toujours utiliser « Expliquer cette page » ou les pastilles Kama.', 'en'),
    'You can still use “Explain this page” or the Kama badges.',
  );
});

test('bilan des transactions au singulier comme au pluriel', () => {
  assert.equal(versSecours('Sur cette page : 1 entrée, 2 sorties.', 'en'), 'On this page: 1 incoming, 2 outgoing.');
});

test('phrase absente du dictionnaire : reste en français', () => {
  assert.equal(versSecours('Une phrase que Kama ne connaît pas.', 'en'), 'Une phrase que Kama ne connaît pas.');
});

test('dictionnaire : chaque balise du français se retrouve dans l’anglais', () => {
  for (const [fr, en] of Object.entries(ANGLAIS)) {
    const balises = (t) => (t.match(/\{[xq]\d+\}/g) ?? []).sort().join(',');
    assert.equal(balises(en), balises(fr), fr);
  }
});
