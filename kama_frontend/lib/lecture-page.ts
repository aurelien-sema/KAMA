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
  ERREUR_INCONNUE,
  banqueCourante,
  type DefinitionElement,
  type EtapeParcours,
  type ExplicationErreur,
  type IdElement,
} from '@/config/banques';

/** Compare deux textes sans tenir compte des majuscules, des espaces en trop ni d'un « : » final. */
export function normaliser(t: string) {
  return t.replace(/\s+/g, ' ').trim().replace(/\s*:$/, '').toLocaleLowerCase('fr');
}

/**
 * Un montant tel que la page l'écrit : « 250 000 FCFA », « -12 500 FCFA », « +50 000 FCFA ».
 * Accepte aussi les autres écritures du franc CFA (« F CFA », « XAF », « CFA »), devant ou derrière,
 * pour reconnaître un montant ajouté après coup avec une autre écriture.
 */
const DEVISE = String.raw`(?:FCFA|F\.?\s?CFA|XAF|CFA)`;
const RE_MONTANT = new RegExp(
  String.raw`^(?:[+\-−]?\s*\d[\d\s.,]*\s*${DEVISE}|[+\-−]?\s*${DEVISE}\s*\d[\d\s.,]*)$`,
  'i',
);
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
  const banque = banqueCourante();
  const connus = new Set<string>();
  for (const e of banque.elements) for (const l of e.libelles) connus.add(normaliser(l));
  for (const etape of banque.etapes) for (const r of etape.reperes) connus.add(normaliser(r));

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

/**
 * Élément que Kama n'a pas dans sa configuration mais qu'il repère tout seul (contenu inédit) :
 *  - `montant` : un montant affiché, avec le texte écrit juste avant lui ;
 *  - `alerte`  : un message d'erreur ou d'alerte de la banque ;
 *  - `nouveau` : un texte apparu dans la page après son affichage (ex. ajouté par le jury) ;
 *  - `titre`, `bouton` : la structure d'un écran inconnu, pour « Expliquer cette page ».
 * Tout est recopié tel quel. Aucune pastille sur les titres et les boutons.
 */
export type NatureDecouverte = 'montant' | 'alerte' | 'nouveau' | 'titre' | 'bouton';

export type Decouverte = {
  /** Identifiant construit à partir du texte, stable d'une lecture à l'autre. */
  cle: string;
  nature: NatureDecouverte;
  ancre: Element;
  zone: Element;
  /** Texte écrit juste avant un montant (`montant`), tel quel. */
  libelle?: string;
  valeur?: string;
  /** Texte de l'alerte, du nouveau message, du titre ou du bouton, tel quel. */
  texte?: string;
  code?: string;
};

export const AVEC_PASTILLE: NatureDecouverte[] = ['montant', 'alerte', 'nouveau'];

export type LecturePage = {
  elements: Map<IdElement, ElementTrouve>;
  etape: EtapeParcours | null;
  decouvertes: Decouverte[];
};

export function lirePage(): LecturePage {
  const index = indexer();
  const elements = new Map<IdElement, ElementTrouve>();

  const banque = banqueCourante();
  for (const def of banque.elements) {
    for (const libelle of occurrences(index, def.libelles)) {
      const trouve = lireElement(def, libelle, index);
      if (trouve) {
        elements.set(def.id, trouve); // première occurrence utilisable
        break;
      }
    }
  }

  const etape =
    banque.etapes.find((e) => occurrences(index, e.reperes).length > 0) ?? null;

  return { elements, etape, decouvertes: decouvrir(elements, etape) };
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
      // Un bouton « Alerte de sécurité » (ex. panneau du jury) n'est pas un bandeau d'erreur.
      if (libelle.closest(CONTROLES)) return null;
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

/** La section « Transactions récentes » et ses montants (ou rien si elle n'est pas affichée). */
function trouverTransactions(titre: ElementTrouve | undefined): { section: Element; montants: Element[] } | null {
  if (!titre) return null;
  let section: Element | null = titre.ancre;
  for (let niveau = 0; niveau < 4 && section; niveau++) {
    section = section.parentElement;
    if (!section) break;
    const montants = [...section.querySelectorAll('*')].filter(
      (el) => el.children.length === 0 && estMontant(texte(el)) && avant(titre.ancre, el),
    );
    if (montants.length) return { section, montants };
  }
  return null;
}

function sectionTransactions(connus: ElementTrouve[]) {
  return trouverTransactions(connus.find((e) => e.def.id === 'transactions'))?.section ?? null;
}

/* ---------------------------------------------------------------------------------------- */

export function explicationErreur(code?: string, message?: string): ExplicationErreur {
  const { erreurs, erreursParMessage = [] } = banqueCourante();
  if (code && erreurs[code]) return erreurs[code];
  for (const [motif, codeConnu] of erreursParMessage) {
    if (message && motif.test(message) && erreurs[codeConnu]) return erreurs[codeConnu];
  }
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

/* ---------------------------------------------------------------------------------------- */
/* Contenu inédit : ce que Kama repère sans l'avoir dans sa configuration.                   */
/* ---------------------------------------------------------------------------------------- */

/** Zones dont Kama ne lit jamais le texte : champs, listes de choix, code de la page. */
const IGNORES =
  'script, style, noscript, template, select, option, textarea, input, [contenteditable=""], [contenteditable="true"], [aria-hidden="true"]';

/** Textes visibles d'une zone de la page (le Shadow DOM de Kama n'est jamais parcouru). */
function textesVisibles(racine: Element): Text[] {
  const resultat: Text[] = [];
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = parcours.nextNode())) {
    if (!n.textContent?.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest(IGNORES) || !estVisible(el)) continue;
    resultat.push(n as Text);
  }
  return resultat;
}

const propre = (t: string) => t.replace(/\s+/g, ' ').trim();
const lettres = (t: string) => (t.match(/\p{L}/gu) ?? []).length;

type SansCle = Omit<Decouverte, 'cle'>;

function decouvrir(elements: Map<IdElement, ElementTrouve>, etape: EtapeParcours | null): Decouverte[] {
  const textes = textesVisibles(document.body);
  const connus = [...elements.values()];
  const compteur = new Map<string, number>();
  const cle = (nature: NatureDecouverte, texteCle: string) => {
    const base = `${nature}:${normaliser(texteCle)}`;
    const n = (compteur.get(base) ?? 0) + 1;
    compteur.set(base, n);
    return n > 1 ? `${base}#${n}` : base;
  };

  const alertes = alertesInconnues(textes, connus);
  const dansUneAlerte = (el: Element) =>
    alertes.some((a) => a.zone.contains(el)) ||
    connus.some((e) => e.def.nature === 'erreur' && e.zone.contains(el));

  const resultat: Decouverte[] = [];
  for (const a of alertes) resultat.push({ ...a, cle: cle('alerte', a.texte ?? '') });
  for (const m of montantsInconnus(textes, connus)) {
    if (dansUneAlerte(m.ancre)) continue;
    resultat.push({ ...m, cle: cle('montant', `${m.libelle ?? ''} ${m.valeur}`) });
  }
  for (const n of nouveauxTextes(textes, etape?.id ?? 'inconnue')) {
    if (dansUneAlerte(n.ancre)) continue;
    resultat.push({ ...n, cle: cle('nouveau', n.texte ?? '') });
  }
  for (const s of structure()) resultat.push({ ...s, cle: cle(s.nature, s.texte ?? '') });

  return resultat.sort((a, b) => (a.ancre === b.ancre ? 0 : avant(a.ancre, b.ancre) ? -1 : 1));
}

/* --- A. Montants -------------------------------------------------------------------------- */

/**
 * Tous les montants affichés que la configuration ne connaît pas.
 * Exclus : les montants déjà expliqués, ceux des transactions, et ceux des listes ou tableaux
 * (3 montants ou plus au même endroit) : les pastilles restent réservées aux montants isolés.
 */
function montantsInconnus(textes: Text[], connus: ElementTrouve[]): SansCle[] {
  const dejaLus = connus.filter((e) => e.valeur).map((e) => e.ancre);
  const transactions = sectionTransactions(connus);
  const trouves: Element[] = [];
  for (const t of textes) {
    const el = t.parentElement!;
    const brut = propre(t.textContent ?? '');
    let cible: Element | null = null;
    if (estMontant(brut)) cible = el;
    // Chiffres et devise dans deux balises voisines : « <b>25 000</b> FCFA ».
    else if (/^[+\-−]?\s*\d[\d\s.,]*$/.test(brut) && el.parentElement && estMontant(texte(el.parentElement)))
      cible = el.parentElement;
    if (!cible || trouves.includes(cible)) continue;
    const c = cible;
    if (dejaLus.some((d) => d === c || d.contains(c) || c.contains(d))) continue;
    if (transactions?.contains(c)) continue;
    trouves.push(c);
  }

  const listeDe = (el: Element) => el.closest('table, ul, ol, [role="table"], [role="list"], [role="grid"]');
  const parListe = new Map<Element, number>();
  for (const el of trouves) {
    const l = listeDe(el);
    if (l) parListe.set(l, (parListe.get(l) ?? 0) + 1);
  }
  // Libellés déjà connus : un montant écrit une 2e fois sous le même libellé (ex. le solde
  // rappelé sur le côté de la page) n'a pas besoin d'une 2e pastille.
  const libellesConnus = new Set(banqueCourante().elements.flatMap((e) => e.libelles.map(normaliser)));
  return trouves
    .filter((el) => {
      const l = listeDe(el);
      return !l || (parListe.get(l) ?? 0) < 3;
    })
    .map((el) => ({ el, libelle: libelleVoisin(el) }))
    .filter(({ libelle }) => !libelle || !libellesConnus.has(normaliser(libelle)))
    .map(({ el, libelle }) => {
      return {
        nature: 'montant' as const,
        ancre: el,
        zone: (libelle && ligneDe(el)) || el,
        libelle,
        // Recopié tel quel (seuls les blancs du début et de la fin sont retirés).
        valeur: texte(el),
      };
    });
}

/** Texte écrit juste avant le montant, dans la même ligne (au plus 3 niveaux au-dessus). */
function libelleVoisin(cible: Element): string | undefined {
  let ancetre: Element | null = cible;
  for (let niveau = 0; niveau < 3; niveau++) {
    ancetre = ancetre?.parentElement ?? null;
    if (!ancetre || ancetre === document.body) return undefined;
    const avantLui = textesVisibles(ancetre)
      .filter((t) => !cible.contains(t) && avant(t, cible))
      .map((t) => propre(t.textContent ?? ''))
      .filter((t) => lettres(t) > 1 && !estMontant(t) && t.length <= 60);
    const dernier = avantLui.at(-1);
    if (dernier) return dernier.replace(/\s*:\s*$/, '');
  }
  return undefined;
}

/** Plus petit ancêtre qui contient le montant et le texte qui le précède. */
function ligneDe(el: Element): Element | null {
  let a: Element | null = el.parentElement;
  for (let niveau = 0; a && niveau < 3; niveau++, a = a.parentElement) {
    if (textesVisibles(a).some((t) => !el.contains(t) && lettres(t.textContent ?? '') > 1)) return a;
  }
  return null;
}

/* --- B. Alertes ---------------------------------------------------------------------------- */

const CONTROLES = 'button, a, label, [role="button"], [role="tab"], [role="menuitem"]';

const RE_DEBUT_ALERTE =
  /^(attention|alerte|avertissement|erreur|important|danger|warning|alert|error|caution)\b/i;

/**
 * Messages d'erreur ou d'alerte que la configuration ne connaît pas, repérés par :
 * un rôle d'alerte (accessibilité), un code d'erreur (« XXX_000 ») ou un premier mot d'alerte.
 */
function alertesInconnues(textes: Text[], connus: ElementTrouve[]): SansCle[] {
  const erreursConnues = connus.filter((e) => e.def.nature === 'erreur');
  const blocs: Element[] = [];
  const ajouter = (bloc: Element | null) => {
    if (!bloc || bloc === document.body || !estVisible(bloc)) return;
    if (erreursConnues.some((e) => e.zone.contains(bloc) || bloc.contains(e.ancre))) return;
    if (blocs.some((b) => b.contains(bloc))) return;
    for (let i = blocs.length - 1; i >= 0; i--) if (bloc.contains(blocs[i]!)) blocs.splice(i, 1);
    blocs.push(bloc);
  };

  for (const el of document.querySelectorAll('[role="alert"], [role="alertdialog"], [aria-live="assertive"]')) {
    if (el.textContent?.trim() && !el.closest(IGNORES)) ajouter(el);
  }
  for (const t of textes) {
    const brut = propre(t.textContent ?? '');
    if (RE_CODE_ERREUR.test(brut)) ajouter(blocAutour(t.parentElement!));
    // Un bouton qui s'appelle « Alerte… » n'est pas une alerte.
    else if (RE_DEBUT_ALERTE.test(brut) && brut.length >= 15 && !t.parentElement!.closest(CONTROLES))
      ajouter(t.parentElement);
  }

  return blocs.map((bloc) => {
    const morceaux = textesVisibles(bloc).map((t) => propre(t.textContent ?? ''));
    const code = morceaux.find((m) => RE_CODE_ERREUR.test(m));
    return {
      nature: 'alerte' as const,
      ancre: bloc,
      zone: bloc,
      code,
      texte: morceaux.filter((m) => m !== code).join(' '),
    };
  });
}

/** Le bandeau autour d'un code d'erreur : premier ancêtre qui contient aussi un message. */
function blocAutour(el: Element): Element {
  let a: Element = el;
  for (let niveau = 0; niveau < 3 && a.parentElement; niveau++) {
    a = a.parentElement;
    const message = textesVisibles(a).some((t) => {
      const brut = propre(t.textContent ?? '');
      return lettres(brut) >= 10 && !RE_CODE_ERREUR.test(brut);
    });
    if (message) return a;
  }
  return a;
}

/* --- B. Textes apparus après l'affichage (contenu injecté) ---------------------------------- */

/**
 * Kama retient les textes présents quand un écran s'affiche (en mémoire seulement, rien n'est
 * stocké). Un texte qui apparaît ensuite, sur le même écran, est un « nouveau message ».
 * Un grand changement d'un coup (nouvel écran, page passée en anglais) remet tout à zéro.
 */
const ATTENTE_APRES_CHANGEMENT = 1500;
const MAX_NOUVEAUX_D_UN_COUP = 6;
const suivi = {
  ecran: '',
  base: new Set<string>(),
  blocs: new WeakSet<Element>(),
  depuis: 0,
  /** Messages déjà signalés : ils restent « nouveaux » même si on change d'écran. */
  signales: new Set<string>(),
};

function nouveauxTextes(textes: Text[], ecran: string): SansCle[] {
  const phrases = textes.filter((t) => {
    const brut = propre(t.textContent ?? '');
    return lettres(brut) >= 10 && brut.split(' ').length >= 3 && !estMontant(brut);
  });
  const cleDe = (t: Text) => normaliser(t.textContent ?? '');
  const maintenant = performance.now();
  const retenir = (t: Text) => {
    suivi.base.add(cleDe(t));
    suivi.blocs.add(t.parentElement!);
  };
  if (suivi.ecran !== ecran) {
    suivi.ecran = ecran;
    suivi.base = new Set();
    suivi.blocs = new WeakSet();
    phrases.filter((t) => !suivi.signales.has(cleDe(t))).forEach(retenir);
    suivi.depuis = maintenant;
  }
  // Un texte qui change à un endroit déjà affiché (ex. la phrase des frais quand on change le
  // type d'envoi) est une mise à jour de la page, pas un nouveau message.
  for (const t of phrases) if (suivi.blocs.has(t.parentElement!)) suivi.base.add(cleDe(t));
  let nouveaux = phrases.filter((t) => !suivi.base.has(cleDe(t)));
  const dejaSignales = nouveaux.filter((t) => suivi.signales.has(cleDe(t)));
  const inconnus = nouveaux.filter((t) => !suivi.signales.has(cleDe(t)));
  const enTransition = maintenant - suivi.depuis < ATTENTE_APRES_CHANGEMENT;
  if (enTransition || inconnus.length > MAX_NOUVEAUX_D_UN_COUP) {
    inconnus.forEach(retenir);
    if (!enTransition) suivi.depuis = maintenant;
    nouveaux = dejaSignales;
  }
  const vus: Element[] = [];
  const textesVus = new Set<string>();
  const resultat: SansCle[] = [];
  for (const t of nouveaux) {
    const el = t.parentElement!;
    // Le même texte affiché deux fois (ex. recopié dans une liste) : une seule pastille.
    if (vus.some((v) => v.contains(el)) || textesVus.has(cleDe(t))) continue;
    vus.push(el);
    textesVus.add(cleDe(t));
    suivi.signales.add(cleDe(t));
    resultat.push({ nature: 'nouveau', ancre: el, zone: el, texte: propre(t.textContent ?? '') });
  }
  return resultat;
}

/* --- C. Structure d'un écran inconnu ------------------------------------------------------- */

function structure(): SansCle[] {
  const resultat: SansCle[] = [];
  const titres = [...document.querySelectorAll('h1, h2, h3, [role="heading"]')]
    .filter((el) => !el.closest(IGNORES) && estVisible(el))
    .map((el) => ({ el, t: propre(texte(el)) }))
    .filter(({ t }) => t.length >= 3 && t.length <= 80)
    .slice(0, 3);
  for (const { el, t } of titres) resultat.push({ nature: 'titre', ancre: el, zone: el, texte: t });

  const boutons = [...document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')]
    .filter((el) => estVisible(el) && !(el as HTMLButtonElement).disabled)
    .map((el) => {
      const valeur = el instanceof HTMLInputElement ? el.value : texte(el);
      return { el, t: propre(valeur || (el.getAttribute('aria-label') ?? '')) };
    })
    .filter(({ t }) => lettres(t) >= 3 && t.length <= 60)
    .slice(0, 5);
  for (const { el, t } of boutons) resultat.push({ nature: 'bouton', ancre: el, zone: el, texte: t });
  return resultat;
}

/** Retrouve une découverte par sa clé (pour « Montre-moi » et la fenêtre). */
export function trouverDecouverte(lecture: LecturePage, cle: string) {
  return lecture.decouvertes.find((d) => d.cle === cle) ?? null;
}

/** Nom affiché dans « Élément choisi : … » et dans l'étiquette de la pastille. */
export function nomDecouverte(d: Decouverte) {
  switch (d.nature) {
    case 'montant':
      return d.libelle ? `Montant : ${d.libelle}` : 'Montant';
    case 'alerte':
      return 'Message de la banque';
    case 'nouveau':
      return 'Nouveau message';
    case 'titre':
      return `Titre « ${d.texte} »`;
    case 'bouton':
      return `Bouton « ${d.texte} »`;
  }
}
