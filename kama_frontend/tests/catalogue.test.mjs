// Les phrases que la fenêtre envoie à la traduction doivent toutes figurer dans le catalogue à faire valider par les locuteurs,
// et le glossaire embarqué doit être identique à ce que le serveur sert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { phrasesFenetre } from '../scripts/phrases-fenetre.mjs';
import { estMasque } from '../lib/masquage.ts';
import { chercherGlossaire, cleGlossaire } from '../lib/glossaire.ts';

const lire = (chemin) => JSON.parse(readFileSync(new URL(chemin, import.meta.url), 'utf8'));
const catalogue = lire('../../content-data/kama_fenetre.json').entries;
const phrases = phrasesFenetre();

test('chaque phrase du code est dans le catalogue de validation (et inversement)', () => {
  const dansCode = new Set(phrases.map((p) => p.fr));
  const dansCatalogue = new Set(catalogue.map((e) => e.fr));
  assert.deepEqual([...dansCode].filter((t) => !dansCatalogue.has(t)), [], 'phrase du code absente du catalogue : node scripts/phrases-fenetre.mjs --ecrire');
  assert.deepEqual([...dansCatalogue].filter((t) => !dansCode.has(t)), [], 'phrase du catalogue absente du code : relancer --ecrire');
});

test('chaque phrase est déjà masquée : le serveur ne la refusera pas', () => {
  for (const p of phrases) assert.ok(estMasque(p.fr), `non masquée : ${p.fr}`);
});

test('les identifiants du catalogue sont uniques', () => {
  assert.equal(new Set(catalogue.map((e) => e.id)).size, catalogue.length);
});

test('le glossaire embarqué retrouve ses propres clés (même forme de comparaison que le serveur)', () => {
  const g = lire('../config/glossaire.json');
  const entrees = Object.entries(g.fr.wes);
  assert.ok(entrees.length > 0, 'glossaire vide');
  for (const [cle, texte] of entrees) {
    assert.equal(cleGlossaire(cle), cle, `clé non normalisée : ${cle}`);
    assert.equal(chercherGlossaire(g, 'wes', cle.toUpperCase() + ' .'), texte);
  }
});

test("une phrase absente du glossaire n'est pas inventée", () => {
  assert.equal(chercherGlossaire(lire('../config/glossaire.json'), 'wes', 'Une phrase que personne na validée {x1}'), null);
});

// Fuite : ce qui part sur le réseau ne contient jamais le montant de la page (sécurité : « chercher 25 500 dans les requêtes »).
import { GABARITS } from '../config/gabarits.ts';
import { masquerLigne } from '../lib/lignes.ts';

test("aucun montant ni chiffre ne figure dans le texte envoyé au réseau", () => {
  for (const [id, gabarit] of Object.entries(GABARITS)) {
    for (const l of gabarit({ libelle: 'Frais', valeur: '22 500 FCFA', total: '25 500 FCFA' }).lignes) {
      const { texte, valeurs } = masquerLigne(l);
      assert.doesNotMatch(texte.replace(/\{x\d+\}/g, ''), /\d|FCFA/, `${id} : ${texte}`);
      assert.ok(Object.values(valeurs).every((v) => !texte.includes(v)), `${id} : valeur dans le texte`);
    }
  }
});
