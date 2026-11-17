// Modèles à valeur variable de la page de test, et textes anglais (bouton EN de la page) : tout se fait en local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chercherGlossaire, chercherModele } from '../lib/glossaire.ts';

const g = JSON.parse(readFileSync(new URL('../config/glossaire.json', import.meta.url), 'utf8'));

test('« Bonjour, Amina » : la traduction validée, avec le nom lu dans la page (jamais envoyé)', () => {
  assert.deepEqual(chercherModele(g, 'wes', 'Bonjour, Amina'), { texte: 'How na, {x1}', valeurs: { x1: 'Amina' } });
});

test('le même modèle en anglais', () => {
  assert.deepEqual(chercherModele(g, 'wes', 'Hello, Paul'), { texte: 'How na, {x1}', valeurs: { x1: 'Paul' } });
});

test('numéro de compte et frais Mobile Money : valeurs recopiées telles quelles', () => {
  assert.equal(chercherModele(g, 'wes', 'Numéro de compte : 0123 4567 89').valeurs.x1, '0123 4567 89');
  const f = chercherModele(g, 'wes', 'Frais de 1,5 % (min. 100 FCFA, max. 2 500 FCFA)');
  assert.deepEqual(f.valeurs, { x1: '1,5 %', x2: '100 FCFA', x3: '2 500 FCFA' });
  assert.match(f.texte, /\{x1\}.*\{x2\}.*\{x3\}/);
});

test("un texte qui ne correspond à aucun modèle n'est pas inventé", () => {
  assert.equal(chercherModele(g, 'wes', 'Une phrase libre'), null);
  assert.equal(chercherModele(g, 'bbj', 'Bonjour, Amina'), null);
});

test('la page en anglais : le libellé anglais retrouve la traduction validée', () => {
  assert.equal(chercherGlossaire(g, 'wes', 'Fee'), 'Charge');
  assert.equal(chercherGlossaire(g, 'wes', 'Frais'), 'Charge');
});
