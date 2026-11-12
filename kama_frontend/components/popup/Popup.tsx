/**
 * Popup de Kama (clic sur l'icône Kama dans la barre du navigateur), 340 px de large.
 * Maquette Lovable « Popup », 5 états :
 *  1. Premier lancement : aucune langue enregistrée → « Bienvenue ! Choisis ta langue ».
 *  2. Activé normal : Ma langue, Je préfère (Texte / Audio), Expliquer cette page.
 *  3. Liste des langues ouverte : choisir une langue, ou « Ne rien changer ».
 *  4. Désactivé : tout est grisé sauf l'interrupteur ; Kama n'ajoute plus rien dans les pages.
 *  5. Page non reconnue : Kama n'est pas présent sur l'onglet ouvert.
 * Différences avec la maquette : pas d'emoji ; pas de lien « Paramètres » (aucun réglage
 * supplémentaire n'est prévu) ; la liste des langues s'ouvre dans le popup (et non par-dessus),
 * pour ne jamais être coupée par le bord du popup.
 */
import { VERSION_JURY } from '@/config/banques';
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, TriangleAlert, Type, Volume2 } from 'lucide-react';
import { ChoixLangue } from '@/components/kama/ChoixLangue';
import { KamaLogo, SpeakButton, TranslationBadge } from '@/components/kama/primitives';
import { LANGUES, trouverLangue, type IdLangue } from '@/config/langues';
import { LanguesAVenir } from '@/components/kama/LanguesAVenir';
import { LangueCourante, useLangueCourante } from '@/lib/langue-courante';
import { traduireKama, useTexte } from '@/lib/use-texte';
import { envoyerAOngletActif } from '@/lib/messages';
import { reglageActif, reglageLangue, reglageMode, useReglage } from '@/lib/reglages';

export function Popup() {
  const [idLangue, setIdLangue, langueChargee] = useReglage(reglageLangue);
  const [mode, setMode] = useReglage(reglageMode);
  const [actif, setActif] = useReglage(reglageActif);

  // Kama est-il présent sur l'onglet ouvert ? (null = vérification en cours)
  const [pageReconnue, setPageReconnue] = useState<boolean | null>(null);
  useEffect(() => {
    envoyerAOngletActif({ type: 'kama:ping' }).then(setPageReconnue);
  }, []);

  if (!langueChargee || pageReconnue === null) return <main className="h-24 w-[340px] bg-kama-white" />;

  return (
    <PopupVue
      idLangue={idLangue}
      onLangue={setIdLangue}
      mode={mode}
      onMode={setMode}
      actif={actif}
      onActif={setActif}
      pageReconnue={pageReconnue}
      onExpliquer={async () => {
        const ok = await envoyerAOngletActif({ type: 'kama:ouvrir', etat: 'expliquer' });
        if (ok) window.close();
      }}
      onPasMaintenant={() => window.close()}
      // Catalogue des états : outil de l'équipe, absent de la version livrée au jury.
      onCatalogue={VERSION_JURY ? undefined : () => browser.tabs.create({ url: (browser.runtime.getURL as (chemin: string) => string)('/catalogue.html') })}
    />
  );
}

type PropsVue = {
  idLangue: IdLangue | null;
  onLangue: (id: IdLangue) => void;
  mode: 'texte' | 'audio';
  onMode: (m: 'texte' | 'audio') => void;
  actif: boolean;
  onActif: (v: boolean) => void;
  pageReconnue: boolean;
  onExpliquer: () => void;
  onPasMaintenant: () => void;
  onCatalogue?: () => void;
  /** Pour le catalogue : afficher directement la liste des langues ouverte. */
  listeOuverte?: boolean;
};

/** Affichage du popup, sans accès au stockage : réutilisé tel quel par le catalogue des états. */
export function PopupVue(p: PropsVue) {
  const langue = trouverLangue(p.idLangue);
  const catalogue = traduireKama(langue?.code, 'Catalogue des états (développement)');
  return (
    <LangueCourante.Provider value={langue}>
      <main className="flex w-[340px] flex-col bg-kama-white p-4 text-kama-ink">
        <header className="flex items-center gap-2">
          <KamaLogo taille={32} />
          <span className="font-display text-lg">Kama</span>
          {langue && <Interrupteur actif={p.actif} onChange={p.onActif} />}
        </header>

        {!langue ? (
          <div className="mt-4">
            <ChoixLangue onChoisir={p.onLangue} onPasMaintenant={p.onPasMaintenant} />
          </div>
        ) : (
          <>
            <div className="mt-2">
              <TranslationBadge />
            </div>
            {!p.pageReconnue && p.actif ? (
              <PageInconnue />
            ) : (
              <Reglages
                actif={p.actif}
                idLangue={langue.id}
                onLangue={p.onLangue}
                mode={p.mode}
                onMode={p.onMode}
                pageReconnue={p.pageReconnue}
                onExpliquer={p.onExpliquer}
                listeOuverteInitiale={p.listeOuverte}
              />
            )}
          </>
        )}

        {/* Outil de développement, à retirer avant la remise au jury. */}
        {p.onCatalogue && (
          <button
            type="button"
            onClick={p.onCatalogue}
            className="mt-3 min-h-11 cursor-pointer self-start border-0 bg-transparent px-1 text-xs text-kama-muted underline underline-offset-4"
          >
            {catalogue}
          </button>
        )}
      </main>
    </LangueCourante.Provider>
  );
}

/* -------------------------------------------------------------------------------------- */

function Interrupteur({ actif, onChange }: { actif: boolean; onChange: (v: boolean) => void }) {
  const texteActif = useTexte('Activé');
  const texteInactif = useTexte('Désactivé');
  const etiquette = useTexte('Kama activé');
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={etiquette}
      onClick={() => onChange(!actif)}
      className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-1 text-sm font-medium text-kama-ink focus-visible:outline-2 focus-visible:outline-kama-ink"
    >
      {actif ? texteActif : texteInactif}
      <span className={`relative h-7 w-12 rounded-full ${actif ? 'bg-kama-ink' : 'bg-bank-line'}`}>
        <span
          className={`absolute top-1 size-5 rounded-full bg-kama-white transition-[left] ${actif ? 'left-6' : 'left-1'}`}
        />
      </span>
    </button>
  );
}

function PageInconnue() {
  const t1 = useTexte('Kama ne reconnaît pas cette page. Ouvre la page de ta banque.');
  const t2 = useTexte('Si elle est déjà ouverte, recharge-la.');
  const ecouterMessage = useTexte('Écouter le message');
  return (
    <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border-2 border-kama-error bg-kama-error-bg p-3">
      <TriangleAlert className="mt-0.5 size-6 shrink-0 text-kama-error" aria-hidden />
      <div className="flex-1 text-[15px] font-medium">
        <p className="m-0">{t1}</p>
        <p className="m-0 mt-1 text-sm font-normal">{t2}</p>
      </div>
      <SpeakButton texte="Kama ne reconnaît pas cette page. Ouvre la page de ta banque." label={ecouterMessage} />
    </div>
  );
}

type PropsReglages = {
  actif: boolean;
  idLangue: IdLangue;
  onLangue: (id: IdLangue) => void;
  mode: 'texte' | 'audio';
  onMode: (m: 'texte' | 'audio') => void;
  pageReconnue: boolean;
  onExpliquer: () => void;
  listeOuverteInitiale?: boolean;
};

function Reglages({
  actif,
  idLangue,
  onLangue,
  mode,
  onMode,
  pageReconnue,
  onExpliquer,
  listeOuverteInitiale = false,
}: PropsReglages) {
  const [listeOuverte, setListeOuverte] = useState(listeOuverteInitiale);
  const langue = trouverLangue(idLangue)!;
  const texteTexte = useTexte('Texte');
  const texteAudio = useTexte('Audio');
  const texteExpliquer = useTexte('Expliquer cette page');
  const maLangue = useTexte('Ma langue');
  const jePrefere = useTexte('Je préfère');
  const ecouterPrefixe = useTexte('Écouter :');
  const desactive = !actif;

  return (
    <div
      className={`mt-4 flex flex-col gap-4 ${desactive ? 'pointer-events-none opacity-40 grayscale' : ''}`}
      aria-disabled={desactive}
      inert={desactive || undefined}
    >
      <section>
        <p className="m-0 mb-1 text-sm font-bold">{maLangue}</p>
        <button
          type="button"
          aria-expanded={listeOuverte}
          aria-controls="kama-liste-langues"
          onClick={() => setListeOuverte((o) => !o)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg border-2 border-kama-ink bg-kama-white px-3 text-base font-medium text-kama-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
        >
          {langue.nom}
          <ChevronDown className={`size-5 transition-transform ${listeOuverte ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {listeOuverte && (
          <ListeLangues
            actuelle={idLangue}
            onChoisir={(id) => {
              onLangue(id);
              setListeOuverte(false);
            }}
            onFermer={() => setListeOuverte(false)}
          />
        )}
      </section>

      <section>
        <p className="m-0 mb-1 text-sm font-bold">{jePrefere}</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label={jePrefere}>
          {(['texte', 'audio'] as const).map((m) => {
            const Icone = m === 'texte' ? Type : Volume2;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => onMode(m)}
                className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 text-base font-bold text-kama-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink ${
                  mode === m ? 'border-kama-ink bg-kama-cream' : 'border-bank-line bg-kama-white'
                }`}
              >
                <Icone className="size-5" aria-hidden />
                {m === 'texte' ? texteTexte : texteAudio}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExpliquer}
          disabled={!pageReconnue}
          className="min-h-14 flex-1 cursor-pointer rounded-lg border-0 bg-kama-orange text-[18px] font-bold text-kama-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {texteExpliquer}
        </button>
        <SpeakButton texte="Expliquer cette page" label={`${ecouterPrefixe} ${texteExpliquer}`} />
      </div>
    </div>
  );
}

function ListeLangues({
  actuelle,
  onChoisir,
  onFermer,
}: {
  actuelle: IdLangue;
  onChoisir: (id: IdLangue) => void;
  onFermer: () => void;
}) {
  const liste = useRef<HTMLDivElement>(null);
  const langue = useLangueCourante();
  const choisir = useTexte('Choisir ma langue');
  const rienChanger = useTexte('Ne rien changer');
  const ecouterPrefixe = useTexte('Écouter :');

  // Clavier : focus sur la langue actuelle ; Échap ferme la liste.
  useEffect(() => {
    liste.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [onFermer]);

  return (
    <div
      ref={liste}
      id="kama-liste-langues"
      role="group"
      aria-label={choisir}
      className="animate-kama-appear mt-1 flex flex-col gap-1 rounded-lg border border-bank-line bg-kama-white p-1 shadow-lg"
    >
      {LANGUES.map((l) => (
        <div key={l.id} className={`flex items-center gap-1 rounded-md ${l.id === actuelle ? 'bg-kama-cream' : ''}`}>
          <button
            type="button"
            aria-current={l.id === actuelle}
            onClick={() => onChoisir(l.id)}
            className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent pl-3 text-left text-kama-ink focus-visible:outline-2 focus-visible:outline-kama-ink"
          >
            <span className="w-4 shrink-0">{l.id === actuelle && <Check className="size-4" aria-hidden />}</span>
            <span className="flex flex-col">
              <span className="text-base font-medium leading-tight">{l.nom}</span>
              <span className="text-xs leading-tight text-kama-ink/70">{traduireKama(langue?.code, l.region)}</span>
            </span>
          </button>
          <SpeakButton texte={l.nom} label={`${ecouterPrefixe} ${l.nom}`} />
        </div>
      ))}
      <LanguesAVenir compact />
      <button
        type="button"
        onClick={onFermer}
        className="hit-44 cursor-pointer rounded-md border-0 bg-transparent px-3 text-left text-sm font-semibold text-kama-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        {rienChanger}
      </button>
    </div>
  );
}
