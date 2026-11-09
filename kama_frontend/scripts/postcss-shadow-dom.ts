import type { AtRule, Plugin } from 'postcss';

/**
 * Adapte le CSS généré par Tailwind v4 pour qu'il fonctionne dans le Shadow DOM de Kama.
 *
 * 1. `rem` → `px` : dans un Shadow DOM, `rem` dépend de la taille de police choisie par la
 *    page bancaire. Si la banque change cette taille, toute l'interface de Kama changerait
 *    de taille. En pixels fixes, Kama garde exactement les dimensions des maquettes.
 * 2. `@property` : Chrome ignore ces règles dans un Shadow DOM, ce qui casse les ombres,
 *    contours et transformations de Tailwind. On recopie leurs valeurs initiales dans une
 *    règle ordinaire, puis on supprime les `@property` : sinon WXT les déplacerait dans une
 *    balise <style> ajoutée à la page bancaire (règle d'or n° 3).
 */
export function shadowDomCss(): Plugin {
  return {
    postcssPlugin: 'kama-shadow-dom',
    Once(root, { rule, atRule, decl }) {
      const initiales = rule({ selector: ':host, *, ::before, ::after, ::backdrop' });
      root.walkAtRules('property', (prop: AtRule) => {
        let valeur = 'initial';
        prop.walkDecls('initial-value', (d) => {
          valeur = d.value;
        });
        initiales.append(decl({ prop: prop.params.trim(), value: valeur }));
        prop.remove();
      });
      if (initiales.nodes.length) {
        root.prepend(atRule({ name: 'layer', params: 'properties' }).append(initiales));
      }
      root.walkDecls((d) => {
        if (d.value.includes('rem')) {
          d.value = d.value.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${parseFloat(n) * 16}px`);
        }
      });
    },
  };
}
shadowDomCss.postcss = true;
