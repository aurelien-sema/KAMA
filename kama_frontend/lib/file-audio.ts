/**
 * File d'attente des demandes audio : deux requêtes réseau au plus, la lecture demandée passe avant le préchargement.
 * Le découpage garde les balises {xN} entières ; les essais sont réservés aux erreurs passagères du serveur.
 */
export const MAX_TEXTE = 500;
export const DELAIS_ESSAIS = [1000, 2000, 4000] as const;

type Travail = {
  prioritaire: boolean;
  lancer: () => Promise<unknown>;
  resolve: (valeur: unknown) => void;
  reject: (erreur: unknown) => void;
};

export class FileAudio {
  private attente: Travail[] = [];
  private actifs = 0;
  private readonly maximum: number;

  constructor(maximum = 2) {
    this.maximum = maximum;
  }

  executer<T>(lancer: () => Promise<T>, prioritaire = false): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.attente.push({
        prioritaire,
        lancer: lancer as () => Promise<unknown>,
        resolve: resolve as (valeur: unknown) => void,
        reject,
      });
      this.lancerSuivant();
    });
  }

  private lancerSuivant() {
    while (this.actifs < this.maximum && this.attente.length) {
      const index = this.attente.findIndex((t) => t.prioritaire);
      const travail = this.attente.splice(index < 0 ? 0 : index, 1)[0]!;
      this.actifs += 1;
      void Promise.resolve()
        .then(travail.lancer)
        .then(travail.resolve, travail.reject)
        .finally(() => {
          this.actifs -= 1;
          this.lancerSuivant();
        });
    }
  }
}

const SLOT = /\{x\d+\}/g;

/** Coupe un texte trop long aux phrases ou aux espaces, jamais au milieu d'une balise {xN}. */
export function decouperTexte(texte: string, maximum = MAX_TEXTE): string[] {
  let reste = texte.trim();
  const morceaux: string[] = [];
  while (reste.length > maximum) {
    let coupe = maximum;
    const phrase = Math.max(
      reste.lastIndexOf('. ', maximum),
      reste.lastIndexOf('! ', maximum),
      reste.lastIndexOf('? ', maximum),
      reste.lastIndexOf('; ', maximum),
    );
    if (phrase >= Math.floor(maximum / 2) && phrase + 1 <= maximum) {
      coupe = phrase + 1;
    } else {
      const espace = reste.lastIndexOf(' ', maximum);
      if (espace > 0) coupe = espace;
    }
    for (const m of reste.matchAll(SLOT)) {
      const debut = m.index ?? 0;
      if (debut < coupe && coupe < debut + m[0].length) {
        coupe = debut;
        break;
      }
    }
    if (coupe <= 0) coupe = maximum;
    const morceau = reste.slice(0, coupe).trim();
    if (morceau) morceaux.push(morceau);
    reste = reste.slice(coupe).trimStart();
  }
  if (reste) morceaux.push(reste);
  return morceaux;
}

/** `busy` et `rate_limited` sont les seules erreurs où réessayer ne change pas la demande. */
export function doitReessayer(code: string | undefined) {
  return code === 'busy' || code === 'rate_limited';
}

export function attendre(millisecondes: number) {
  return new Promise<void>((fini) => setTimeout(fini, millisecondes));
}
