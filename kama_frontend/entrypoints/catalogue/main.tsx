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
import { ContenuFenetre, ETATS, MarqueurExemple, micPour, utiliseDesExemples } from '@/components/kama/fenetre/etats';

function Catalogue() {
  return (
    <main className="min-h-screen bg-bank-bg p-8">
      <header className="mb-8">
        <h1 className="m-0 font-display text-2xl text-kama-ink">Kama — Fenêtre Kama</h1>
        <p className="m-0 mt-2 text-base text-kama-ink/80">
          Les {ETATS.length} états de la fenêtre, rendus avec les composants de l'extension.
        </p>
      </header>
      <div className="flex flex-wrap gap-8">
        {ETATS.map(({ id, titre }) => (
          <figure key={id} className="m-0 flex flex-col gap-2">
            <figcaption className="text-sm font-bold text-kama-ink">{titre}</figcaption>
            <KamaWindow mic={micPour(id)}>
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
    <Catalogue />
  </React.StrictMode>,
);
