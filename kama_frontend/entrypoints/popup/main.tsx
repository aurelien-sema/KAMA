/**
 * Popup de Kama (clic sur l'icône dans la barre du navigateur), 340 px de large.
 * Pour l'instant : un écran d'attente. Les réglages (maquette Lovable « Popup »)
 * arrivent à l'étape suivante.
 */
import '@/assets/kama.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { chargerPolices } from '@/components/polices';

function Popup() {
  return (
    <main className="flex w-[340px] flex-col gap-3 bg-kama-white p-4">
      <header className="flex items-center gap-3">
        <img src="/icon/128.png" alt="" width={40} height={40} className="size-10" />
        <h1 className="font-display text-xl text-kama-ink">Kama</h1>
      </header>
      <p className="rounded-xl bg-kama-cream p-3 text-base text-kama-ink">
        Kama est installé. Les réglages arrivent bientôt.
      </p>
      {/* Outil de développement, à retirer avant la remise au jury. */}
      <button
        type="button"
        onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/catalogue.html') })}
        className="hit-44 cursor-pointer rounded-full border-2 border-kama-ink bg-kama-white px-4 text-sm font-semibold text-kama-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
      >
        Voir le catalogue des états (développement)
      </button>
    </main>
  );
}

chargerPolices();
ReactDOM.createRoot(document.getElementById('racine')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
