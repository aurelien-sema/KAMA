// Aucun repli en français quand la voix en langue nationale est indisponible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FICHIERS = [
  '../lib/ecouter.ts',
  '../components/BarreSelection.tsx',
  '../components/kama/fenetre/contents.tsx',
  '../components/kama/fenetre/parts.tsx',
  '../components/kama/primitives.tsx',
];

for (const fichier of FICHIERS) {
  test(`pas de lecture française de repli : ${fichier}`, () => {
    const source = readFileSync(new URL(fichier, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /lireTexte/);
  });
}

test("l'écoute ne renvoie plus le statut français", () => {
  const source = readFileSync(new URL('../lib/ecouter.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /'francais'/);
  assert.match(source, /'indisponible'/);
});
