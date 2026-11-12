/**
 * Service worker de Kama : le « backend interne » de l'extension (backend/ARCHITECTURE.md).
 *  - Ouvre la page de bienvenue à l'installation.
 *  - « Parler à Kama » : pilote le document caché qui écoute (`entrypoints/micro/`), relaie le
 *    niveau du son vers la page, puis envoie la voix au serveur de Kama. C'est la seule partie
 *    qui parle au serveur ; la page bancaire ne le contacte jamais et ne reçoit jamais la voix.
 */
import { VERSION_JURY } from '@/config/banques';
import { DELAI_SERVEUR_MS, SERVEUR_KAMA } from '@/config/serveur';
import { reglageIntentionSimulee } from '@/lib/reglages';
import {
  PORT_MICRO,
  depuisBase64,
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

export default defineBackground(() => {
  // Installation : la page de bienvenue s'ouvre toute seule (langue, micro, épingler l'icône).
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') browser.tabs.create({ url: browser.runtime.getURL(PAGE_BIENVENUE) });
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name === PORT_MICRO) brancherPage(port);
  });

  browser.runtime.onMessage.addListener((message) => {
    if (pourDestinataire<DepuisDocumentMicro>(message, 'service')) void depuisDocumentMicro(message);
    else if ((message as DemandeAutorisation)?.type === 'kama:autoriser-micro') {
      browser.tabs.create({ url: browser.runtime.getURL(`${PAGE_BIENVENUE}#micro`) });
    }
  });
});

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
  // Pour l'équipe seulement : l'intention choisie dans le catalogue, pour essayer les réponses.
  if (!SERVEUR_KAMA) {
    await new Promise((r) => setTimeout(r, 900));
    const choisie = VERSION_JURY ? null : await reglageIntentionSimulee.getValue();
    return choisie
      ? { ok: true, intention: choisie, confiance: 1, simulation: true }
      : { ok: true, intention: 'unknown', confiance: 0, simulation: true };
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
    return { ok: true, intention: intentionConnue(corps?.intent), confiance: Number(corps?.confidence) || 0, simulation: false };
  } catch {
    return { ok: false, code: 'reseau' };
  } finally {
    clearTimeout(minuterie);
  }
}
