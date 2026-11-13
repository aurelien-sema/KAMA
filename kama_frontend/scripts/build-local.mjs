// Construit l'extension pour le serveur LOCAL (backend/scripts/lancer_demo.ps1, http://127.0.0.1:8000).
// Par défaut (npm run build), l'extension pointe sur le serveur hébergé de l'équipe (config/serveur.ts).
//   npm run build:local            Chrome
//   npm run build:local -- -b edge Edge
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['wxt', 'build', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, WXT_KAMA_API: 'http://127.0.0.1:8000' },
});
process.exit(r.status ?? 1);
