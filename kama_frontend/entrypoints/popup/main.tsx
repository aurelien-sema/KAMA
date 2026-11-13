/**
 * Point d'entrée du popup de Kama. Le contenu est dans `components/popup/Popup.tsx`.
 */
import '@/assets/kama.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { chargerPolices } from '@/components/polices';
import { Popup } from '@/components/popup/Popup';

chargerPolices();
ReactDOM.createRoot(document.getElementById('racine')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
