import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texteSelection } from '../lib/selection.ts';

test("la sélection garde la casse et les accents du texte d'origine", () => {
  const selection = {
    rangeCount: 2,
    getRangeAt: (i) => ({ toString: () => ['AVOIR SUR LE COMPTE', 'Amina'][i] }),
  };
  assert.equal(texteSelection(selection), 'AVOIR SUR LE COMPTE Amina');
});

test('une sélection vide ne produit aucun texte', () => {
  assert.equal(texteSelection(null), '');
  assert.equal(texteSelection({ rangeCount: 0, getRangeAt: () => ({ toString: () => '' }) }), '');
});
