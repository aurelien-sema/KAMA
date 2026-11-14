/**
 * Texte réellement sélectionné, sans passer par `Selection.toString()` : certains navigateurs
 * renvoient le texte affiché (souvent en majuscules via CSS) au lieu du texte d'origine.
 * On lit donc les plages DOM, qui conservent la casse et les accents de la page.
 */
export function texteSelection(selection: Selection | null): string {
  if (!selection || selection.rangeCount === 0) return '';
  const morceaux: string[] = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    const texte = selection.getRangeAt(i).toString();
    if (texte) morceaux.push(texte);
  }
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
}
