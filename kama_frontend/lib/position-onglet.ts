/**
 * Position verticale de l'onglet de bord, mémorisée dans chrome.storage.local.
 * Valeur = centre de l'onglet en fraction de la hauteur de la fenêtre (0 = haut, 1 = bas),
 * pour rester juste si la fenêtre du navigateur change de taille.
 */
const CLE = 'kama.ongletPosition';
export const POSITION_PAR_DEFAUT = 0.5;

export async function lirePositionOnglet(): Promise<number> {
  try {
    const valeurs = await browser.storage.local.get(CLE);
    const v = valeurs[CLE];
    return typeof v === 'number' && v >= 0 && v <= 1 ? v : POSITION_PAR_DEFAUT;
  } catch {
    return POSITION_PAR_DEFAUT;
  }
}

export async function enregistrerPositionOnglet(position: number) {
  try {
    await browser.storage.local.set({ [CLE]: position });
  } catch {
    // Sans stockage, l'onglet revient simplement au centre au prochain chargement.
  }
}

/**
 * Valeur CSS `top` du centre d'un élément de hauteur `hauteur` px placé à `position`,
 * gardé à 16 px minimum des bords haut et bas de l'écran.
 * Si l'écran est trop petit pour l'élément, celui-ci est simplement centré.
 */
export function topBorne(position: number, hauteur: number) {
  const marge = 16 + hauteur / 2;
  return `clamp(min(${marge}px, 50%), ${position * 100}%, max(calc(100% - ${marge}px), 50%))`;
}
