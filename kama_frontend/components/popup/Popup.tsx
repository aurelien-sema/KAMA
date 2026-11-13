/**
 * Popup de Kama (clic sur l'icône Kama dans la barre du navigateur), 340 px de large.
 * Maquette Lovable « Popup », états :
 *  1. Premier lancement : aucune langue enregistrée → « Bienvenue ! Choisis ta langue ».
 *  2. Activé normal : Ma langue, Je préfère (Texte / Audio), Expliquer cette page.
 *  3. Liste des langues ouverte : elle s'ouvre PAR-DESSUS le reste (rien n'est poussé vers le bas).
 *  4. Désactivé : tout est grisé sauf l'interrupteur ; Kama n'ajoute plus rien dans les pages.
 *  5. Page non reconnue : Kama n'est pas présent sur l'onglet ouvert.
 * Titres de section en Krona One orange (décision d'Omar du 2026-11-12), à 22 px : grand texte, contraste
 * suffisant sur blanc. Pas d'emoji ; pas de lien « Paramètres » (aucun réglage supplémentaire n'est prévu).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, FileText, TriangleAlert, Type, Volume2 } from 'lucide-react';
import { ChoixLangue } from '@/components/kama/ChoixLangue';
import { KamaLogo, SpeakButton, TranslationBadge } from '@/components/kama/primitives';
import { LanguesAVenir } from '@/components/kama/LanguesAVenir';
import { LANGUES, trouverLangue, type IdLangue } from '@/config/langues';
import { LangueCourante, useLangueCourante } from '@/lib/langue-courante';
import { envoyerAOngletActif } from '@/lib/messages';
import { reglageActif, reglageLangue, reglageMode, useReglage } from '@/lib/reglages';
import { traduireKama, useTexte } from '@/lib/use-texte';

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

  const langue = trouverLangue(idLangue);
  return (
    <LangueCourante.Provider value={langue}>
      <main className="flex w-[340px] flex-col bg-kama-white text-kama-ink">
        <header className="flex items-center gap-2 border-b border-kama-ink/10 px-4 py-3">
          <KamaLogo taille={36} />
          <span className="font-display text-xl">Kama</span>
          {langue && <Interrupteur actif={actif} onChange={setActif} />}
        </header>

        <div className="p-4">
          {!langue ? (
            <ChoixLangue onChoisir={setIdLangue} onPasMaintenant={() => window.close()} />
          ) : !pageReconnue && actif ? (
            <PageInconnue />
          ) : (
            <Reglages
              actif={actif}
              idLangue={langue.id}
              onLangue={setIdLangue}
              mode={mode}
              onMode={setMode}
              onExpliquer={async () => {
                const ok = await envoyerAOngletActif({ type: 'kama:ouvrir', etat: 'expliquer' });
                if (ok) window.close();
              }}
            />
          )}
        </div>
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
      className="ml-auto flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent px-1 text-sm font-semibold text-kama-ink focus-visible:outline-2 focus-visible:outline-kama-ink"
    >
      {actif ? texteActif : texteInactif}
      <span className={`relative h-7 w-12 rounded-full transition-colors ${actif ? 'bg-kama-ink' : 'bg-bank-line'}`}>
        <span
          className={`absolute top-1 size-5 rounded-full bg-kama-white shadow transition-[left] ${actif ? 'left-6' : 'left-1'}`}
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
    <div role="alert" className="flex items-start gap-3 rounded-xl border-2 border-kama-error bg-kama-error-bg p-3">
      <TriangleAlert className="mt-0.5 size-6 shrink-0 text-kama-error" aria-hidden />
      <div className="flex-1 text-[15px] font-medium">
        <p className="m-0">{t1}</p>
        <p className="m-0 mt-1 text-sm font-normal">{t2}</p>
      </div>
      <SpeakButton texte={t1} label={ecouterMessage} />
    </div>
  );
}

/** Titre de section : Krona One, orange, 22 px. */
function Titre({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="m-0 mb-2 font-display text-[22px] font-normal leading-tight text-kama-orange">
      {children}
    </h2>
  );
}

type PropsReglages = {
  actif: boolean;
  idLangue: IdLangue;
  onLangue: (id: IdLangue) => void;
  mode: 'texte' | 'audio';
  onMode: (m: 'texte' | 'audio') => void;
  onExpliquer: () => void;
};

function Reglages({ actif, idLangue, onLangue, mode, onMode, onExpliquer }: PropsReglages) {
  const [listeOuverte, setListeOuverte] = useState(false);
  const langue = trouverLangue(idLangue)!;
  const texteTexte = useTexte('Texte');
  const texteAudio = useTexte('Audio');
  const texteExpliquer = useTexte('Expliquer cette page');
  const maLangue = useTexte('Ma langue');
  const jePrefere = useTexte('Je préfère');
  const ecouterPrefixe = useTexte('Écouter :');
  const selecteur = useRef<HTMLButtonElement>(null);
  const desactive = !actif;

  return (
    <div
      className={`flex flex-col gap-5 ${desactive ? 'pointer-events-none opacity-40 grayscale' : ''}`}
      aria-disabled={desactive}
      inert={desactive || undefined}
    >
      <section aria-labelledby="kama-titre-langue">
        <Titre id="kama-titre-langue">{maLangue}</Titre>
        <div className="relative">
          <button
            ref={selecteur}
            type="button"
            aria-expanded={listeOuverte}
            aria-controls="kama-liste-langues"
            onClick={() => setListeOuverte((o) => !o)}
            className="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-xl border-2 border-kama-ink bg-kama-white px-4 text-[17px] font-semibold text-kama-ink hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
          >
            {langue.nom}
            <ChevronDown className={`size-5 transition-transform ${listeOuverte ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {listeOuverte && (
            <ListeLangues
              actuelle={idLangue}
              selecteur={selecteur}
              onChoisir={(id) => {
                onLangue(id);
                setListeOuverte(false);
              }}
              onFermer={() => {
                setListeOuverte(false);
                selecteur.current?.focus();
              }}
            />
          )}
        </div>
        <div className="mt-2">
          <TranslationBadge />
        </div>
      </section>

      <section aria-labelledby="kama-titre-mode">
        <Titre id="kama-titre-mode">{jePrefere}</Titre>
        {/* Sélecteur à deux segments : le choix actif est plein (quasi-noir), l'autre reste clair. */}
        <div className="grid grid-cols-2 gap-1 rounded-full bg-bank-bg p-1" role="group" aria-labelledby="kama-titre-mode">
          {(['texte', 'audio'] as const).map((m) => {
            const Icone = m === 'texte' ? Type : Volume2;
            const choisi = mode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={choisi}
                onClick={() => onMode(m)}
                className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border-0 text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink ${
                  choisi ? 'bg-kama-ink text-kama-white shadow-sm' : 'bg-transparent text-kama-ink hover:bg-kama-white'
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
          className="flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-kama-orange px-3 text-[18px] font-bold text-kama-white shadow-sm hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kama-ink"
        >
          <FileText className="size-5 shrink-0" aria-hidden />
          {texteExpliquer}
        </button>
        <SpeakButton texte={texteExpliquer} label={`${ecouterPrefixe} ${texteExpliquer}`} />
      </div>
    </div>
  );
}

/**
 * Liste des langues, ouverte par-dessus le reste du popup. Si elle dépasse le bas du popup, celui-ci
 * s'agrandit vers le bas : les éléments au-dessus ne bougent pas.
 */
function ListeLangues({
  actuelle,
  selecteur,
  onChoisir,
  onFermer,
}: {
  actuelle: IdLangue;
  selecteur: React.RefObject<HTMLButtonElement | null>;
  onChoisir: (id: IdLangue) => void;
  onFermer: () => void;
}) {
  const liste = useRef<HTMLDivElement>(null);
  const langue = useLangueCourante();
  const choisir = useTexte('Choisir ma langue');
  const rienChanger = useTexte('Ne rien changer');
  const ecouterPrefixe = useTexte('Écouter :');

  // Le popup s'agrandit si la liste dépasse en bas (sinon elle serait coupée).
  useLayoutEffect(() => {
    const bas = liste.current?.getBoundingClientRect().bottom ?? 0;
    const avant = document.body.style.minHeight;
    document.body.style.minHeight = `${Math.ceil(bas + window.scrollY + 16)}px`;
    return () => {
      document.body.style.minHeight = avant;
    };
  }, []);

  // Clavier : focus sur la langue actuelle ; Échap ferme. Clic en dehors : ferme.
  useEffect(() => {
    liste.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (!liste.current?.contains(cible) && !selecteur.current?.contains(cible)) onFermer();
    };
    document.addEventListener('keydown', echap);
    document.addEventListener('pointerdown', dehors);
    return () => {
      document.removeEventListener('keydown', echap);
      document.removeEventListener('pointerdown', dehors);
    };
  }, [onFermer, selecteur]);

  return (
    <div
      ref={liste}
      id="kama-liste-langues"
      role="group"
      aria-label={choisir}
      className="animate-kama-appear absolute inset-x-0 top-full z-20 mt-1 flex flex-col gap-1 rounded-xl border border-kama-ink/15 bg-kama-white p-1.5 shadow-xl"
    >
      {LANGUES.map((l) => (
        <div key={l.id} className={`flex items-center gap-1 rounded-lg ${l.id === actuelle ? 'bg-kama-cream' : ''}`}>
          <button
            type="button"
            aria-current={l.id === actuelle}
            onClick={() => onChoisir(l.id)}
            className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent pl-3 text-left text-kama-ink hover:bg-kama-cream focus-visible:outline-2 focus-visible:outline-kama-ink"
          >
            <span className="w-4 shrink-0">{l.id === actuelle && <Check className="size-4" aria-hidden />}</span>
            <span className="flex flex-col">
              <span className="text-base font-semibold leading-tight">{l.nom}</span>
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
        className="hit-44 cursor-pointer rounded-lg border-0 bg-transparent px-3 text-left text-sm font-semibold text-kama-ink underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-kama-ink"
      >
        {rienChanger}
      </button>
    </div>
  );
}
