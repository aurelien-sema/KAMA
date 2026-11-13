/**
 * Charge les polices de Kama (DM Sans, Krona One) depuis les fichiers de l'extension.
 *
 * On passe par l'API FontFace plutôt que par une balise <style> : rien n'est ajouté
 * au HTML de la page bancaire (règle d'or n° 3), et les polices restent utilisables
 * dans le Shadow DOM de Kama.
 */
const POLICES = [
  { famille: 'Kama DM Sans', fichier: 'dm-sans-latin-400-normal.woff2', graisse: '400' },
  { famille: 'Kama DM Sans', fichier: 'dm-sans-latin-500-normal.woff2', graisse: '500' },
  { famille: 'Kama DM Sans', fichier: 'dm-sans-latin-700-normal.woff2', graisse: '700' },
  { famille: 'Kama Krona One', fichier: 'krona-one-latin-400-normal.woff2', graisse: '400' },
] as const;

export function chargerPolices() {
  for (const { famille, fichier, graisse } of POLICES) {
    const url = browser.runtime.getURL(`/fonts/${fichier}`);
    const police = new FontFace(famille, `url("${url}") format("woff2")`, {
      weight: graisse,
      display: 'swap',
    });
    document.fonts.add(police);
    police.load().catch(() => {
      // Police indisponible : le texte s'affiche avec la police de secours, rien de bloquant.
    });
  }
}
