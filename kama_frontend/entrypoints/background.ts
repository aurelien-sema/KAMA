/**
 * Service worker de Kama : le « backend interne » de l'extension.
 *
 * Il est le seul à parler au serveur (celui-ci n'accepte que l'origine de l'extension) et il ne répond qu'à
 * l'extension elle-même, depuis les pages bancaires autorisées. Il ne conserve rien et n'écrit jamais le
 * contenu des demandes dans la console (sécurité : ni stockage, ni journal du contenu).
 */
import { MatchPattern } from 'wxt/utils/match-patterns';
import { depuisBase64, type DemandeApi, type ReponseBrute } from '@/lib/api';
import { SITES_KAMA } from '@/config/sites';
import { DELAIS, URL_SERVEUR } from '@/config/serveur';

const motifs = SITES_KAMA.map((s) => new MatchPattern(s));

function demandeConnue(m: unknown): m is DemandeApi {
  if (typeof m !== 'object' || m === null || (m as { type?: unknown }).type !== 'kama:api') return false;
  return ['capabilities', 'translate', 'tts', 'intent'].includes((m as { route?: string }).route ?? '');
}

async function appelerServeur(d: DemandeApi): Promise<ReponseBrute> {
  const controle = new AbortController();
  const delai = { capabilities: DELAIS.capacites, translate: DELAIS.traduction, tts: DELAIS.voix, intent: DELAIS.reconnaissance }[d.route];
  const minuterie = setTimeout(() => controle.abort(), delai);
  try {
    let reponse: Response;
    if (d.route === 'capabilities') {
      reponse = await fetch(`${URL_SERVEUR}/v1/capabilities`, { signal: controle.signal });
    } else if (d.route === 'intent') {
      reponse = await fetch(`${URL_SERVEUR}/v1/voice/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav', 'X-Kama-Lang': d.lang },
        body: depuisBase64(d.wavBase64),
        signal: controle.signal,
      });
    } else {
      reponse = await fetch(`${URL_SERVEUR}/v1/${d.route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d.corps),
        signal: controle.signal,
      });
    }
    if (reponse.ok) return { ok: true, donnees: await reponse.json() };
    let code = 'http_error';
    try {
      code = ((await reponse.json()) as { error?: { code?: string } }).error?.code ?? code;
    } catch {
      // Corps absent ou illisible : on garde le code générique.
    }
    return { ok: false, code, statut: reponse.status };
  } catch (e) {
    return { ok: false, code: (e as Error)?.name === 'AbortError' ? 'timeout' : 'network', statut: 0 };
  } finally {
    clearTimeout(minuterie);
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, expediteur, repondre) => {
    if (!demandeConnue(message)) return;
    // Seule notre propre extension, depuis une page bancaire autorisée (pas d'autre extension, pas d'autre site).
    const url = expediteur.url ?? expediteur.tab?.url ?? '';
    if (expediteur.id !== browser.runtime.id || !motifs.some((m) => m.includes(url))) {
      repondre({ ok: false, code: 'forbidden_sender', statut: 403 } satisfies ReponseBrute);
      return;
    }
    appelerServeur(message).then(repondre);
    return true; // réponse asynchrone
  });
});
