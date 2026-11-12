/**
 * Service worker de Kama : le « backend interne » de l'extension (backend/ARCHITECTURE.md).
 *  - Ouvre la page de bienvenue à l'installation.
 *  - Relais vers le serveur (traduction, voix, capacités, intentions) : il est le seul à parler au serveur (celui-ci n'accepte
 *    que l'origine de l'extension) et il ne répond qu'à l'extension elle-même, depuis les pages bancaires autorisées.
 *  - « Parler à Kama » : pilote le document caché qui écoute (`entrypoints/micro/`), relaie le niveau du son vers la page,
 *    puis envoie la voix au serveur. La page bancaire ne contacte jamais le serveur et ne reçoit jamais la voix.
 * Il ne conserve rien et n'écrit jamais le contenu des demandes dans la console (sécurité : ni stockage, ni journal du contenu).
 */
import { MatchPattern } from 'wxt/utils/match-patterns';
import { type DemandeApi, type ReponseBrute } from '@/lib/api';
import { SITES_KAMA } from '@/config/sites';
import { DELAI_SERVEUR_MS, DELAIS, SERVEUR_KAMA, URL_SERVEUR } from '@/config/serveur';
import {
  PORT_MICRO,
  depuisBase64,
  pourDestinataire,
  type CommandeMicro,
  type DemandeAutorisation,
  type DepuisDocumentMicro,
  type ErreurMicro,
  type EvenementMicro,
  type ResultatIntention,
  type VersDocumentMicro,
} from '@/lib/messages';

const PAGE_BIENVENUE = '/bienvenue.html';
const DOCUMENT_MICRO = '/micro.html';
const motifs = SITES_KAMA.map((s) => new MatchPattern(s));

export default defineBackground(() => {
  // Installation : la page de bienvenue s'ouvre toute seule (langue, micro, épingler l'icône).
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') browser.tabs.create({ url: browser.runtime.getURL(PAGE_BIENVENUE) });
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name === PORT_MICRO) brancherPage(port);
  });

  browser.runtime.onMessage.addListener((message, expediteur, repondre) => {
    if (demandeConnue(message)) {
      // Seule notre propre extension, depuis une page bancaire autorisée (pas d'autre extension, pas d'autre site).
      const url = expediteur.url ?? expediteur.tab?.url ?? '';
      if (expediteur.id !== browser.runtime.id || !motifs.some((m) => m.includes(url))) {
        repondre({ ok: false, code: 'forbidden_sender', statut: 403 } satisfies ReponseBrute);
        return;
      }
      appelerServeur(message).then(repondre);
      return true; // réponse asynchrone
    }
    if (pourDestinataire<DepuisDocumentMicro>(message, 'service')) void depuisDocumentMicro(message);
    else if ((message as DemandeAutorisation)?.type === 'kama:autoriser-micro') {
      browser.tabs.create({ url: browser.runtime.getURL(`${PAGE_BIENVENUE}#micro`) });
    }
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Relais vers le serveur (traduction, voix, capacités, intentions)                          */
/* ---------------------------------------------------------------------------------------- */

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

/* ---------------------------------------------------------------------------------------- */
/* Une seule conversation à la fois : la page qui parle à Kama en ce moment.                */
/* ---------------------------------------------------------------------------------------- */

type Port = ReturnType<typeof browser.runtime.connect>;
const session: { port: Port | null; langue: string; voix: string | null } = { port: null, langue: 'fr', voix: null };

function versPage(e: EvenementMicro) {
  try {
    session.port?.postMessage(e);
  } catch {
    // Page fermée entre-temps.
  }
}

function versDocumentMicro(type: VersDocumentMicro['type']) {
  return browser.runtime.sendMessage({ cible: 'micro', type } satisfies VersDocumentMicro);
}

function brancherPage(port: Port) {
  if (session.port && session.port !== port) session.port.disconnect();
  session.port = port;
  session.voix = null;

  port.onMessage.addListener(async (m: CommandeMicro) => {
    if (session.port !== port) return;
    switch (m.type) {
      case 'demarrer': {
        session.langue = m.langue;
        session.voix = null;
        try {
          await assurerDocumentMicro();
          const r = (await versDocumentMicro('demarrer')) as { ok: boolean; code?: string } | undefined;
          if (r?.ok) versPage({ type: 'ecoute' });
          else versPage({ type: 'erreur', code: (r?.code as ErreurMicro) ?? 'indisponible' });
        } catch {
          versPage({ type: 'erreur', code: 'indisponible' });
        }
        break;
      }
      case 'arreter':
        versDocumentMicro('arreter').catch(() => {});
        break;
      case 'reessayer':
        if (session.voix) await analyser(session.voix, 0);
        break;
    }
  });

  // Fenêtre Kama fermée, page quittée : on coupe le micro et on oublie la voix.
  port.onDisconnect.addListener(() => {
    if (session.port !== port) return;
    session.port = null;
    session.voix = null;
    versDocumentMicro('annuler').catch(() => {});
  });
}

async function depuisDocumentMicro(m: DepuisDocumentMicro) {
  if (m.type === 'niveau') return versPage({ type: 'niveau', niveau: m.niveau });
  if (!m.ok) {
    if (m.raison === 'rien-entendu') versPage({ type: 'rien-entendu' });
    return;
  }
  await analyser(m.wav, m.duree);
}

/** Envoie la voix au serveur et transmet l'intention à la page. */
async function analyser(wav: string, duree: number) {
  if (duree) versPage({ type: 'envoi', duree });
  session.voix = wav; // gardée en mémoire seulement pour « Réessayer »
  const resultat = await comprendre(wav, session.langue);
  if (resultat.ok) session.voix = null;
  versPage({ type: 'resultat', resultat });
}

/* ---------------------------------------------------------------------------------------- */

let creation: Promise<void> | null = null;

/** Crée le document caché qui écoute, s'il n'existe pas déjà. */
async function assurerDocumentMicro() {
  const existants = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as Browser.runtime.ContextType],
    documentUrls: [browser.runtime.getURL(DOCUMENT_MICRO)],
  });
  if (existants.length) return;
  creation ??= browser.offscreen
    .createDocument({
      url: DOCUMENT_MICRO,
      reasons: ['USER_MEDIA' as Browser.offscreen.Reason],
      justification: "Écouter la question que l'utilisateur pose à Kama.",
    })
    .finally(() => {
      creation = null;
    });
  await creation;
}

async function comprendre(audio: string, langue: string): Promise<ResultatIntention> {
  // Mode simulation : pas encore de serveur en ligne. On répond après un court délai, comme
  // le ferait le serveur, sans rien envoyer nulle part. La voix est oubliée aussitôt.
  if (!SERVEUR_KAMA) {
    await new Promise((r) => setTimeout(r, 900));
    return { ok: true, intention: 'unknown', confiance: 0, simulation: true };
  }

  const abandon = new AbortController();
  const minuterie = setTimeout(() => abandon.abort(), DELAI_SERVEUR_MS);
  try {
    const reponse = await fetch(`${SERVEUR_KAMA}/v1/voice/intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav', 'X-Kama-Lang': langue },
      body: depuisBase64(audio),
      signal: abandon.signal,
    });
    const corps = await reponse.json().catch(() => null);
    if (!reponse.ok) return { ok: false, code: corps?.error?.code ?? `http_${reponse.status}` };
    return { ok: true, intention: corps.intent, confiance: corps.confidence, simulation: false };
  } catch {
    return { ok: false, code: 'reseau' };
  } finally {
    clearTimeout(minuterie);
  }
}
