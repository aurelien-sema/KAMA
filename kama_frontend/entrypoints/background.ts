/**
 * Service worker de Kama : le « backend interne » de l'extension (backend/ARCHITECTURE.md).
 *  - Ouvre la page de bienvenue à l'installation.
 *  - Seul à parler au serveur (celui-ci n'accepte que l'origine de l'extension) : traduction, voix, capacités.
 *    Il ne répond qu'à l'extension elle-même, depuis les pages bancaires autorisées.
 *  - « Parler à Kama » : pilote le document caché qui écoute (`entrypoints/micro/`), relaie le niveau du son
 *    vers la page, puis envoie la voix au serveur. La page bancaire ne reçoit jamais la voix et n'a jamais
 *    accès au micro.
 * Il ne conserve rien et n'écrit jamais le contenu des demandes dans la console (sécurité).
 */
import { MatchPattern } from 'wxt/utils/match-patterns';
import { depuisBase64, type DemandeApi, type LangueServeur, type ReponseBrute } from '@/lib/api';
import { SITES_KAMA } from '@/config/sites';
import { DELAIS, URL_SERVEUR } from '@/config/serveur';
import {
  PORT_MICRO,
  intentionConnue,
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

/** Seule notre propre extension, depuis une page bancaire autorisée (pas d'autre extension, pas d'autre site). */
function expediteurAutorise(expediteur: { id?: string; url?: string; tab?: { url?: string } } | undefined) {
  const url = expediteur?.url ?? expediteur?.tab?.url ?? '';
  return expediteur?.id === browser.runtime.id && motifs.some((m) => m.includes(url));
}

export default defineBackground(() => {
  // Installation : la page de bienvenue s'ouvre toute seule (langue, micro, épingler l'icône).
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') browser.tabs.create({ url: browser.runtime.getURL(PAGE_BIENVENUE) });
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== PORT_MICRO) return;
    if (!expediteurAutorise(port.sender)) return port.disconnect();
    brancherPage(port);
  });

  browser.runtime.onMessage.addListener((message, expediteur, repondre) => {
    if (pourDestinataire<DepuisDocumentMicro>(message, 'service')) {
      void depuisDocumentMicro(message);
      return;
    }
    if ((message as DemandeAutorisation)?.type === 'kama:autoriser-micro') {
      browser.tabs.create({ url: browser.runtime.getURL(`${PAGE_BIENVENUE}#micro`) });
      return;
    }
    if (!demandeConnue(message)) return;
    if (!expediteurAutorise(expediteur)) {
      repondre({ ok: false, code: 'forbidden_sender', statut: 403 } satisfies ReponseBrute);
      return;
    }
    appelerServeur(message).then(repondre);
    return true; // réponse asynchrone
  });
});

/* ---------------------------------------------------------------------------------------- */
/* Appels au serveur                                                                        */
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
/* « Parler à Kama » : une seule conversation à la fois, la page qui parle à Kama.          */
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

/**
 * Avant d'ouvrir le micro, on demande au serveur s'il sait comprendre la voix dans cette langue :
 * sinon le micro n'est même pas sollicité. Rend `null` si tout va bien, sinon le code d'erreur.
 */
async function voixDisponible(langue: string): Promise<string | null> {
  const r = await appelerServeur({ type: 'kama:api', route: 'capabilities' });
  if (!r.ok) return 'serveur_absent';
  const langues = (r.donnees as { languages?: LangueServeur[] }).languages ?? [];
  return langues.find((l) => l.code === langue)?.asr ? null : 'asr_unavailable';
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
        const indisponible = await voixDisponible(m.langue);
        if (indisponible) return versPage({ type: 'resultat', resultat: { ok: false, code: indisponible } });
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

/** Le serveur renvoie seulement une intention (liste fermée) : le texte reconnu ne sort pas du serveur. */
async function comprendre(wavBase64: string, langue: string): Promise<ResultatIntention> {
  const r = await appelerServeur({ type: 'kama:api', route: 'intent', lang: langue, wavBase64 });
  if (!r.ok) return { ok: false, code: r.code };
  const corps = r.donnees as { intent?: unknown; confidence?: unknown };
  return { ok: true, intention: intentionConnue(corps.intent), confiance: Number(corps.confidence) || 0 };
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
