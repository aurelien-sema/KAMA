// Le masquage de l'extension doit donner exactement les sorties de référence du serveur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { masquer, estMasque, demasquer } from '../lib/masquage.ts';

const { vectors } = JSON.parse(readFileSync(new URL('../../backend/contracts/masking_vectors.json', import.meta.url), 'utf8'));

for (const v of vectors) {
  test(`masquage : ${v.input}`, () => assert.equal(masquer(v.input).texte, v.expected));
}

test('un texte déjà masqué reste identique', () => assert.ok(estMasque('Vous allez envoyer {x1} à {x2}.')));

test('les valeurs exactes de la page sont remises, espaces insécables compris', () => {
  const m = masquer('Total : 25\u202f500\u00a0FCFA');
  assert.equal(m.texte, 'Total : {x1}');
  assert.deepEqual(demasquer('Total {x1}', m.valeurs), ['Total ', { montant: '25\u202f500\u00a0FCFA' }]);
});

test('une balise inconnue dans la traduction la fait refuser', () => assert.equal(demasquer('Total {x2}', { x1: '5' }), null));

test('les valeurs connues de la page (nom du bénéficiaire) sont masquées même sans indice', () => {
  assert.equal(masquer('Bonjour, Amina', ['Amina']).texte, 'Bonjour, {x1}');
});
