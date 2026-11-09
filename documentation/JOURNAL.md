# Journal de documentation de KAMA

Ce fichier retrace ce qui a été implémenté dans le projet et la démarche suivie. Chaque modification, ajout, décision et détail de développement y est consigné au fil du travail : il servira de base au rapport final du hackathon.

## Format d'une entrée

```markdown
## AAAA-MM-JJ — Sujet

**Auteur :** Dimitri

### Ce qui a été implémenté

### Démarche utilisée

### Résultats et limites connues

### Composants tiers utilisés
```

La section « Composants tiers utilisés » liste chaque modèle, jeu de données ou service externe avec sa licence, car le règlement du SAFINUM Innovate Challenge impose de les déclarer.

## Entrées

## 2026-11-09 — Cadrage du projet et méthode de travail

**Auteur :** Dimitri

### Ce qui a été implémenté

Aucun code pour l'instant. Mise en place du cadre de travail :

- `documentation/CLARIFICATIONS.md` : description du projet, règles d'or, architecture proposée, priorités (P0, P1, P2) et critères de réussite.
- `documentation/JOURNAL.md` : ce journal, tenu à chaque étape.
- `CLAUDE.md` à la racine : court fichier qui importe `CLARIFICATIONS.md`. Claude Code ne lit automatiquement que le fichier nommé `CLAUDE.md` à la racine. Cet import garde le contexte du projet chargé à chaque session malgré le renommage.

### Démarche utilisée

**Outils**

- **Lovable** pour concevoir les interfaces : un catalogue des éléments et de leurs états, plus une démo cliquable. Le travail est réparti sur 4 projets Lovable, à cause des limites de crédits. Chaque projet couvre des interfaces différentes. Lovable est la référence visuelle.
- **Claude Code** (assistant de programmation, dans VS Code) pour écrire le code de l'extension, à partir de `CLARIFICATIONS.md` et des maquettes Lovable.

**Cycle de travail** (appliqué à chaque étape)

1. Choisir une petite étape testable dans la liste des priorités.
2. L'implémenter.
3. La vérifier dans le navigateur : charger l'extension non empaquetée et suivre les points de contrôle donnés.
4. La consigner dans ce journal.
5. La sauvegarder dans git (un commit par étape).

**Règles de décision**

- Toute décision non couverte par `CLARIFICATIONS.md` ou par les maquettes est posée en question à l'équipe avant d'être tranchée.
- En cas de contradiction entre `CLARIFICATIONS.md` et Lovable, l'équipe tranche.
- Les règles d'or (montants jamais générés par un modèle, aucun clic à la place de l'utilisateur, aucun texte en langue nationale inventé, accessibilité) priment sur toute autre considération.

**Répartition**

Dimitri est responsable du frontend. La priorité est de terminer le frontend sur PC (navigateur de bureau), fidèle aux maquettes Lovable.

### Résultats et limites connues

**Décisions prises**

- Ordre des navigateurs :
  1. **Chrome et Edge** d'abord (Manifest V3), car c'est ce que le jury installe.
  2. **Firefox** ensuite. Le code reste portable dès maintenant : il évite autant que possible les API propres à Chrome.
  3. **Safari** plus tard, à évaluer. Il exige de convertir l'extension en application macOS avec Xcode, ce qui est incompatible avec une installation depuis un zip.
- `CLAUDE.md` (racine) est exclu de git via `.gitignore`. C'est un fichier local à Claude Code. Le contexte partagé avec l'équipe reste `documentation/CLARIFICATIONS.md`.
- Dossier `kama_frontend/` créé pour le frontend. Les 3 versions du logo sont dans `kama icons/` : sans fond, fond orange, fond blanc.
- **Stratégie de test (option C)** : le site de test des organisateurs (https://safinum.cm/hackathon-test) est la cible principale. Une petite page fictive sert seulement aux cas impossibles à provoquer sur le vrai site.
- **Récupération des maquettes Lovable** : le code de chacun des 4 projets est exporté à la main dans `kama_frontend/reference/lovable-1` à `lovable-4`. La synchronisation GitHub n'est pas utilisée, car elle demanderait un compte GitHub par compte Lovable. Le dossier `reference/` est exclu de git : c'est une référence locale, non livrée au jury.
- Le support mobile vient après le PC.

**Décisions en attente**

- Utiliser ou non un outil de build : JavaScript simple, ou React avec Vite pour reprendre les composants Lovable.
- Domaine de la page de test des organisateurs, nécessaire pour limiter les permissions.
- Accès au code des 4 projets Lovable.

**Risques identifiés**

- Le micro (« Parler à Kama ») et la reconnaissance vocale en ewondo restent incertains.
- Repli prévu : des audios pré-enregistrés par un locuteur natif.

### Composants tiers utilisés

| Composant | Usage | Licence / conditions |
|---|---|---|
| Lovable | Conception des maquettes et de la démo cliquable | Service commercial, conditions d'utilisation de Lovable (licence du code généré à vérifier) |
| Claude Code (modèle Claude, Anthropic) | Assistant de programmation pour écrire le code | Service commercial, conditions d'utilisation d'Anthropic |

## 2026-11-09 — Choix techniques et squelette de l'extension

**Auteur :** Dimitri

### Ce qui a été implémenté

- **Inventaire des 4 projets Lovable** (`kama_frontend/reference/`). Seuls les noms de fichiers ont été listés, pour économiser les tokens. Les projets sont :
  - `kama-code-fenetre-kama`
  - `kama-code-page-bancaire`
  - `kama-code-popup`
  - `kama-code-selection-texte-onglet-icone`

  Les 4 utilisent la même pile : React 19, Tailwind CSS v4, shadcn/ui et TanStack Router.
- **Squelette de l'extension** dans `kama_frontend/` :
  - `config/sites.ts` : fichier unique des adresses où Kama s'active. On y trouve le site des organisateurs `safinum.cm/hackathon-test` et `localhost` pour la page fictive.
  - `entrypoints/content/` : script injecté dans la page. Il crée un Shadow DOM et y affiche l'**onglet de bord**.
  - `components/OngletDeBord.tsx` : onglet blanc en demi-pilule, collé au bord droit et centré verticalement, de 44×44 px. Il s'élargit à 96 px et affiche « Kama » au survol ou au focus clavier. Il a un `aria-label` et un contour visible au clavier.
  - `entrypoints/popup/` : popup de 340 px provisoire (logo + « Kama est installé »).
  - `entrypoints/background.ts` : service worker vide, prêt pour les étapes suivantes.
  - `assets/kama.css` : la charte (couleurs, polices, animation d'apparition) reprise de Lovable.
  - `components/polices.ts` : chargement des polices DM Sans et Krona One embarquées dans l'extension.
  - `public/icon/` : icônes de l'extension (16, 32, 48 et 128 px), générées depuis `kama icons/kama-nobgr.png`.
- `.gitignore` : ajout de `kama_frontend/node_modules/`, `.output/` et `.wxt/`. Ce sont des fichiers générés.

### Démarche utilisée

**Choix techniques**

- **WXT** (outil de construction d'extensions), **React**, **TypeScript** et **Tailwind CSS v4**.
  - React et Tailwind sont la pile des maquettes Lovable : on reprend leurs classes et leur structure presque telles quelles.
  - WXT génère le manifest, construit Chrome **et** Edge (`npm run build`, `npm run build:edge`), et sait produire une version Firefox. Il prépare ainsi l'étape Firefox décidée plus tôt.
- **Polices embarquées** dans l'extension, plutôt que chargées depuis Google Fonts. Kama fonctionne sans appel réseau externe, et l'installation n'a besoin d'aucune autorisation supplémentaire.
- **Polices chargées par l'API `FontFace`** et non par une balise `<style>`. Aucune balise n'est ajoutée au HTML de la banque (règle d'or n° 3).
- **Adaptation du CSS au Shadow DOM** (`scripts/postcss-shadow-dom.ts`), pour deux raisons :
  1. Les unités `rem` sont converties en `px`. Sinon, si la banque change la taille de police de sa page, toute l'interface de Kama change de taille.
  2. Les règles `@property` de Tailwind sont recopiées en valeurs ordinaires. Chrome les ignore dans un Shadow DOM, ce qui faisait disparaître les ombres et les contours.
- `:host { all: initial }` empêche les styles de la banque (police, couleur, interlignage) de se propager dans Kama.
- **Logo** : on utilise le vrai logo de l'équipe (mascotte K) plutôt que le rond « K » provisoire des maquettes Lovable.

**Méthode d'économie de tokens** : on lit les fichiers Lovable seulement au moment de coder l'interface concernée. On ne lit jamais `node_modules`, `components/ui/` ni les fichiers de configuration.

### Résultats et limites connues

- La compilation réussit pour Chrome (`.output/chrome-mv3`) et Edge (`.output/edge-mv3`). La vérification TypeScript ne signale aucune erreur.
- Il reste à vérifier en vrai dans Chrome que l'onglet s'affiche sur le site des organisateurs.
- Pas encore faits :
  - le menu de l'onglet (état 3) ;
  - le déplacement vertical (état 4) ;
  - les vrais réglages du popup.
- **Limite connue** : seul le jeu de caractères « latin » des polices est embarqué. Les lettres propres à l'ewondo (ɛ, ɔ, ə, ŋ, tons) s'afficheront avec une police de secours. À traiter quand les textes ewondo arriveront.
- Un avertissement PostCSS sans conséquence apparaît pendant la compilation (option `from`).

### Composants tiers utilisés

| Composant | Usage | Licence |
|---|---|---|
| WXT 0.21 | Construction de l'extension (Chrome, Edge, Firefox) | MIT |
| React 19 / React DOM | Interfaces | MIT |
| Tailwind CSS 4 (+ @tailwindcss/vite) | Styles | MIT |
| Vite | Compilation (utilisé par WXT) | MIT |
| TypeScript | Langage | Apache 2.0 |
| lucide-react | Icônes (installé, utilisé aux étapes suivantes) | ISC |
| DM Sans (via Fontsource) | Police du texte | SIL Open Font License 1.1 |
| Krona One (via Fontsource) | Police des titres et du nom « Kama » | SIL Open Font License 1.1 |
| Pillow (Python) | Redimensionnement du logo en icônes (outil ponctuel, non livré) | MIT-CMU (HPND) |

## 2026-11-09 — Menu de l'onglet, déplacement et fenêtre Kama

**Auteur :** Dimitri

### Ce qui a été implémenté

- **Onglet de bord complet** (`components/OngletDeBord.tsx`), avec les 4 états de la maquette Lovable :
  1. Repos.
  2. Survol / focus clavier.
  3. Ouvert : le clic ouvre ou ferme le menu.
  4. Déplacement vertical : appui maintenu et glisser de plus de 4 px. L'onglet reste à 16 px minimum des bords, avec un contour noir de 2 px pendant le déplacement. La position est mémorisée dans `chrome.storage.local` (`lib/position-onglet.ts`) et un déplacement n'ouvre pas le menu.
- **Menu à 3 boutons** (`components/MenuOnglet.tsx`) : 🎤 Parler à Kama · 📄 Expliquer cette page · 🧾 Résumer mes transactions.
  - Dimensions : 248 px de large, boutons de 56 px de haut minimum, texte 16 px en gras.
  - Chaque bouton a un bouton 🔊 qui lit son libellé.
  - Fermeture : Échap, clic en dehors ou nouveau clic sur l'onglet.
- **Fenêtre Kama unique** (`components/kama/fenetre/KamaWindow.tsx`) : 360×520 px, à gauche de l'onglet et alignée sur sa hauteur.
  - Elle a un en-tête (logo, « Kama », langue, bouton Fermer), une zone de contenu qui défile et un pied avec le micro (4 états : attente, écoute, réflexion, hors ligne).
  - Fermeture : bouton ✕ ou Échap quand le focus est dans Kama.
  - Elle se réduit si l'écran fait moins de 552 px de haut.
- **Briques du contenu** reprises de Lovable (`components/kama/fenetre/parts.tsx`) : badge de fiabilité (Vérifié / Traduction automatique / Pas encore traduit), montant, lecteur audio (▶, vitesse 1x / 0,75x), réponse, ligne de Kama, bulle de l'utilisateur, bouton secondaire.
- **Orchestration** (`components/KamaApp.tsx`) : un clic dans le menu ferme le menu et ouvre la fenêtre sur le mode choisi. Le contenu affiché est provisoire (« Contenu en préparation »).
- **Lecture vocale provisoire** (`lib/voix.ts`) : voix française du navigateur, comme dans Lovable. C'est le repli « Écouter en français ».

### Démarche utilisée

- **Fichiers Lovable lus** (et eux seulement) :
  - `EdgeTabPage.tsx` (états et dimensions de l'onglet et du menu) ;
  - `KamaWindow.tsx`, `parts.tsx` et `primitives.tsx` du projet « fenêtre Kama » ;
  - 3 réglages de style (`shadow-kama`, `hit-44`, couleurs des badges), trouvés par recherche ciblée dans `styles.css`.
- Les composants repris de Lovable gardent leur nom d'origine (`KamaWindow`, `KamaResponse`…) pour faciliter la comparaison avec la maquette. Les composants propres à l'extension ont des noms français.
- **Accessibilité** :
  - le focus va dans le menu à l'ouverture, puis dans la fenêtre, et revient sur l'onglet à la fermeture ;
  - les états sont annoncés (`aria-expanded`, `aria-pressed`) ;
  - les zones cliquables font au moins 44 px ;
  - les emojis sont masqués aux lecteurs d'écran ;
  - les animations jouent une seule fois et sont coupées si le système demande moins de mouvement.
- **Respect de la page bancaire** : Échap ne ferme Kama que si l'appui vient de Kama, pour ne pas gêner les raccourcis de la banque. Aucun événement de la page n'est bloqué.

### Résultats et limites connues

- La compilation Chrome et Edge réussit, sans erreur TypeScript. Reste à vérifier en vrai dans le navigateur.
- **Contenu de la fenêtre provisoire** : les 7 contenus de la maquette « Fenêtre Kama » sont la prochaine étape.
- **Micro** : le bouton est affiché mais ne fait encore rien. « Parler à Kama » est prévu en P1.
- **Lecteur audio** : la voix du navigateur ne donne pas sa progression, donc la barre reste vide. Elle fonctionnera avec les audios enregistrés.
- **Déplacement de l'onglet** : il se fait à la souris ou au doigt seulement, pas au clavier. Ce n'est pas indispensable, car l'onglet reste utilisable au clavier sans être déplacé.
- **Langue affichée** : « Ewondo » est écrit en dur. Elle sera reliée au réglage du popup.

### Composants tiers utilisés

| Composant | Usage | Licence |
|---|---|---|
| lucide-react | Icônes : micro, fermer, lecture, badges | ISC |
| Web Speech API (`speechSynthesis`) | Lecture vocale provisoire en français, avec les voix du navigateur et du système | API standard du navigateur, sans licence à déclarer (voix fournies par le système) |

## 2026-11-09 — Correctif : chargement refusé par Chrome

**Auteur :** Dimitri

### Ce qui a été implémenté

- Correction du manifest. Chrome refusait de charger l'extension avec l'erreur « Invalid value for 'web_accessible_resources[0]'. Invalid match pattern ».
- `config/sites.ts` : ajout de `ORIGINES_KAMA`, qui reprend les mêmes sites réduits à leur origine (`https://safinum.cm/*`). `wxt.config.ts` l'utilise pour `web_accessible_resources`.

### Démarche utilisée

Pour `web_accessible_resources`, Chrome exige des adresses dont le chemin est exactement `/*`. Or on y avait mis l'adresse précise de la page de test (`/hackathon-test*`). Le script de Kama, lui, reste limité à la page de test (`content_scripts`). Seuls les polices et le logo sont autorisés sur tout le domaine `safinum.cm`.

### Résultats et limites connues

- La compilation Chrome et Edge réussit et le manifest est vérifié. Le chargement dans Chrome reste à confirmer.
- **Leçon retenue** : la compilation par WXT ne vérifie pas la validité des adresses du manifest. Seul le chargement dans Chrome le fait, donc il faut toujours tester le chargement réel après une modification du manifest.

### Composants tiers utilisés

Aucun nouveau.

## 2026-11-09 — Premier test réel dans Chrome, icônes à la place des emojis

**Auteur :** Dimitri

### Ce qui a été implémenté

- **Test réel réussi** sur https://safinum.cm/hackathon-test :
  - popup ;
  - onglet de bord (affichage, survol) ;
  - menu à 3 boutons ;
  - ouverture de la fenêtre Kama ;
  - fermeture.
- **Emojis remplacés par des icônes professionnelles** (lucide-react), à la demande de l'équipe :
  - Parler à Kama : `Mic` (micro) ;
  - Expliquer cette page : `FileText` (document) ;
  - Résumer mes transactions : `ReceiptText` (reçu).

  Elles sont affichées dans le menu (`components/MenuOnglet.tsx`) et dans le titre de la fenêtre (`components/KamaApp.tsx`). Le bouton d'écoute utilisait déjà l'icône `Volume2` (haut-parleur).

### Démarche utilisée

- **Nouvelle règle de design** : aucune emoji dans l'interface, même là où les maquettes Lovable ou CLARIFICATIONS.md en montrent. Raisons :
  - les emojis s'affichent différemment selon l'ordinateur ;
  - une icône sobre est plus professionnelle.

  Les icônes sont décoratives (`aria-hidden`), et le libellé écrit reste toujours à côté.
- **Enquête sur la police DM Sans**, signalée comme absente :
  - le CSS généré demande bien DM Sans pour tout le texte ;
  - une page de test isolée, ouverte avec Chrome sans interface, confirme que DM Sans se charge et s'applique dans un Shadow DOM ;
  - le site de test n'a pas de politique de sécurité (CSP) qui bloquerait les polices.

  DM Sans et Krona One sont aussi installées sur l'ordinateur de développement, ce qui fausse le test visuel. L'enquête continue, avec une capture de l'équipe.

### Résultats et limites connues

- La compilation Chrome et Edge réussit, sans erreur TypeScript.
- **Point ouvert** : DM Sans est perçue comme absente. Cause trouvée et corrigée dans l'entrée suivante.
- Pour un test fiable des polices, il faudra vérifier sur un ordinateur où ces polices ne sont pas installées. C'est le cas des ordinateurs du jury.

### Composants tiers utilisés

Aucun nouveau. Les icônes viennent de lucide-react, déjà déclaré.

## 2026-11-09 — Correctif police DM Sans, icône « transactions », aucune balise ajoutée à la page

**Auteur :** Dimitri

### Ce qui a été implémenté

- **Police DM Sans corrigée.** Tout le texte de Kama s'affichait en Times New Roman, la police par défaut du navigateur. Seul « Kama » était en Krona One.
  - La typographie de base (police, couleur, taille 16 px, interlignage, chiffres tabulaires) est maintenant posée sur le premier élément de Kama, `.kama-racine`, et non plus sur `:host`.
  - Fichiers modifiés : `assets/kama.css` et `components/KamaApp.tsx`.
- **Icône « Résumer mes transactions »** : `ReceiptText` (reçu) est remplacée par `Banknote` (billet de banque). L'ancienne ressemblait trop à l'icône document de « Expliquer cette page ».
- **Plus aucune balise ajoutée à la page bancaire.** Les règles `@property` de Tailwind sont maintenant supprimées après recopie de leurs valeurs (`scripts/postcss-shadow-dom.ts`). Avant, WXT les sortait du Shadow DOM pour les mettre dans une balise `<style>` insérée dans la page de la banque.

### Démarche utilisée

1. Une capture de l'équipe montrait une police à empattements (Times New Roman). Ce n'était donc pas une police installée sur l'ordinateur qui prenait le relais, mais une police remise à zéro.
2. Lecture du code de WXT (`createShadowRootUi`) : WXT ajoute `:host { all: initial !important; }` pour couper l'héritage des styles de la banque. Ce `!important` écrasait notre police posée sur `:host`. Krona One n'était pas touchée, car elle est posée directement sur chaque élément « Kama ».
3. Deuxième constat en lisant ce code : WXT déplace les règles `@property` et `@font-face` dans une balise `<style>` ajoutée au `<head>` de la page. On les supprime pour respecter la règle d'or n° 3.
4. **Vérification** : reproduction exacte de la structure de WXT (hôte remis à zéro, CSS avec `:root` remplacé par `:host`, conteneur `div`) dans une page de test ouverte avec Chrome sans interface. Résultat : l'hôte reste en Times New Roman, mais les boutons et textes de Kama sont en « Kama DM Sans ».

**Leçon retenue** : un test isolé n'est fiable que s'il reproduit exactement la structure réelle. Le premier test, qui n'avait pas la remise à zéro de WXT, n'avait pas montré le problème.

### Résultats et limites connues

- La compilation Chrome et Edge réussit, sans erreur TypeScript. Le CSS final ne contient plus aucune règle `@property` ni `@font-face`.
- Reste à confirmer à l'œil dans Chrome sur le site de test.

### Composants tiers utilisés

Aucun nouveau.

## 2026-11-09 — Erreur « Extension context invalidated »

**Auteur :** Dimitri

### Ce qui a été implémenté

- `components/kama/primitives.tsx` : l'adresse du logo est maintenant calculée **une seule fois** au chargement du script (`URL_LOGO`), et non plus à chaque affichage du logo.

### Démarche utilisée

- Chrome affichait un bouton « Errors » sur la carte de l'extension, avec le message « Uncaught Error: Extension context invalidated », sur la page `safinum.cm/hackathon-test`.
- **Cause** : pendant le développement, on recharge l'extension (🔄) sans rafraîchir la page. L'ancien Kama reste affiché dans la page. Au survol ou au clic, il se réaffiche et appelle `browser.runtime.getURL` pour le logo, alors que cette ancienne version de l'extension n'existe plus.
- **Correction** : aucun appel à l'extension pendant l'affichage. Les seuls appels restants sont :
  - le chargement des polices, une fois au démarrage ;
  - la lecture et l'écriture de la position de l'onglet, déjà protégées contre les erreurs.

### Résultats et limites connues

- Cette erreur n'existe qu'en développement : le jury installe l'extension une fois et ne la recharge pas.
- **Bonne pratique de test** : après chaque 🔄 dans `chrome://extensions`, toujours rafraîchir la page du site (F5). Effacer les anciennes erreurs avec « Clear all » pour ne voir que celles de la version en cours.
- **DM Sans** est confirmée dans les éléments injectés dans la page. Pour le popup, le CSS est vérifié : il demande bien DM Sans. Une confirmation visuelle est en attente.
- La compilation Chrome et Edge réussit, sans erreur TypeScript.

### Composants tiers utilisés

Aucun nouveau.

## 2026-11-09 — Les 11 contenus de la fenêtre Kama et page catalogue

**Auteur :** Dimitri

### Ce qui a été implémenté

- **Les 11 contenus de la fenêtre** (`components/kama/fenetre/contents.tsx`), repris de la maquette Lovable :
  1. Parler — attente
  2. Parler — écoute
  3. Parler — réflexion
  4. Parler — réponse
  5. Expliquer cette page (phrase + étapes numérotées avec « Montre-moi »)
  6. Résumer mes transactions
  7. Pas de transactions ici (« Va sur la page Historique »)
  8. Explication d'un élément
  9. Erreur bancaire expliquée (message original + explication)
  10. Pas de connexion (+ Réessayer)
  11. Traduction indisponible (+ « Écouter en français »)
- **Gestion des états** (`components/kama/fenetre/etats.tsx`) : la liste des 11 états, le contenu à afficher pour chacun, et l'état du micro associé (écoute, réflexion, hors ligne).
- **Branchement dans la page** : le menu ouvre les bons états.
  - Parler à Kama : état 1.
  - Expliquer cette page : état 5.
  - Résumer mes transactions : état 6.

  Les autres états seront déclenchés plus tard par les pastilles, les erreurs de la page et le réseau.
- **Données d'exemple isolées** (`components/kama/fenetre/exemples.ts`) : ce sont les montants et textes fictifs de Lovable. Partout où ils sont utilisés, la fenêtre affiche un marqueur « Exemple : données fictives de la maquette, pas celles de cette page ».
- **Page catalogue** (`entrypoints/catalogue/`) : elle affiche les 11 états côte à côte avec les vrais composants, pour les comparer à Lovable. On l'ouvre depuis un bouton provisoire du popup.
- **Couleurs ajoutées** à la charte (`assets/kama.css`) : `kama-success` (entrées d'argent) et les gris neutres `bank-*` (rappel d'un message de la banque).

### Démarche utilisée

- **Fichier Lovable lu** : `contents.tsx` (261 lignes), plus une recherche ciblée de 5 couleurs dans `styles.css`.
- **Adaptations par rapport à Lovable** :
  - **Emojis remplacés par des icônes** : 👉 devient `Eye` (œil) pour « Montre-moi » et 🔊 devient `Volume2` (haut-parleur).
  - **Textes et montants passés en paramètres** au lieu d'être écrits dans les composants. Les vrais montants, lus dans la page, s'y brancheront sans toucher à l'affichage. Chaque montant passe par le composant `Amount` (gras, jamais coupé), et le texte lu à voix haute reprend la même chaîne, caractère pour caractère (règle d'or n° 1).
  - **Marqueur « Exemple »** pour qu'aucune donnée fictive ne puisse être prise pour une vraie donnée pendant une démonstration.

### Résultats et limites connues

- La compilation Chrome et Edge réussit, sans erreur TypeScript. Reste à vérifier à l'œil, dans la page et dans le catalogue.
- **Fonctions pas encore branchées** :
  - « Montre-moi » (défilement + surlignage) : prochaine étape, avec le fichier des sélecteurs de la page ;
  - « Réessayer » ;
  - le micro.
- **À retirer avant la remise au jury** : la page catalogue et son bouton dans le popup. Ce sont des outils de développement.
- Les badges « EWO – traduction à fournir » restent affichés tant que les textes ewondo validés ne sont pas fournis (règle d'or n° 4).

### Composants tiers utilisés

Aucun nouveau.
