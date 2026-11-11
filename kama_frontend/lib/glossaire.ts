/**
 * Glossaire local : les phrases VALIDÉES par un locuteur, embarquées dans l'extension.
 *
 * Sécurité : « glossaire local d'abord ». Une phrase trouvée ici ne quitte jamais le navigateur et fonctionne sans
 * serveur. Le fichier `config/glossaire.json` est généré par `python -m app.export_glossary` depuis `content-data/`
 * (même source que le serveur) : il ne contient que des traductions validées.
 *
 * Ce fichier n'importe rien (tests sans navigateur).
 */

export type Glossaire = Record<string, Record<string, Record<string, string>> | string>;

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

/** Traduction validée d'un texte français MASQUÉ, ou `null`. */
export function chercherGlossaire(glossaire: Glossaire, langue: string, texteMasque: string): string | null {
  const parLangue = glossaire.fr;
  if (typeof parLangue !== 'object' || parLangue === null) return null;
  return parLangue[langue]?.[cleGlossaire(texteMasque)] ?? null;
}
