import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { ORIGINES_KAMA } from './config/sites';
import { shadowDomCss } from './scripts/postcss-shadow-dom';

// Configuration de l'extension (le manifest.json est généré à partir d'ici).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Kama',
    description: 'Kama explique ta banque en ligne dans ta langue, à l’oral et à l’écrit.',
    permissions: ['storage'],
    action: { default_title: 'Kama' },
    // Fichiers que les éléments injectés dans la page ont le droit de charger : polices et logo.
    web_accessible_resources: [{ resources: ['fonts/*', 'icon/128.png'], matches: ORIGINES_KAMA }],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [shadowDomCss()] } },
  }),
});
