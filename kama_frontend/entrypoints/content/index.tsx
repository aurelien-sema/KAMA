/**
 * Script injecté dans la page bancaire.
 * Tous les éléments de Kama vivent dans un Shadow DOM : le CSS de la banque
 * et celui de Kama ne se mélangent pas, et le contenu de la page n'est pas modifié.
 */
import '@/assets/kama.css';
import ReactDOM from 'react-dom/client';
import { SITES_KAMA } from '@/config/sites';
import { chargerPolices } from '@/components/polices';
import { KamaApp } from '@/components/KamaApp';

export default defineContentScript({
  matches: SITES_KAMA,
  cssInjectionMode: 'ui',

  async main(ctx) {
    chargerPolices();

    const ui = await createShadowRootUi(ctx, {
      name: 'kama-extension',
      position: 'inline',
      anchor: 'body',
      append: 'last',
      onMount(conteneur) {
        const racine = ReactDOM.createRoot(conteneur);
        racine.render(<KamaApp />);
        return racine;
      },
      onRemove(racine) {
        racine?.unmount();
      },
    });

    ui.mount();
  },
});
