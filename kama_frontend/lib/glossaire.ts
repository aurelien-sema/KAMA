/**
 * Glossaire local : les phrases VALIDÉES par un locuteur, embarquées dans l'extension.
 *
 * Sécurité : « glossaire local d'abord ». Une phrase trouvée ici ne quitte jamais le navigateur et fonctionne sans
 * serveur. Le fichier `config/glossaire.json` est généré par `python -m app.export_glossary` depuis `content-data/`
 * (même source que le serveur) : il ne contient que des traductions validées.
 *
 * Deux sortes d'entrées :
 *  - des phrases exactes (français et anglais, la page de test a un bouton EN), avec leurs valeurs masquées en {xN} ;
 *  - des MODÈLES à valeur variable (« Bonjour, Amina ») appliqués sur le texte brut : la valeur (nom, numéro, montant) est recopiée
 *    telle quelle et ne part jamais au serveur (protocole de la page de test : « remettre les valeurs extraites sans les changer »).
 *
 * Ce fichier n'importe rien (tests sans navigateur).
 */

export type Modele = { id: string; texte: string; fr?: string; en?: string };
export type Glossaire = {
  fr?: Record<string, Record<string, string>>;
  en?: Record<string, Record<string, string>>;
  patterns?: Record<string, Modele[]>;
};

const SOURCES = ['fr', 'en'] as const;

/** Forme de comparaison : casse, apostrophes typographiques, espaces et ponctuation finale ignorés (comme `normalize` du serveur). */
export function cleGlossaire(texte: string) {
  return texte
    .normalize('NFC')
    .toLowerCase()
    .replace(/’/g, "'")
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
    .replace(/[.!? ]+$/, '');
}

/** Traduction validée d'un texte MASQUÉ (français ou anglais), ou `null`. */
export function chercherGlossaire(glossaire: Glossaire, langue: string, texteMasque: string): string | null {
  const cle = cleGlossaire(texteMasque);
  for (const source of SOURCES) {
    const trouve = glossaire[source]?.[langue]?.[cle];
    if (trouve) return trouve;
  }
  return null;
}

/**
 * Modèle à valeur variable validé qui correspond au texte BRUT de la page, avec les valeurs lues : `x1`, `x2`… (dans l'ordre des groupes).
 * Rend `null` si aucun modèle ne correspond ou si la traduction réclame plus de valeurs que le modèle n'en lit.
 */
export function chercherModele(glossaire: Glossaire, langue: string, texte: string): { texte: string; valeurs: Record<string, string> } | null {
  const propre = texte.replace(/\s+/g, ' ').trim();
  for (const modele of glossaire.patterns?.[langue] ?? []) {
    for (const source of SOURCES) {
      const motif = modele[source];
      if (!motif) continue;
      let m: RegExpExecArray | null;
      try {
        m = new RegExp(motif).exec(propre);
      } catch {
        continue; // motif invalide : on l'ignore plutôt que de bloquer Kama
      }
      if (!m) continue;
      const valeurs: Record<string, string> = {};
      m.slice(1).forEach((v, i) => {
        valeurs[`x${i + 1}`] = v;
      });
      const reclamees = (modele.texte.match(/\{x(\d+)\}/g) ?? []).map((b) => b.slice(1, -1));
      if (reclamees.every((b) => b in valeurs)) return { texte: modele.texte, valeurs };
    }
  }
  return null;
}
