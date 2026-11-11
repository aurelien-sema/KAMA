/**
 * Lecture de la page bancaire, à partir du TEXTE affiché (la page n'a aucun repère technique).
 *
 * Règles respectées :
 *  - règle d'or n° 1 : un montant est recopié tel quel, caractère pour caractère
 *    (y compris l'espace fine insécable « 250 000 FCFA ») ; aucun modèle de langue n'y touche ;
 *  - règle d'or n° 3 : on lit seulement, on ne modifie rien dans la page ;
 *  - protocole : on ne lit jamais ce que l'utilisateur a saisi dans un champ, et rien n'est
 *    stocké ni transmis : la lecture est refaite à chaque besoin, en mémoire uniquement.
 */
import {
  ELEMENTS,
  ERREURS,
  ERREUR_INCONNUE,
  ETAPES_PARCOURS,
  type DefinitionElement,
  type EtapeParcours,
  type ExplicationErreur,
  type IdElement,
} from '@/config/page-test';

/** Compare deux textes sans tenir compte des majuscules, des espaces en trop ni d'un « : » final. */
export function normaliser(t: string) {
  return t.replace(/\s+/g, ' ').trim().replace(/\s*:$/, '').toLocaleLowerCase('fr');
}

/** Un montant tel que la page l'écrit : « 250 000 FCFA », « -12 500 FCFA », « +50 000 FCFA ». */
const RE_MONTANT = /^[+\-−]?\s*\d[\d\s.,]*\s*FCFA$/i;
const RE_CODE_ERREUR = /^[A-Z]+_\d{3}$/;

export function estMontant(t: string) {
  return RE_MONTANT.test(t.trim());
}

function estVisible(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none';
}

/** Texte propre d'un élément, tel qu'affiché (espaces internes conservés). */
function texte(el: Element) {
  return (el.textContent ?? '').trim();
}

/* ---------------------------------------------------------------------------------------- */

type IndexTextes = { libelles: Map<string, Element[]>; tousLesLibelles: Element[] };

/** Un seul passage sur la page : repère tous les textes qui sont des libellés connus. */
function indexer(): IndexTextes {
  const connus = new Set<string>();
  for (const e of ELEMENTS) for (const l of e.libelles) connus.add(normaliser(l));
  for (const etape of ETAPES_PARCOURS) for (const r of etape.reperes) connus.add(normaliser(r));

  const libelles = new Map<string, Element[]>();
  const tousLesLibelles: Element[] = [];
  const parcours = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = parcours.nextNode())) {
    const t = n.textContent;
    if (!t || t.length > 140) continue;
    const cle = normaliser(t);
    if (!connus.has(cle)) continue;
    const el = n.parentElement;
    if (!el || !estVisible(el)) continue;
    if (!libelles.has(cle)) libelles.set(cle, []);
    libelles.get(cle)!.push(el);
    tousLesLibelles.push(el);
  }
  return { libelles, tousLesLibelles };
}

function occurrences(index: IndexTextes, libelles: string[]) {
  return libelles.flatMap((l) => index.libelles.get(normaliser(l)) ?? []);
}

/** Vrai si `a` est avant `b` dans la page. */
function avant(a: Node, b: Node) {
  return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/**
 * Montant affiché à côté d'un libellé.
 * Sécurité : le montant retenu doit avoir CE libellé comme libellé connu le plus proche avant
 * lui. Ainsi, le mot « Frais » de la barre d'étapes ne récupère jamais le montant du solde.
 */
function montantVoisin(libelle: Element, index: IndexTextes): Element | null {
  if (libelle.tagName === 'DT') {
    const dd = libelle.nextElementSibling;
    return dd && estMontant(texte(dd)) ? dd : null;
  }
  let ancetre: Element | null = libelle;
  for (let niveau = 0; niveau < 3; niveau++) {
    ancetre = ancetre?.parentElement ?? null;
    if (!ancetre) return null;
    const parcours = document.createTreeWalker(ancetre, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = parcours.nextNode())) {
      const el = n.parentElement;
      if (!el || libelle.contains(el) || !avant(libelle, el)) continue;
      if (!estMontant(n.textContent ?? '') || !estVisible(el)) continue;
      const precedent = index.tousLesLibelles.filter((l) => avant(l, el) && !l.contains(el)).pop();
      if (precedent === libelle) return el;
    }
  }
  return null;
}

/** Plus petit ancêtre commun de deux éléments (la « ligne » libellé + valeur). */
function ancetreCommun(a: Element, b: Element) {
  let x: Element | null = a;
  while (x && !x.contains(b)) x = x.parentElement;
  return x ?? a;
}

/* ---------------------------------------------------------------------------------------- */

export type ElementTrouve = {
  def: DefinitionElement;
  /** Élément à côté duquel on place la pastille. */
  ancre: Element;
  /** Zone surlignée par « Montre-moi ». */
  zone: Element;
  /** Libellé tel qu'écrit dans la page (« Frais », « Total à débiter »…). */
  libelleTexte: string;
  /** Montant lu dans la page, tel quel (nature `montant`). */
  valeur?: string;
  /** Bandeau d'erreur : message et code de la banque, tels quels. */
  message?: string;
  code?: string;
};

export type LecturePage = {
  elements: Map<IdElement, ElementTrouve>;
  etape: EtapeParcours | null;
};

export function lirePage(): LecturePage {
  const index = indexer();
  const elements = new Map<IdElement, ElementTrouve>();

  for (const def of ELEMENTS) {
    for (const libelle of occurrences(index, def.libelles)) {
      const trouve = lireElement(def, libelle, index);
      if (trouve) {
        elements.set(def.id, trouve); // première occurrence utilisable
        break;
      }
    }
  }

  const etape =
    ETAPES_PARCOURS.find((e) => occurrences(index, e.reperes).length > 0) ?? null;

  return { elements, etape };
}

/**
 * Texte du libellé lui-même, sans ce que l'élément contient d'autre.
 * Ex. : `<span>Frais <span>Gratuit</span></span>` → « Frais » (et non « Frais Gratuit »).
 */
function texteDuLibelle(def: DefinitionElement, libelle: Element) {
  const voulus = def.libelles.map(normaliser);
  for (const n of libelle.childNodes) {
    if (n.nodeType !== Node.TEXT_NODE) continue;
    const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (voulus.includes(normaliser(t))) return t;
  }
  return texte(libelle);
}

function lireElement(def: DefinitionElement, libelle: Element, index: IndexTextes): ElementTrouve | null {
  const libelleTexte = texteDuLibelle(def, libelle);
  switch (def.nature) {
    case 'montant': {
      const valeur = montantVoisin(libelle, index);
      if (!valeur) return null;
      return { def, ancre: valeur, zone: ancetreCommun(libelle, valeur), valeur: texte(valeur), libelleTexte };
    }
    case 'bouton': {
      const bouton = libelle.closest('button, a, [role="button"]') ?? libelle;
      return { def, ancre: bouton, zone: bouton, libelleTexte };
    }
    case 'champ': {
      // Le libellé et son champ. On ne lit jamais la valeur saisie.
      const zone = libelle.closest('label') ?? libelle.parentElement ?? libelle;
      return { def, ancre: libelle, zone, libelleTexte };
    }
    case 'erreur': {
      const bandeau = libelle.parentElement ?? libelle;
      const textes = [...bandeau.querySelectorAll('p')].map(texte).filter(Boolean);
      const code = textes.find((t) => RE_CODE_ERREUR.test(t));
      const message = textes.find((t) => t !== libelleTexte && t !== code);
      const zone = bandeau.parentElement ?? bandeau;
      return { def, ancre: libelle, zone, code, message, libelleTexte };
    }
    case 'repere': {
      const zone = def.id === 'transactions' ? (libelle.parentElement ?? libelle) : libelle;
      return { def, ancre: libelle, zone, libelleTexte };
    }
  }
}

/* ---------------------------------------------------------------------------------------- */

export type OperationLue = { date: string; libelle: string; montant: string; sens: 'entree' | 'sortie' };

/** Lit la liste « Transactions récentes » (page Solde). Liste vide si elle n'est pas affichée. */
export function lireTransactions(lecture: LecturePage): OperationLue[] {
  const titre = lecture.elements.get('transactions');
  if (!titre) return [];
  let section: Element | null = titre.ancre;
  let montants: Element[] = [];
  for (let niveau = 0; niveau < 4 && section; niveau++) {
    section = section.parentElement;
    if (!section) break;
    montants = [...section.querySelectorAll('*')].filter(
      (el) => el.children.length === 0 && estMontant(texte(el)) && avant(titre.ancre, el),
    );
    if (montants.length) break;
  }
  return montants.map((m) => {
    // Ligne = plus petit ancêtre qui contient au moins 3 textes (libellé, date, montant).
    let ligne: Element = m;
    while (ligne.parentElement && feuilles(ligne).length < 3) ligne = ligne.parentElement;
    const autres = feuilles(ligne).filter((t) => t !== texte(m));
    const montant = texte(m);
    return {
      libelle: autres[0] ?? '',
      date: autres[1] ?? '',
      montant,
      sens: /^[\-−]/.test(montant) ? 'sortie' : 'entree',
    };
  });
}

function feuilles(el: Element) {
  return [...el.querySelectorAll('*')]
    .filter((x) => x.children.length === 0)
    .map(texte)
    .filter(Boolean);
}

/* ---------------------------------------------------------------------------------------- */

export function explicationErreur(code?: string, message?: string): ExplicationErreur {
  if (code && ERREURS[code]) return ERREURS[code];
  if (message && /solde insuffisant|insufficient balance/i.test(message)) return ERREURS.AMOUNT_002!;
  return ERREUR_INCONNUE;
}

/** Retrouve l'élément d'un texte sélectionné par l'utilisateur, s'il s'agit d'un libellé ou d'un montant connu. */
export function elementPourTexte(lecture: LecturePage, selection: string): IdElement | null {
  const cle = normaliser(selection);
  for (const [id, e] of lecture.elements) {
    if (!e.def.pastille) continue;
    if (e.def.libelles.some((l) => normaliser(l) === cle)) return id;
    if (e.valeur && normaliser(e.valeur) === cle) return id;
  }
  return null;
}
