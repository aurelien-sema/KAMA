// Découpage des textes longs et file d'attente audio : jamais de balise coupée, deux requêtes au plus,
// la lecture demandée passe avant le préchargement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FileAudio, decouperTexte, doitReessayer } from '../lib/file-audio.ts';

const sansBlancs = (texte) => texte.replace(/\s+/g, '');
const balises = (texte) => texte.match(/\{x\d+\}/g) ?? [];

test('un texte court part en une seule demande', () => {
  assert.deepEqual(decouperTexte('Bonjour {x1}, ton solde est pret.'), ['Bonjour {x1}, ton solde est pret.']);
});

test('un texte long est coupe sous la limite sans perdre un mot ni une balise', () => {
  const phrases = Array.from({ length: 30 }, (_, i) => `Phrase ${i} : lis le montant {x${i + 1}} sur la page.`);
  const texte = phrases.join(' ');
  const morceaux = decouperTexte(texte, 160);
  assert.ok(morceaux.length > 1);
  for (const morceau of morceaux) assert.ok(morceau.length <= 160, `morceau trop long : ${morceau.length}`);
  assert.equal(sansBlancs(morceaux.join(' ')), sansBlancs(texte));
  assert.deepEqual(morceaux.flatMap(balises), balises(texte));
});

test('une balise qui tombe sur la coupe reste entiere', () => {
  const texte = `${'A'.repeat(18)}{x1} fin de phrase assez longue`;
  const morceaux = decouperTexte(texte, 20);
  assert.equal(morceaux[0], 'A'.repeat(18));
  assert.deepEqual(morceaux.flatMap(balises), ['{x1}']);
  for (const morceau of morceaux) {
    assert.ok(morceau.length <= 20);
    assert.doesNotMatch(morceau.replace(/\{x\d+\}/g, ''), /[{}]/);
  }
});

test('une phrase qui finit juste avant la limite ne depasse pas', () => {
  const texte = `${'A'.repeat(20)}. ${'B'.repeat(40)}`;
  const morceaux = decouperTexte(texte, 20);
  for (const morceau of morceaux) assert.ok(morceau.length <= 20);
  assert.equal(sansBlancs(morceaux.join('')), sansBlancs(texte));
});

test('seules les erreurs passageres du serveur sont reessayees', () => {
  assert.equal(doitReessayer('busy'), true);
  assert.equal(doitReessayer('rate_limited'), true);
  assert.equal(doitReessayer('network'), false);
  assert.equal(doitReessayer('timeout'), false);
  assert.equal(doitReessayer('unmasked_content'), false);
  assert.equal(doitReessayer(undefined), false);
});

test('jamais plus de deux demandes audio en meme temps', async () => {
  const file = new FileAudio(2);
  let actifs = 0;
  let maximum = 0;
  const taches = Array.from({ length: 5 }, () =>
    file.executer(async () => {
      actifs += 1;
      maximum = Math.max(maximum, actifs);
      await new Promise((fini) => setTimeout(fini, 5));
      actifs -= 1;
    }),
  );
  await Promise.all(taches);
  assert.equal(maximum, 2);
});

test('la lecture demandee passe avant le prechargement', async () => {
  const file = new FileAudio(1);
  const ordre = [];
  let liberer;
  const verrou = new Promise((fini) => {
    liberer = fini;
  });
  const occupe = file.executer(async () => {
    ordre.push('occupe');
    await verrou;
  });
  const prechargement = file.executer(async () => {
    ordre.push('prechargement');
  });
  const lecture = file.executer(async () => {
    ordre.push('lecture');
  }, true);
  await new Promise((fini) => setTimeout(fini, 0));
  liberer();
  await Promise.all([occupe, prechargement, lecture]);
  assert.deepEqual(ordre, ['occupe', 'lecture', 'prechargement']);
});

test('un echec libere la place et se propage', async () => {
  const file = new FileAudio(1);
  const echec = file.executer(async () => {
    throw new Error('busy');
  });
  await assert.rejects(echec, /busy/);
  assert.equal(await file.executer(async () => 42), 42);
});
