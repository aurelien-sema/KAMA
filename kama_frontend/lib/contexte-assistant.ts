/**
 * Ce que l'assistant (LLM) apprend de l'écran : son étape et les LIBELLÉS des éléments repérés par Kama.
 *
 * Mesure de sécurité (décision du 2026-11-14) : aucun montant n'est jamais transmis. Les libellés et la question
 * de l'utilisateur sont masqués (montants, numéros, noms → {xN}) avec les valeurs lues sur la page, avant tout envoi.
 * Les montants exacts restent donnés par les pastilles et les intentions, qui lisent la bonne ligne de la page.
 */
import type { ContexteAssistant } from './api';
import type { LecturePage } from './lecture-page';
import { masquer } from './masquage';

const MAX_ELEMENTS = 20;

/** Valeurs lues sur la page (montants, saisies) : le masquage les remplace à coup sûr, même sans les reconnaître. */
export function valeursDeLaPage(lecture: LecturePage): string[] {
  return [...lecture.elements.values()].map((e) => e.valeur).filter((v): v is string => !!v && v.trim().length > 0);
}

export function contexteAssistant(lecture: LecturePage): ContexteAssistant {
  const connues = valeursDeLaPage(lecture);
  const elements: ContexteAssistant['elements'] = [...lecture.elements.values()].map((e) => ({
    id: e.def.id as string,
    label: masquer(e.libelleTexte || e.def.nom, connues).texte.slice(0, 120),
  }));
  // Messages et alertes découverts par Kama : leur nature, pas leur texte (qui peut citer un nom ou un montant).
  for (const d of lecture.decouvertes) {
    if (d.nature === 'alerte') elements.push({ id: d.cle.slice(0, 40), label: 'Message from the bank (alert)' });
    if (d.nature === 'nouveau') elements.push({ id: d.cle.slice(0, 40), label: 'New message on the page' });
  }
  return { screen: lecture.etape?.id, elements: elements.slice(0, MAX_ELEMENTS) };
}

/** Contexte prêt pour l'en-tête de la question vocale (JSON en base64url). */
export function contexteEnEntete(lecture: LecturePage): string {
  const octets = new TextEncoder().encode(JSON.stringify(contexteAssistant(lecture)));
  let binaire = '';
  octets.forEach((o) => (binaire += String.fromCharCode(o)));
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Question écrite par l'utilisateur, masquée avec les valeurs de la page avant d'être envoyée. */
export function questionMasquee(texte: string, lecture: LecturePage): string {
  return masquer(texte.trim(), valeursDeLaPage(lecture)).texte.slice(0, 300);
}
