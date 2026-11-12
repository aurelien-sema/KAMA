import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { ORIGINES_KAMA } from './config/sites';
import { SERVEUR_KAMA } from './config/serveur';
import { shadowDomCss } from './scripts/postcss-shadow-dom';

/** Version jury : sans les pages locales de l'équipe (localhost). */
const origines = (mode: string) =>
  mode === 'jury' ? ORIGINES_KAMA.filter((o) => !/localhost|127\.0\.0\.1/.test(o)) : ORIGINES_KAMA;

// Configuration de l'extension (le manifest.json est généré à partir d'ici).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => ({
    name: 'Kama',
    description: 'Kama explique ta banque en ligne dans ta langue, à l’oral et à l’écrit.',
    // `offscreen` : document caché où Kama écoute le micro (aucun avertissement à l'installation).
    permissions: ['storage', 'offscreen'],
    // Le service worker n'a le droit d'appeler que le serveur de Kama (aucun autre site).
    host_permissions: SERVEUR_KAMA ? [`${SERVEUR_KAMA}/*`] : [],
    action: { default_title: 'Kama' },
    // Fichiers que les éléments injectés dans la page ont le droit de charger : polices et logo.
    web_accessible_resources: [{ resources: ['fonts/*', 'icon/128.png'], matches: origines(mode) }],
  }),
  hooks: {
    // Version jury (`--mode jury`) : sans le catalogue des états, outil interne de l'équipe.
    'entrypoints:resolved': (wxt, entrypoints) => {
      if (wxt.config.mode !== 'jury') return;
      const i = entrypoints.findIndex((e) => e.name === 'catalogue');
      if (i >= 0) entrypoints.splice(i, 1);
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [shadowDomCss()] } },
  }),
});
