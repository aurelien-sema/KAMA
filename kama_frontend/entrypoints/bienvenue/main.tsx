/**
 * Page de bienvenue, ouverte toute seule à l'installation (service worker, `onInstalled`).
 * Elle est aussi ouverte sur l'étape du micro (`bienvenue.html#micro`) quand Kama n'a pas
 * encore le droit d'écouter. Le contenu est dans `components/bienvenue/Bienvenue.tsx`.
 */
import '@/assets/kama.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { chargerPolices } from '@/components/polices';
import { Bienvenue } from '@/components/bienvenue/Bienvenue';

chargerPolices();
ReactDOM.createRoot(document.getElementById('racine')!).render(
  <React.StrictMode>
    <Bienvenue />
  </React.StrictMode>,
);
