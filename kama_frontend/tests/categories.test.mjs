// Voie 3 : le classeur déterministe de KAMA doit retrouver le TYPE des messages inédits du jury.
// Vérité de terrain : training/pidgin/cas_inedits.json (30 messages fidèles) et
// training/pidgin/cas_inedits_arnaques.json (30 arnaques). Aucun réseau, aucun modèle : mots-clés fr+en.
//
// Règle absolue : une arnaque ne tombe JAMAIS dans information_generale ni operation_reussie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, EXPLICATIONS, categorieParId, classer } from '../lib/categories.ts';

const lire = (chemin) => JSON.parse(readFileSync(new URL(chemin, import.meta.url), 'utf8'));

const FIDELES = lire('../../training/pidgin/cas_inedits.json').cas;
const ARNAQUES = lire('../../training/pidgin/cas_inedits_arnaques.json').cas;

/** Mapping des catégories de la vérité de terrain vers les 16 ids du classeur (mixte -> message par message). */
const ATTENDU_FIDELES = [
  'panne_maintenance', 'panne_maintenance', 'panne_maintenance',
  'plafond', 'plafond', 'plafond',
  'faux_agent_demande_code', 'faux_agent_demande_code', 'information_generale', 'compte_bloque_suspendu',
  'frais_tarif', 'frais_tarif', 'frais_tarif',
  'operation_reussie', 'operation_refusee', 'information_generale',
  'information_generale', 'operation_reussie',
  'compte_bloque_suspendu', 'compte_bloque_suspendu', 'mise_a_jour_informations',
  'information_generale', 'information_generale', 'information_generale',
  'operation_refusee', 'operation_refusee', 'operation_refusee',
  'operation_reussie', 'operation_refusee', 'information_generale',
];

const MAP_ARNAQUES = {
  paiement_mobile_erreur: 'faux_remboursement_erreur',
  faux_vendeur: 'lien_piege',
  faux_agent: 'faux_agent_demande_code',
  faux_gain: 'faux_gain',
  faux_emploi: 'faux_emploi',
  lien_piege: 'lien_piege',
  urgence_menace: 'urgence_menace',
  investissement_credit: 'investissement_douteux',
};

const CAS = [
  ...FIDELES.map((c, i) => ({ fr: c.fr, en: c.en, attendu: ATTENDU_FIDELES[i], source: 'cas_inedits' })),
  ...ARNAQUES.map((c) => ({ fr: c.fr, en: c.en, attendu: MAP_ARNAQUES[c.cat], source: 'cas_inedits_arnaques' })),
];

/** Catégories rassurantes : une arnaque n'y tombe jamais (garde de sécurité du classeur). */
const RASSURANTE = new Set(['information_generale', 'operation_reussie']);

function evaluer(champ) {
  const erreurs = [];
  let ok = 0;
  for (const c of CAS) {
    const trouve = classer(c[champ]).id;
    if (trouve === c.attendu) ok += 1;
    else erreurs.push({ source: c.source, texte: c[champ], attendu: c.attendu, trouve });
  }
  return { ok, total: CAS.length, precision: ok / CAS.length, erreurs };
}

test('la vérité de terrain contient bien 60 cas (30 fidèles + 30 arnaques)', () => {
  assert.equal(FIDELES.length, 30);
  assert.equal(ARNAQUES.length, 30);
  assert.equal(CAS.length, 60);
  for (const c of CAS) assert.ok(CATEGORIES.some((cat) => cat.id === c.attendu), `catégorie attendue inconnue : ${c.attendu}`);
});

test('chaque cas français retrouve la bonne catégorie (précision 100 %, tableau des erreurs)', () => {
  const { ok, total, precision, erreurs } = evaluer('fr');
  // eslint-disable-next-line no-console
  console.log(`\n[categories] précision voie 3 : ${(precision * 100).toFixed(1)} % (${ok}/${total})`);
  if (erreurs.length > 0) {
    // eslint-disable-next-line no-console
    console.log('[categories] erreurs :');
    for (const e of erreurs) {
      // eslint-disable-next-line no-console
      console.log(`  ${e.source} : attendu=${e.attendu} trouvé=${e.trouve} :: ${e.texte}`);
    }
  }
  assert.ok(precision >= 0.9, `précision insuffisante : ${(precision * 100).toFixed(1)} %`);
  assert.deepEqual(erreurs, [], `écarts trouvé/attendu : ${JSON.stringify(erreurs)}`);
});

test("aucune arnaque n'est classée dans une catégorie rassurante (fr et en)", () => {
  const mauvaises = [];
  for (const c of CAS) {
    if (!ARNAQUES.some((a) => a.fr === c.fr || a.en === c.en)) continue;
    for (const champ of ['fr', 'en']) {
      const trouve = classer(c[champ]).id;
      if (RASSURANTE.has(trouve)) mauvaises.push(`${c.attendu} -> ${trouve} [${champ}] : ${c[champ]}`);
    }
  }
  assert.deepEqual(mauvaises, [], `arnaque classée en rassurante : ${mauvaises.join(' | ')}`);
});

test('les messages anglais de la vérité de terrain retrouvent aussi leur catégorie', () => {
  const { ok, total, precision, erreurs } = evaluer('en');
  // eslint-disable-next-line no-console
  console.log(`[categories] précision anglaise : ${(precision * 100).toFixed(1)} % (${ok}/${total})`);
  if (erreurs.length > 0) {
    // eslint-disable-next-line no-console
    console.log('[categories] erreurs anglaises :');
    for (const e of erreurs) {
      // eslint-disable-next-line no-console
      console.log(`  ${e.source} : attendu=${e.attendu} trouvé=${e.trouve} :: ${e.texte}`);
    }
  }
  assert.ok(precision >= 0.9, `précision anglaise insuffisante : ${(precision * 100).toFixed(1)} %`);
});

test('précision par catégorie (rapport)', () => {
  const lignes = [];
  for (const cat of CATEGORIES) {
    const cas = CAS.filter((c) => c.attendu === cat.id);
    const ok = cas.filter((c) => classer(c.fr).id === cat.id).length;
    lignes.push(`${cat.id}: ${ok}/${cas.length} (${cas.length ? ((ok / cas.length) * 100).toFixed(0) : 'n/a'} %)`);
  }
  // eslint-disable-next-line no-console
  console.log('\n[categories] précision par catégorie :\n  ' + lignes.join('\n  '));
});

test('les 16 catégories ont une explication fr et en, sans montant ni chiffre', () => {
  assert.equal(CATEGORIES.length, 16);
  assert.equal(EXPLICATIONS.length, 16);
  assert.equal(new Set(EXPLICATIONS.map((e) => e.id)).size, 16);
  for (const e of EXPLICATIONS) {
    assert.ok(e.fr.trim().length > 0, `${e.id} : fr vide`);
    assert.ok(e.en.trim().length > 0, `${e.id} : en vide`);
    assert.doesNotMatch(e.fr, /\d|FCFA/, `${e.id} : montant ou chiffre dans fr`);
    assert.doesNotMatch(e.en, /\d|FCFA/i, `${e.id} : montant ou chiffre dans en`);
    const phrases = e.fr.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    assert.ok(phrases.length <= 2, `${e.id} : plus de 2 phrases`);
    assert.match(e.fr, /c'est toi qui décides/, `${e.id} : « c'est toi qui décides » absent`);
  }
});

test("la catégorie inconnue affiche exactement l'explication convenue", () => {
  const inconnu = categorieParId('inconnu');
  assert.ok(inconnu);
  assert.equal(
    inconnu.fr,
    "Kama ne reconnaît pas ce message. Lis-le bien ou demande à ta banque avant de faire quoi que ce soit, c'est toi qui décides.",
  );
  assert.equal(classer('Bonjour, comment vas-tu ?').id, 'inconnu');
  assert.equal(classer('').id, 'inconnu');
});

test('toutes les catégories d’arnaque portent le drapeau arnaque', () => {
  const arnaques = new Set(Object.values(MAP_ARNAQUES));
  for (const cat of CATEGORIES) {
    if (arnaques.has(cat.id)) assert.equal(cat.arnaque, true, `${cat.id} devrait être marquée arnaque`);
    else assert.equal(cat.arnaque, false, `${cat.id} ne devrait pas être marquée arnaque`);
  }
});
