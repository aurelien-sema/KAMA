/**
 * Point d'entrée du popup de Kama. Le contenu est dans `components/popup/Popup.tsx`.
 */
import '@/assets/kama.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LANGUE_SECOURS } from '@/lib/langue-secours';
import { chargerPolices } from '@/components/polices';
import { Popup } from '@/components/popup/Popup';

chargerPolices();
// Langue de la page pour les lecteurs d'écran : celle du navigateur (français ou anglais).
document.documentElement.lang = LANGUE_SECOURS;
ReactDOM.createRoot(document.getElementById('racine')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
