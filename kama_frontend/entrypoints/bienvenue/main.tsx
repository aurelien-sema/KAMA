/**
 * Page de bienvenue, ouverte toute seule à l'installation (service worker, `onInstalled`).
 * Elle est aussi ouverte sur l'étape du micro (`bienvenue.html#micro`) quand Kama n'a pas
 * encore le droit d'écouter. Le contenu est dans `components/bienvenue/Bienvenue.tsx`.
 */
import '@/assets/kama.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { LANGUE_SECOURS, secours } from '@/lib/langue-secours';
import { chargerPolices } from '@/components/polices';
import { Bienvenue } from '@/components/bienvenue/Bienvenue';

chargerPolices();
// Langue de la page pour les lecteurs d'écran : celle du navigateur (français ou anglais).
document.documentElement.lang = LANGUE_SECOURS;
document.title = secours('Bienvenue dans Kama');
ReactDOM.createRoot(document.getElementById('racine')!).render(
  <React.StrictMode>
    <Bienvenue />
  </React.StrictMode>,
);
