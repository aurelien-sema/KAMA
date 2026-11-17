// Liste toutes les phrases fixes que la fenêtre Kama envoie à la traduction (texte masqué, {x1}… à la place des montants).
//
//   node scripts/phrases-fenetre.mjs            affiche la liste
//   node scripts/phrases-fenetre.mjs --ecrire   met à jour ../content-data/kama_fenetre.json (le catalogue à faire valider par les
//                                               locuteurs), en gardant les traductions et validations déjà saisies
//
// Le test `npm test` vérifie que le catalogue contient exactement ces phrases : une phrase modifiée dans le code sans être
// ajoutée au catalogue (donc sans validation possible) fait échouer le test.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GABARITS } from '../config/gabarits.ts';
import { SAFINUM } from '../config/banques/safinum.ts';
import { ERREUR_INCONNUE } from '../config/banques/types.ts';

// Phrases de la page de test des organisateurs (la Banque Démo, absente de la version jury, n'est pas à faire valider).
const ETAPES_PARCOURS = SAFINUM.etapes;
const ERREURS = SAFINUM.erreurs;
import { PHRASES, bilanTransactions, listeOperations } from '../config/phrases.ts';
import { CONSENTEMENT, CONSENTEMENT_MICRO } from '../config/consentement.ts';
import { masquerLigne } from '../lib/lignes.ts';
import { EXPLICATIONS } from '../lib/categories.ts';

// Libellés français de la page (l'anglais du bouton « EN » de la page n'est pas une phrase de Kama à traduire).
const LIBELLES_FR = {
  solde: ['Solde disponible'],
  montant: ['Montant'],
  frais: ['Frais'],
  total: ['Total à débiter', 'Total débité'],
  'montant-saisie': ['Montant à envoyer'],
  confirmer: ['Confirmer le transfert'],
};
const MONTANT = '25 500 FCFA';

// Explications de catégorie (voie 3) : ids « b_ » pour les distinguer du catalogue historique « fen_ ».
// Source unique : kama_frontend/lib/categories.ts (les mêmes textes que ceux affichés par la fenêtre).
// Ce sont des brouillons pidgin à faire valider par un locuteur (jamais « Vérifié » avant validation).
export const EXPLICATIONS_CATEGORIES = EXPLICATIONS.map((e) => ({ id: `b_${e.id}`, fr: e.fr, zone: 'explication' }));

export function phrasesFenetre() {
  const lignes = [];
  const zone = new Map();
  const ajouter = (ligne, z, id) => {
    const { texte } = masquerLigne(typeof ligne === 'string' ? [ligne] : ligne);
    if (!zone.has(texte)) {
      zone.set(texte, z);
      lignes.push({ fr: texte, zone: z, id });
    }
  };

  for (const [id, gabarit] of Object.entries(GABARITS)) {
    for (const libelle of LIBELLES_FR[id] ?? ['']) {
      for (const total of [undefined, MONTANT]) {
        for (const l of gabarit({ libelle, valeur: MONTANT, total }).lignes) ajouter(l, 'explication');
      }
    }
  }
  for (const e of ETAPES_PARCOURS) {
    ajouter(e.phrase, 'expliquer');
    for (const s of e.etapes) ajouter(s.texte, 'expliquer');
  }
  for (const e of [...Object.values(ERREURS), ERREUR_INCONNUE]) {
    ajouter(e.titre, 'erreur');
    ajouter(e.conseil, 'erreur');
  }
  PHRASES.pageNonReconnue.forEach((t) => ajouter(t, 'expliquer'));
  ajouter(PHRASES.elementIntrouvable, 'explication');
  PHRASES.pasDeTransactions.forEach((t) => ajouter(t, 'resume'));
  ajouter(bilanTransactions('3', '5'), 'resume');
  ajouter(listeOperations('5'), 'resume');
  for (const v of Object.values(PHRASES.voix)) v.forEach((t) => ajouter(t, 'voix'));
  for (const c of [CONSENTEMENT, CONSENTEMENT_MICRO]) {
    [c.titre, ...c.points, c.accepter, c.refuser].forEach((t) => ajouter(t, 'consentement'));
  }
  for (const e of EXPLICATIONS_CATEGORIES) ajouter(e.fr, e.zone, e.id);
  return lignes.map((p) => ({ fr: p.fr, zone: p.zone, id: p.id ?? `fen_${createHash('sha1').update(p.fr).digest('hex').slice(0, 8)}` }));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop())) {
  const phrases = phrasesFenetre();
  if (!process.argv.includes('--ecrire')) {
    phrases.forEach((p) => console.log(`${p.id}  [${p.zone}]  ${p.fr}`));
    console.log(`${phrases.length} phrases`);
  } else {
    const chemin = new URL('../../content-data/kama_fenetre.json', import.meta.url);
    const ancien = existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')).entries : [];
    const parId = new Map(ancien.map((e) => [e.id, e]));
    const entries = phrases.map((p) => ({ ...(parId.get(p.id) ?? {}), id: p.id, zone: p.zone, fr: p.fr }));
    const note =
      "Phrases fixes de la fenetre Kama (generees par kama_frontend/scripts/phrases-fenetre.mjs : ne pas changer le champ fr a la main). " +
      "Meme format que safinum_test_page.json. Les montants sont les balises {x1}... remplacees par les valeurs exactes de la page. " +
      "Un champ wes ou bbj sans validated_by (ou validated_by_bbj) n'est jamais servi : il faut qu'un locuteur valide chaque phrase.";
    writeFileSync(chemin, JSON.stringify({ _note: note, entries }, null, 1) + '\n', 'utf8');
    console.log(`${entries.length} phrases ecrites`);
  }
}

