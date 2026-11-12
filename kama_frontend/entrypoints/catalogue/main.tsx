/**
 * Catalogue des états de la fenêtre Kama (outil de développement).
 * Affiche les 11 contenus côte à côte, avec les vrais composants de l'extension,
 * pour les comparer à la maquette Lovable. À retirer du zip remis au jury.
 */
import '@/assets/kama.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { chargerPolices } from '@/components/polices';
import { KamaWindow } from '@/components/kama/fenetre/KamaWindow';
import {
  avecMicro,
  ContenuFenetre,
  ETATS,
  MarqueurExemple,
  micPour,
  utiliseDesExemples,
} from '@/components/kama/fenetre/etats';
import { LANGUES } from '@/config/langues';
import { LangueCourante } from '@/lib/langue-courante';
import { PopupVue } from '@/components/popup/Popup';
import { INTENTIONS, type Intention } from '@/lib/messages';
import { reglageIntentionSimulee, useReglage } from '@/lib/reglages';

const rien = () => {};
const POPUP = [
  { titre: '1. Premier lancement', idLangue: null, actif: true, pageReconnue: true },
  { titre: '2. Activé normal', idLangue: 'ghomala', actif: true, pageReconnue: true },
  { titre: '3. Liste des langues ouverte', idLangue: 'ghomala', actif: true, pageReconnue: true, listeOuverte: true },
  { titre: '4. Désactivé', idLangue: 'ghomala', actif: false, pageReconnue: true },
  { titre: '5. Page non reconnue', idLangue: 'pidgin', actif: true, pageReconnue: false },
] as const;

/**
 * Tant que le serveur n'est pas branché, la simulation répond l'intention choisie ici à toute
 * question vocale : on peut essayer chaque réponse de Kama sur la vraie page.
 */
function IntentionSimulee() {
  const [intention, setIntention] = useReglage(reglageIntentionSimulee);
  return (
    <section className="mb-12 max-w-xl rounded-xl border border-bank-line bg-kama-white p-4">
      <h2 className="m-0 mb-2 font-display text-xl text-kama-ink">Parler à Kama : intention simulée</h2>
      <p className="m-0 mb-3 text-sm text-kama-ink/80">
        Sans serveur, toute question vocale est « comprise » comme l'intention choisie. Outil de l'équipe, absent de la
        version jury.
      </p>
      <label className="flex items-center gap-3 text-sm font-semibold text-kama-ink">
        Intention
        <select
          value={intention ?? ''}
          onChange={(e) => setIntention((e.target.value || null) as Intention | null)}
          className="h-11 rounded-lg border border-bank-line px-2 text-sm"
        >
          <option value="">Aucune (message de simulation)</option>
          {INTENTIONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function Catalogue() {
  return (
    <main className="min-h-screen bg-bank-bg p-8">
      <header className="mb-8">
        <h1 className="m-0 font-display text-2xl text-kama-ink">Kama — Catalogue des états</h1>
        <p className="m-0 mt-2 text-base text-kama-ink/80">
          Les {ETATS.length} états de la fenêtre, rendus avec les composants de l'extension (langue d'exemple :{' '}
          {LANGUES[0].nom}).
        </p>
      </header>
      <IntentionSimulee />
      <h2 className="m-0 mb-4 font-display text-xl text-kama-ink">Popup</h2>
      <div className="mb-12 flex flex-wrap items-start gap-8">
        {POPUP.map((e) => (
          <figure key={e.titre} className="m-0 flex flex-col gap-2">
            <figcaption className="text-sm font-bold text-kama-ink">{e.titre}</figcaption>
            <div className="rounded-xl border border-bank-line shadow-xl">
              <PopupVue
                idLangue={e.idLangue}
                onLangue={rien}
                mode="texte"
                onMode={rien}
                actif={e.actif}
                onActif={rien}
                pageReconnue={e.pageReconnue}
                onExpliquer={rien}
                onPasMaintenant={rien}
                listeOuverte={'listeOuverte' in e}
              />
            </div>
          </figure>
        ))}
      </div>

      <h2 className="m-0 mb-4 font-display text-xl text-kama-ink">Fenêtre Kama</h2>
      <div className="flex flex-wrap gap-8">
        {ETATS.map(({ id, titre }) => (
          <figure key={id} className="m-0 flex flex-col gap-2">
            <figcaption className="text-sm font-bold text-kama-ink">{titre}</figcaption>
            <KamaWindow mic={micPour(id)} avecMicro={avecMicro(id)}>
              {utiliseDesExemples(id) && <MarqueurExemple />}
              <ContenuFenetre etat={id} />
            </KamaWindow>
          </figure>
        ))}
      </div>
    </main>
  );
}

chargerPolices();
ReactDOM.createRoot(document.getElementById('racine')!).render(
  <React.StrictMode>
    <LangueCourante.Provider value={LANGUES[0]}>
      <Catalogue />
    </LangueCourante.Provider>
  </React.StrictMode>,
);
