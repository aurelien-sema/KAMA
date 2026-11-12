/**
 * Document caché de Kama (« offscreen document ») : il ouvre le micro et enregistre la voix.
 *
 * Il appartient à l'extension : l'autorisation du micro est celle de Kama (donnée une fois sur la
 * page de bienvenue), et non celle du site visité. Un document caché ne peut pas afficher la
 * demande d'autorisation : si Kama n'a pas encore le droit, il répond `refuse` et la page
 * propose d'ouvrir la page de bienvenue.
 */
import { demarrerEnregistrement, type Enregistrement } from '@/lib/enregistreur';
import { enBase64, pourDestinataire, type DepuisDocumentMicro, type VersDocumentMicro } from '@/lib/messages';

let enregistrement: Enregistrement | null = null;

function versService(m: DepuisDocumentMicro) {
  browser.runtime.sendMessage(m).catch(() => {});
}

browser.runtime.onMessage.addListener((message, _expediteur, repondre) => {
  if (!pourDestinataire<VersDocumentMicro>(message, 'micro')) return;
  switch (message.type) {
    case 'demarrer':
      demarrer().then(repondre);
      return true;
    case 'arreter':
      enregistrement?.arreter();
      break;
    case 'annuler':
      enregistrement?.annuler();
      break;
  }
});

async function demarrer(): Promise<{ ok: true } | { ok: false; code: string }> {
  enregistrement?.annuler();
  try {
    enregistrement = await demarrerEnregistrement({
      onNiveau: (niveau) => versService({ cible: 'service', type: 'niveau', niveau }),
      onFin: (fin) => {
        enregistrement = null;
        if (fin.ok) versService({ cible: 'service', type: 'fin', ok: true, wav: enBase64(fin.wav), duree: fin.duree });
        else versService({ cible: 'service', type: 'fin', ok: false, raison: fin.raison });
      },
    });
    return { ok: true };
  } catch (code) {
    return { ok: false, code: String(code) };
  }
}
