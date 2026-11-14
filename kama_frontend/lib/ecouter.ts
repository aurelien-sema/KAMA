/**
 * Lire un texte de Kama ou de la page dans la langue choisie : traduction (validée, brouillon de Kama ou automatique si le texte n'est
 * pas critique), voix du serveur, montants lus localement. Sans traduction possible, ou si le serveur ne peut pas parler :
 * aucune lecture, l'appelant affiche une annonce en pidgin. Jamais de repli en français.
 * Utilisé par [Écouter] de la barre de sélection et par les boutons haut-parleur du menu et du popup.
 */
import type { Langue } from '@/config/langues';
import { jouerParoles } from './audio';
import { valeursEntete } from './lecture-page';
import { traduireTexteLibre } from './traduction';
import { arreterLecture } from './voix';

export type ResultatEcoute = 'langue' | 'indisponible';

export async function ecouterTexte(
  texte: string,
  langue: Langue | null,
  connues: string[] = valeursEntete(),
): Promise<ResultatEcoute> {
  arreterLecture();
  if (langue) {
    try {
      const r = await traduireTexteLibre(texte, 'text', langue, connues);
      if (r.statut === 'ok' && r.paroles.length) {
        await jouerParoles(r.paroles);
        return 'langue';
      }
    } catch {
      // Serveur absent ou voix indisponible : aucune lecture, l'appelant explique en pidgin.
    }
  }
  return 'indisponible';
}
