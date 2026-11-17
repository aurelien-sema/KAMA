import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { ORIGINES_KAMA } from './config/sites';
import { shadowDomCss } from './scripts/postcss-shadow-dom';

declare const process: { env: Record<string, string | undefined> }; // pas de @types/node : une dépendance de moins

// Serveur de Kama (même valeur que config/serveur.ts : ce fichier ne peut pas l'importer, il tourne avant Vite).
const SERVEUR = process.env.WXT_KAMA_API ?? 'https://kama-project.duckdns.org';

// Clé PUBLIQUE qui fixe l'identifiant de l'extension (la clé privée n'existe plus : elle ne sert qu'à publier sur une boutique).
// Sans elle, l'identifiant dépend du dossier où le jury décompresse le zip, et le serveur répondrait « forbidden_origin ».
// Cet identifiant doit figurer dans KAMA_ALLOWED_ORIGINS du serveur : chrome-extension://nneecloagollpakilpepnamdaelmgkbn
// (clé fixée par Eunice pour le serveur hébergé et la CI).
const CLE_PUBLIQUE = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqnKmnqINdLDd9mzPYpQfLA7dNgWJxI5bFLJ0lMRouaW3SvpsgdN29OUyk+kplEXKfZfT+DwYFagY1LE5Z7nI4R6BY6gNxj/Rzo4wLY4uashUHefPWczPiFTpugtmV5+lwYEfP53x2l6LRVb8/ltyKcVkU4/vTkZbz7a2Xgg5FrSygiwWXT0lwX9NKj82fHyVxFWI6MnfBNPohSL3rwHvHoJ+I+PRf9F8J7pCefh9w9az9qU3M3hUKXgJqzdP62SdKiZeMrVE3ai7flDAU+RYRJPmwFe7jD58SeLeBQh3mx9LDEQG70Pdk8HIlpsuLUq7S3GckQFYPRASKsi+VornaQIDAQAB';

/** Version jury : sans les pages locales de l'équipe (localhost). */
const origines = (mode: string) =>
  mode === 'jury' ? ORIGINES_KAMA.filter((o) => !/localhost|127\.0\.0\.1/.test(o)) : ORIGINES_KAMA;

// Configuration de l'extension (le manifest.json est généré à partir d'ici).
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => ({
    // Nom et description dans la langue du navigateur (public/_locales/fr et en) ; anglais pour les autres langues.
    name: '__MSG_nom__',
    description: '__MSG_description__',
    default_locale: 'en',
    // `offscreen` : document caché où Kama écoute le micro (aucun avertissement à l'installation).
    permissions: ['storage', 'offscreen'],
    key: CLE_PUBLIQUE,
    // Le serveur de Kama, et lui seul, en plus des pages bancaires (matches du script injecté). Ni <all_urls>, ni tabs, ni cookies.
    host_permissions: [`${new URL(SERVEUR).origin}/*`],
    action: { default_title: 'Kama' },
    // Fichiers que les éléments injectés dans la page ont le droit de charger : polices et logo.
    web_accessible_resources: [{ resources: ['fonts/*', 'icon/128.png'], matches: origines(mode) }],
  }),
  vite: () => ({
    plugins: [tailwindcss()],
    css: { postcss: { plugins: [shadowDomCss()] } },
  }),
});
