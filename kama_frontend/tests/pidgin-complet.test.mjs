// Quand le pidgin est choisi, TOUT Kama doit être en pidgin (texte et voix) : chaque phrase de Kama a sa version « wes ».
// La liste de référence est celle de la langue de secours (config/anglais.ts : toutes les phrases françaises de Kama),
// plus les phrases de la fenêtre (scripts/phrases-fenetre.mjs). Un texte ajouté sans pidgin fait échouer ce test :
// l'ajouter dans content-data/kama_interface.json (brouillon), puis `python -m app.export_glossary`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANGLAIS } from '../config/anglais.ts';
import { chercherInterface, libelle } from '../lib/interface.ts';
import { chercherGlossaire } from '../lib/glossaire.ts';
import { phrasesFenetre } from '../scripts/phrases-fenetre.mjs';

const lire = (c) => JSON.parse(readFileSync(new URL(c, import.meta.url), 'utf8'));
const glossaire = lire('../config/glossaire.json');
const inter = lire('../config/interface.json');

/** Vrai si la phrase a une version pidgin (même identique au français, comme « Kama » ou « Audio »). */
function aDuPidgin(fr) {
  return Boolean(chercherGlossaire(glossaire, 'wes', fr) ?? chercherInterface(inter, 'wes', fr)) || libelle(glossaire, inter, 'wes', fr) !== fr;
}

test('chaque phrase de Kama (liste de la langue de secours) a sa version pidgin', () => {
  const manquantes = Object.keys(ANGLAIS).filter((fr) => !aDuPidgin(fr));
  assert.deepEqual(manquantes, [], `sans pidgin : ${manquantes.join(' | ')}`);
});

test('chaque phrase de la fenêtre a sa version pidgin', () => {
  const textes = phrasesFenetre().map((p) => (typeof p === 'string' ? p : p.texte ?? p.fr ?? p.text)).filter(Boolean);
  assert.ok(textes.length > 50);
  const manquantes = [...new Set(textes)].filter((fr) => !aDuPidgin(fr));
  assert.deepEqual(manquantes, [], `sans pidgin : ${manquantes.join(' | ')}`);
});

test('phrase modèle : le libellé entre « » est traduit à part et les nombres restent tels quels', () => {
  const avecLibelle = libelle(glossaire, inter, 'wes', 'Appuie sur « Réessayer ».');
  assert.notEqual(avecLibelle, 'Appuie sur « Réessayer ».');
  assert.match(avecLibelle, /^Press « .+ »\.$/);
  assert.ok(!avecLibelle.includes('Réessayer') || libelle(glossaire, inter, 'wes', 'Réessayer') === 'Réessayer');

  const inconnu = libelle(glossaire, inter, 'wes', 'Bouton « Payer la facture »');
  assert.equal(inconnu, 'Button « Payer la facture »', 'un libellé de la page inconnu reste tel quel, entre guillemets');

  assert.equal(libelle(glossaire, inter, 'wes', 'Étape 2 :'), 'Step 2:');
  assert.equal(libelle(glossaire, inter, 'wes', 'Sur cette page : 3 entrées, 1 sortie.'), 'For dis page: 3 money wey enter, 1 money wey comot.');
});

test('sans langue choisie ou en français, rien ne change', () => {
  assert.equal(libelle(glossaire, inter, undefined, 'Appuie sur « Réessayer ».'), 'Appuie sur « Réessayer ».');
});
