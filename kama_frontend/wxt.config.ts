import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { ORIGINES_KAMA } from './config/sites';
import { shadowDomCss } from './scripts/postcss-shadow-dom';

declare const process: { env: Record<string, string | undefined> }; // pas de @types/node : une dépendance de moins

// Serveur de Kama (même valeur que config/serveur.ts : ce fichier ne peut pas l'importer, il tourne avant Vite).
const SERVEUR = process.env.WXT_KAMA_API ?? 'http://127.0.0.1:8000';

// Clé PUBLIQUE qui fixe l'identifiant de l'extension (la clé privée n'existe plus : elle ne sert qu'à publier sur une boutique).
// Sans elle, l'identifiant dépend du dossier où le jury décompresse le zip, et le serveur répondrait « forbidden_origin ».
// Cet identifiant doit figurer dans KAMA_ALLOWED_ORIGINS du serveur : chrome-extension://bbgkmjbkhecafcpladgdbecpgmpcelho
const CLE_PUBLIQUE = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoaDMkn03nZsNOzUwDsWtfk1oUxnHt+yZ2wB1tw01iMGbaQyYBMcH4CAcze4gdrD7MAUC5d4DZAC+pcjDYjQ/l9t/0TcxBD6sOhWnJNwHQ7YZNq87lkrRaDloSvZtBU87VdGnYX6LEjK6p2YkdU4zKh6o1ec6smsKj8h7m1bXz5HR7GBJe/osktqMMjQ32KJpQlmQ0BMDhQcBC8pxdD8D+vpYh343D5A9bUZyJ+rVSLO4C8EWPo2ua4HHScAMbSVnH0b1z+SagkWFiQPY0/G7JAYTavEDCtyBaLyVod7yYvUmXLs/vc1k5Jzvw0PjjoiYgPQYtNdKe3sUA+cyi6JP1QIDAQAB';

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
    key: CLE_PUBLIQUE,
    // Le serveur de Kama, et lui seul, en plus des pages bancaires (matches du script injecté). Ni <all_urls>, ni tabs, ni cookies.
    host_permissions: [`${new URL(SERVEUR).origin}/*`],
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
