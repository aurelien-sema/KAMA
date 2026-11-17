// La lecture des montants de l'extension doit donner exactement les mots du serveur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { direMontant } from '../lib/nombres.ts';

const ref = JSON.parse(readFileSync(new URL('../../backend/contracts/numbers_vectors.json', import.meta.url), 'utf8'));

for (const v of ref.vectors) test(`montant : ${JSON.stringify(v.input)}`, () => assert.deepEqual(direMontant(v.input), v.words));
for (const t of ref.unreadable) test(`illisible : ${JSON.stringify(t)}`, () => assert.equal(direMontant(t), null));
