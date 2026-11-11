/**
 * « Parler à Kama » : micro → serveur (reconnaissance de la commande) → intention → réponse affichée.
 *
 * La voix ne sert pas à dicter : le serveur renvoie seulement l'INTENTION (liste fermée) ; le texte reconnu ne sort pas du
 * serveur. Une intention ne déclenche jamais d'action sur la page : elle ne fait qu'ouvrir une explication. Les montants viennent
 * de la page, jamais de la parole.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { capacites, ErreurApi, reconnaitreIntention, type IntentionApi } from './api';
import type { Langue } from '@/config/langues';
import { demarrerEnregistrement, ErreurMicro, type Enregistrement } from './micro';

export type PhaseParler = 'ecoute' | 'reflexion' | 'non-compris' | 'indisponible' | 'micro-refuse' | 'micro-absent' | 'hors-ligne';

export function useParler(langue: Langue | null, surIntention: (intention: Exclude<IntentionApi, 'unknown'>) => boolean | void) {
  const [phase, setPhase] = useState<PhaseParler | null>(null);
  const enregistrement = useRef<Enregistrement | null>(null);
  const surIntentionRef = useRef(surIntention);
  surIntentionRef.current = surIntention;

  const annuler = useCallback(() => {
    enregistrement.current?.annuler(); // coupe le micro tout de suite
    enregistrement.current = null;
    setPhase(null);
  }, []);

  // Fermeture de la fenêtre ou démontage : le micro ne reste jamais ouvert.
  useEffect(() => () => enregistrement.current?.annuler(), []);

  const arreter = useCallback(async () => {
    const en = enregistrement.current;
    if (!en || !langue) return;
    enregistrement.current = null;
    const wav = en.arreter();
    if (!wav) return setPhase('non-compris'); // trop court
    setPhase('reflexion');
    try {
      const r = await reconnaitreIntention(wav, langue.code); // l'audio n'est gardé nulle part
      if (r.intent === 'unknown') return setPhase('non-compris');
      setPhase(null);
      if (surIntentionRef.current(r.intent) === false) setPhase('non-compris'); // ex. « répète » sans réponse précédente
    } catch (e) {
      const code = e instanceof ErreurApi ? e.code : 'network';
      if (code === 'asr_unavailable') setPhase('indisponible');
      else if (e instanceof ErreurApi && e.reessayable) setPhase('hors-ligne');
      else setPhase('non-compris');
    }
  }, [langue]);

  const demarrer = useCallback(async () => {
    if (!langue || enregistrement.current) return;
    // On demande d'abord au serveur si cette langue sait comprendre la voix : sinon on ne sollicite même pas le micro.
    try {
      const c = await capacites();
      const info = c.languages.find((l) => l.code === langue.code);
      if (!info?.asr) return setPhase('indisponible');
    } catch (e) {
      return setPhase(e instanceof ErreurApi && e.reessayable ? 'hors-ligne' : 'indisponible');
    }
    try {
      enregistrement.current = await demarrerEnregistrement(() => void arreter());
      setPhase('ecoute');
    } catch (e) {
      setPhase(e instanceof ErreurMicro && e.raison === 'absent' ? 'micro-absent' : 'micro-refuse');
    }
  }, [langue, arreter]);

  return { phase, demarrer, arreter, annuler };
}

/** Ce que Kama ouvre pour chaque intention (les intentions ne font que lire : jamais d'action sur la page). */
export const VUE_PAR_INTENTION = {
  ask_balance: { type: 'element', id: 'solde' },
  ask_fees: { type: 'element', id: 'frais' },
  ask_total: { type: 'element', id: 'total' },
  what_to_do: { type: 'expliquer' },
  explain_error: { type: 'element', id: 'erreur' },
  summarize_transactions: { type: 'resumer' },
} as const;
