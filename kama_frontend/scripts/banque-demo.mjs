// Sert la banque fictive de démonstration (banque-demo/index.html) sur http://localhost:5180.
// Lancer : npm run banque-demo. Rien d'autre n'est servi.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = 5180;
const PAGE = new URL('../banque-demo/index.html', import.meta.url);

createServer(async (requete, reponse) => {
  if (requete.url !== '/' && requete.url !== '/index.html') {
    reponse.writeHead(404).end();
    return;
  }
  reponse.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  reponse.end(await readFile(PAGE));
}).listen(PORT, '127.0.0.1', () => console.log(`Banque Démo : http://localhost:${PORT}`));
