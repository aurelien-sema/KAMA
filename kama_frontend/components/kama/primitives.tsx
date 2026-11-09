/**
 * Petits éléments communs à toutes les interfaces Kama.
 * Repris des maquettes Lovable (projets « fenêtre Kama » et « onglet / sélection »).
 */
import { Volume2 } from 'lucide-react';
import { lireEnFrancais } from '@/lib/voix';

/**
 * Adresse du logo, calculée une seule fois au chargement du script.
 * Si l'extension est rechargée pendant que la page reste ouverte, l'ancien Kama encore affiché
 * n'a plus le droit d'appeler l'extension (« Extension context invalidated ») : on évite donc
 * tout appel à `browser.runtime` pendant l'affichage.
 */
const URL_LOGO = browser.runtime.getURL('/icon/128.png');

/** Logo de l'équipe (mascotte K). Décoratif : le nom « Kama » est toujours écrit à côté. */
export function KamaLogo({ taille = 32 }: { taille?: number }) {
  return (
    <img
      src={URL_LOGO}
      alt=""
      width={taille}
      height={taille}
      className="shrink-0"
      style={{ width: taille, height: taille }}
    />
  );
}

/** Marque obligatoire sur chaque texte en langue nationale tant que la traduction n'est pas fournie. */
export function TranslationBadge({ language = 'EWO' }: { language?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-kama-ink/20 bg-kama-cream px-1.5 py-0.5 text-[11px] font-semibold text-kama-ink">
      {language} – traduction à fournir
    </span>
  );
}

/** Bouton haut-parleur discret (fond blanc, crème au survol), 44 × 44 px. Lit `texte` à voix haute. */
export function SpeakButton({ texte, label }: { texte: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => lireEnFrancais(texte)}
      aria-label={label}
      title={label}
      className="hit-44 grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-kama-ink hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-kama-ink"
    >
      <Volume2 className="size-5" aria-hidden />
    </button>
  );
}
