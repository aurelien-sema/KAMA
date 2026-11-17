/**
 * Petits éléments communs à toutes les interfaces Kama.
 * Repris des maquettes Lovable (projets « fenêtre Kama » et « onglet / sélection »).
 */
import { useState } from 'react';
import { Languages, Volume2 } from 'lucide-react';
import { useLangueCourante } from '@/lib/langue-courante';
import { ecouterTexte } from '@/lib/ecouter';
import { useTexte } from '@/lib/use-texte';

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

/**
 * Marque obligatoire sur chaque texte en langue nationale tant que la traduction n'est pas fournie
 * (règle d'or n° 4). Affiche la langue choisie, ou un texte général si aucune ne l'est encore.
 */
export function TranslationBadge() {
  const langue = useLangueCourante();
  const aVerifier = useTexte('à vérifier');
  const aFournir = useTexte('Traduction à fournir');
  return (
    <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-kama-cream px-2.5 py-1 text-xs leading-none text-kama-ink ring-1 ring-kama-orange/30">
      <Languages className="size-3.5 shrink-0 text-kama-orange" aria-hidden />
      {langue ? (
        <>
          <strong className="font-bold">{langue.nom}</strong>
          <span aria-hidden>·</span>
          <span>{aVerifier}</span>
        </>
      ) : (
        <span className="font-semibold">{aFournir}</span>
      )}
    </span>
  );
}

/** Bouton haut-parleur discret (fond blanc, crème au survol), 44 × 44 px. Lit `texte` à voix haute. */
export function SpeakButton({ texte, label }: { texte: string; label: string }) {
  const langue = useLangueCourante();
  const [note, setNote] = useState(false);
  const notePasDeVoix = useTexte("Kama n'arrive pas à joindre le serveur. Réessaie dans un instant.");

  async function lire() {
    setNote(false);
    const resultat = await ecouterTexte(texte, langue);
    if (resultat === 'indisponible') {
      setNote(true);
      window.setTimeout(() => setNote(false), 5000);
    }
  }

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={() => void lire()}
        aria-label={label}
        title={label}
        className="hit-44 grid shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-kama-ink hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        <Volume2 className="size-5" aria-hidden />
      </button>
      {note && (
        <span
          role="status"
          className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-kama-ink px-2 py-1 text-[11px] font-medium text-kama-white shadow"
        >
          {notePasDeVoix}
        </span>
      )}
    </span>
  );
}
