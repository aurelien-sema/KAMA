// Le contexte envoyé au modèle doit être masqué avec les valeurs lues dans la page (bénéficiaire,
// téléphone, référence, titulaire) : un prénom seul n'est pas détecté par les indices du masquage.
// Le module importe la configuration des banques (alias `@/`), on vérifie donc le câblage à la source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/contexte-page.ts', import.meta.url), 'utf8');

test("le contexte est masqué avec les valeurs de l'en-tête de la page", () => {
  assert.match(source, /valeursEntete/);
  assert.match(source, /masquer\(brut, connues\)/);
});
