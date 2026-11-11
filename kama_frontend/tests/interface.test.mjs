// Textes par défaut de Kama et libellés de la page de test dans la langue choisie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { libelle, chercherInterface } from '../lib/interface.ts';
import { cleGlossaire } from '../lib/glossaire.ts';

const lire = (c) => JSON.parse(readFileSync(new URL(c, import.meta.url), 'utf8'));
const glossaire = lire('../config/glossaire.json');
const interfaceJson = lire('../config/interface.json');

test('un libellé validé de la page de test passe avant tout', () => {
  assert.equal(libelle(glossaire, interfaceJson, 'wes', 'Frais'), 'Charge');
  assert.equal(libelle(glossaire, interfaceJson, 'wes', 'Total à débiter'), 'All money weh go comot for your account');
});

test("un texte par défaut de Kama s'affiche en pidgin même en brouillon", () => {
  assert.equal(libelle(glossaire, interfaceJson, 'wes', 'Réessayer'), 'Try again');
  assert.equal(chercherInterface(interfaceJson, 'wes', 'Réessayer').statut, 'brouillon');
});

test("sans traduction, ou sans langue, le français reste tel quel (rien n'est inventé)", () => {
  assert.equal(libelle(glossaire, interfaceJson, 'wes', 'Une phrase inconnue'), 'Une phrase inconnue');
  assert.equal(libelle(glossaire, interfaceJson, undefined, 'Réessayer'), 'Réessayer');
  assert.equal(libelle(glossaire, interfaceJson, 'bbj', 'Réessayer'), 'Réessayer');
});

test("seuls des libellés d'interface sont servis en brouillon : jamais d'explication ni de réponse avec montant", () => {
  const autorisees = ['popup', 'menu', 'fenetre', 'selection', 'badge', 'etat', 'voix'];
  for (const [cle, e] of Object.entries(interfaceJson.fr.wes)) {
    assert.equal(cleGlossaire(cle), cle);
    if (e.statut === 'brouillon') assert.ok(autorisees.includes(e.zone), `${cle} : zone ${e.zone}`);
  }
});
