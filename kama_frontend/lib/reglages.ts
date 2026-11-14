/**
 * Réglages de Kama, mémorisés dans chrome.storage.local et partagés entre le popup
 * et la page bancaire : un changement dans le popup s'applique tout de suite dans la page.
 */
import { useEffect, useState } from 'react';
import { storage, type WxtStorageItem } from 'wxt/utils/storage';
import type { IdLangue } from '@/config/langues';

/** Langue choisie. `null` = pas encore choisie : Kama la demande avant tout le reste. */
export const reglageLangue = storage.defineItem<IdLangue | null>('local:kama.langue', { fallback: null });

/** Préférence de l'utilisateur : lire les réponses ou les écouter. */
export const reglageMode = storage.defineItem<'texte' | 'audio'>('local:kama.mode', { fallback: 'texte' });

/** Kama activé ou désactivé. Désactivé : Kama n'ajoute plus rien dans les pages. */
export const reglageActif = storage.defineItem<boolean>('local:kama.actif', { fallback: true });

/** Consentement donné au premier usage : aucune fonction ne démarre avant. Jamais envoyé nulle part. */
export const reglageConsentement = storage.defineItem<boolean>('local:kama.consentement', { fallback: false });

/**
 * Consentement séparé pour le micro. L'utilisateur a accepté que sa voix soit envoyée à Kama pour comprendre sa question
 * (message affiché au premier appui sur le micro). Seule l'acceptation est retenue :
 * après un « Non merci », la question revient au prochain appui.
 */
export const reglageConsentementMicro = storage.defineItem<boolean>('local:kama.consentementMicro', {
  fallback: false,
});

/**
 * Lit un réglage, suit ses changements (venus du popup ou de la page) et permet de le modifier.
 * Renvoie [valeur, modifier, chargé].
 */
export function useReglage<T>(item: WxtStorageItem<T, {}>) {
  const [valeur, setValeur] = useState<T>(item.fallback);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    let arreterSuivi = () => {};
    try {
      item
        .getValue()
        .then((v) => {
          if (actif) {
            setValeur(v);
            setCharge(true);
          }
        })
        .catch(() => setCharge(true));
      arreterSuivi = item.watch((v) => setValeur(v));
    } catch {
      // Extension rechargée pendant que la page reste ouverte : on garde la valeur par défaut.
      setCharge(true);
    }
    return () => {
      actif = false;
      arreterSuivi();
    };
  }, [item]);

  function modifier(v: T) {
    setValeur(v);
    try {
      item.setValue(v).catch(() => {});
    } catch {
      // Idem : sans accès à l'extension, le changement reste local à cet affichage.
    }
  }

  return [valeur, modifier, charge] as const;
}
