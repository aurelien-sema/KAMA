// Textes par défaut de Kama et libellés de la page de test dans la langue choisie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { libelle, chercherInterface } from '../lib/interface.ts';
import { cleGlossaire } from '../lib/glossaire.ts';
import { SAFINUM } from '../config/banques/safinum.ts';

const ELEMENTS = SAFINUM.elements;

const lire = (c) => JSON.parse(readFileSync(new URL(c, import.meta.url), 'utf8'));
const glossaire = lire('../config/glossaire.json');
const interfaceJson = lire('../config/interface.json');

const CHAINES_INTERFACE = [
  'Menu Kama',
  'Ouvrir Kama',
  'Fenêtre Kama',
  'Kama : texte sélectionné',
  'Kama activé',
  'Choisir ma langue',
  'Ne rien changer',
  'Écouter :',
  'Écouter le message',
  'Catalogue des états (développement)',
  'Kama te montre :',
  'Traduction à fournir',
  'Kama t\'explique',
  'Lecture en français',
  'Pas maintenant',
  'Patiente un instant…',
  'Lecture…',
  'Kama réfléchit…',
  'Ouest',
  'Nord-Ouest, Sud-Ouest',
  'Bouton « Confirmer le transfert »',
  'Bouton « Effectuer un transfert »',
  'Bouton « Continuer »',
  'Case de vérification',
  'Case de confirmation',
  "Kama n'arrive pas à joindre le serveur. Réessaie dans un instant.",
  "Kama n'arrive pas bien à traduire ce texte. Lis-le bien ou demande à ta banque.",
];

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

test("les annonces de panne sont en pidgin et restent des brouillons", () => {
  const serveur = "Kama n'arrive pas à joindre le serveur. Réessaie dans un instant.";
  const traduction = "Kama n'arrive pas bien à traduire ce texte. Lis-le bien ou demande à ta banque.";
  assert.equal(libelle(glossaire, interfaceJson, 'wes', serveur), 'Kama no fit reach im server now. Try am again small time.');
  assert.equal(
    libelle(glossaire, interfaceJson, 'wes', traduction),
    'Kama no fit translate dis one well. Read am well or ask your bank.',
  );
  assert.equal(chercherInterface(interfaceJson, 'wes', serveur).statut, 'brouillon');
  assert.equal(chercherInterface(interfaceJson, 'wes', traduction).statut, 'brouillon');
});

test("toute phrase de la fenêtre a sa version pidgin, et un brouillon n'est jamais marqué validé", () => {
  const fenetre = lire('../../content-data/kama_fenetre.json').entries;
  for (const e of fenetre) {
    const entree = chercherInterface(interfaceJson, 'wes', e.fr);
    assert.ok(entree, `sans pidgin : ${e.fr}`);
    if (!e.validated_by) assert.equal(entree.statut, 'brouillon', e.fr);
  }
  for (const [cle] of Object.entries(interfaceJson.fr.wes)) assert.equal(cleGlossaire(cle), cle);
});

test("chaque chaîne fixe de l'interface a une version pidgin", () => {
  for (const fr of CHAINES_INTERFACE) {
    const texte = libelle(glossaire, interfaceJson, 'wes', fr);
    assert.notEqual(texte, fr, `sans pidgin : ${fr}`);
  }
});

test('chaque nom d’élément de la page a une version pidgin', () => {
  for (const e of ELEMENTS) {
    const nom = libelle(glossaire, interfaceJson, 'wes', e.nom);
    assert.notEqual(nom, e.nom, `nom sans pidgin : ${e.nom}`);
  }
});
