# Journal de documentation de KAMA

Ce fichier raconte ce qui a été fait dans le projet, pourquoi, et comment ça marche. Chaque membre de l'équipe y consigne son travail au fil de l'eau : il servira de base au rapport final du hackathon.

**Règle d'écriture :** chaque entrée doit être comprise par n'importe quel membre de l'équipe, même sans connaissance technique. On n'écrit pas seulement ce qui a été fait : on explique à quoi ça sert, avec des mots simples et des exemples.

## Format d'une entrée

```markdown
## AAAA-MM-JJ — Sujet

**Auteur :** Prénom

### En bref

### Ce qui a été implémenté, expliqué simplement

### Démarche utilisée

### Résultats et limites connues

### Ce que l'équipe doit faire ensuite

### Composants tiers utilisés
```

La section « Composants tiers utilisés » est obligatoire : le règlement du SAFINUM Innovate Challenge impose de déclarer tout ce qu'on utilise et qui ne vient pas de nous.

## Entrées

## 2026-11-09 — Cadrage du projet et méthode de travail

**Auteur :** Omar

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

Omar est responsable du frontend (branche `omar`). La priorité est de terminer le frontend sur PC (navigateur de bureau), fidèle aux maquettes Lovable.

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

**Auteur :** Omar

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

**Auteur :** Omar

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

**Auteur :** Omar

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

**Auteur :** Omar

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

**Auteur :** Omar

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

**Auteur :** Omar

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

**Auteur :** Omar

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

## 2026-11-09 — Données, tests des modèles et serveur de Kama

**Auteur :** Dimitri

### En bref

Kama doit expliquer une page bancaire en Ghomala et en pidgin, sans jamais se tromper sur un montant. Aujourd'hui, nous avons fait trois choses :

1. rassembler les données dans ces deux langues ;
2. lancer des tests pour savoir quels modèles d'IA existants valent quelque chose ;
3. construire le serveur de Kama, c'est-à-dire la partie invisible qui travaille derrière l'extension.

Le serveur fonctionne. Il ne sait pas encore traduire de vraies phrases, car il attend les traductions validées par nos locuteurs.

**Décision importante :** nous travaillons sur le Ghomala d'abord, puis le pidgin. Le document UX et `CLARIFICATIONS.md` citent encore l'ewondo en premier : ils devront être alignés sur ce choix. Toutes nos données et tous nos tests portent sur le Ghomala et le pidgin.

### Les mots à connaître

| Mot | Ce que ça veut dire |
|---|---|
| Extension | Le petit programme ajouté au navigateur. C'est ce que l'utilisateur voit. |
| Frontend (front) | La partie visible : boutons, fenêtres, pastilles. |
| Backend (back) | La partie invisible, qui fait le travail en coulisses. |
| Serveur | Un ordinateur allumé en permanence sur internet, qui répond aux demandes de l'extension. |
| Modèle d'IA | Un programme entraîné sur des exemples, par exemple pour traduire. |
| Corpus | Une grande collection de textes ou d'enregistrements. |
| Masquer | Cacher les montants et les noms avant d'envoyer un texte. |
| Balise | L'étiquette qui remplace ce qui a été caché, par exemple `{x1}`. |
| VPS | Un serveur loué chez un hébergeur, payé au mois. |

### Ce qui a été implémenté, expliqué simplement

#### 1. Le serveur de Kama (dossier `backend/`)

**Une image pour comprendre.** L'extension est comme un guichetier assis à côté de la cliente : il voit tout sur l'écran. Le serveur est comme un traducteur dans un bureau éloigné. Le guichetier ne lui passe qu'une feuille où les montants et les noms ont été cachés. Le traducteur ne peut donc rien divulguer, puisqu'il n'a jamais vu ces informations.

**Exemple concret, étape par étape :**

| Étape | Qui agit | Ce qui se passe |
|---|---|---|
| 1 | La page de la banque | Affiche « Frais : 500 FCFA pour Paul Mbarga » |
| 2 | L'extension | Cache les informations : « Frais : `{x1}` pour `{x2}` » |
| 3 | Le serveur | Reçoit seulement cette phrase et renvoie sa traduction, avec `{x1}` et `{x2}` |
| 4 | L'extension | Remet « 500 FCFA » et « Paul Mbarga », exactement comme sur la page |

Les balises sont numérotées, car le Ghomala peut placer les mots dans un autre ordre que le français. Sans numéro, Kama pourrait mettre le nom à la place du montant.

**Le serveur sait faire trois choses :**

- **Traduire une phrase** que l'extension ne connaît pas encore.
- **Comprendre une commande vocale.** Si Mama demande « Combien j'ai sur mon compte ? », le serveur répond seulement « elle veut connaître son solde ». C'est l'extension qui lit ensuite le chiffre sur la page.
- **Lire une phrase à voix haute.** Le serveur prépare l'audio des mots. L'extension ajoute elle-même les audios des chiffres, pour que les nombres ne quittent jamais l'ordinateur.

**Comment le serveur décide de ce qu'il répond à une demande de traduction :**

| Ordre | Question posée | Résultat affiché à l'utilisateur |
|---|---|---|
| 1 | Cette phrase a-t-elle été validée par un locuteur ? | Badge « Vérifié » |
| 2 | Une phrase validée lui ressemble-t-elle presque mot pour mot, avec le même sens ? | Badge « Traduction automatique » |
| 3 | Parle-t-elle d'argent, d'une condition ou d'un danger ? | « Pas encore traduit » : on montre l'original |
| 4 | Sinon, un modèle d'IA peut essayer, puis on contrôle sa réponse | « Traduction automatique » ou « Pas encore traduit » |

Pourquoi autant de prudence ? Le règlement considère une erreur sur un montant ou un avertissement comme un défaut majeur. Il vaut mieux dire « pas encore traduit » que de se tromper.

Exemple du contrôle à l'étape 2 : « Les frais ne sont pas remboursables » et « Les frais sont remboursables » se ressemblent, mais disent le contraire. Le serveur le détecte et ne réutilise pas la traduction.

Pour l'instant, le modèle d'IA de l'étape 4 est **éteint**. Notre règle est de ne jamais inventer de texte en langue nationale. Nous le rallumerons seulement si un modèle réussit ses tests.

**Pourquoi le serveur ne garde rien.** Il n'a ni base de données ni comptes utilisateurs. Il répond, puis il oublie. S'il n'y a rien de stocké, il n'y a rien à voler.

**Les protections, en clair :**

| Protection | À quoi ça sert |
|---|---|
| Refus des textes non masqués | Si un montant arrive par erreur, le serveur le rejette |
| Pas de notes sur le contenu | Le serveur note seulement « une demande est arrivée », jamais son contenu |
| Vérification de l'expéditeur | Il filtre les demandes qui ne viennent pas de notre extension |
| Limite du nombre de demandes | Empêche quelqu'un de saturer le serveur |
| Limite de taille | Refuse les envois anormalement gros |

#### 2. Les phrases à traduire (dossier `content-data/`)

Nous avons préparé 64 phrases bancaires en français et en anglais : solde, frais, transfert, récapitulatif, erreurs, alertes de sécurité. **Les cases de traduction sont vides** : ce sont nos locuteurs qui doivent les remplir. Une traduction sans le nom de la personne qui l'a validée n'est jamais montrée.

Le même dossier contient les phrases que Kama doit reconnaître à l'oral, par exemple « mon solde » ou « répète ».

#### 3. Le mode d'emploi pour le front (dossier `backend/contracts/`)

C'est l'accord entre le front et le back. Il dit exactement quoi envoyer au serveur et ce qu'il répond, avec des exemples de phrases à masquer. Grâce à lui, les deux parties peuvent travailler séparément et s'assembler sans surprise.

#### 4. Les données et les tests (hors du dépôt, car trop volumineux)

- `datasets/` contient les textes et enregistrements collectés.
- `models/` contient les modèles d'IA téléchargés.
- `evaluation/` contient les tests qui les comparent.

### Démarche utilisée

1. **Regarder ce que contiennent vraiment les données.** Elles parlent surtout de religion et d'actualité, presque jamais de banque. Le mot « bénéficiaire » n'y apparaît par exemple pas dans le corpus Ghomala.
2. **Lire le règlement et les documents de l'équipe**, pour construire le serveur à partir de ce qui est réellement exigé.
3. **Préparer un test honnête.** Nous avons découvert que les 4 795 phrases de MAFAND se trouvent toutes dans un autre corpus, Bandjoun. Un modèle entraîné sur Bandjoun a donc déjà vu ces phrases : c'est comme donner le sujet à un élève avant l'examen. Nous utilisons donc SOREVA, un petit guide de conversation de 150 phrases que ces modèles n'ont presque jamais vues.
4. **Choisir 20 modèles à tester**, car tous les tester aurait pris trop de temps sur notre ordinateur. Nous avons gardé au moins un modèle par sens de traduction, puis ceux qui ont les meilleurs scores publiés.
5. **Tester ce qui compte pour le jury :** le montant est-il conservé ? Le nom aussi ? Le modèle invente-t-il un chiffre ? Répète-t-il n'importe quoi ?
6. **Vérifier le serveur avec 92 tests automatiques.** Un test automatique est un petit programme qui essaie une situation et vérifie le résultat, par exemple « si j'envoie un montant non caché, le serveur doit refuser ».

### Résultats et limites connues

**Ce qui marche**

- Les 92 tests du serveur réussissent.
- Lors d'un essai réel, le montant envoyé par erreur a été refusé et n'apparaît pas dans les notes du serveur.

**Ce qui n'est pas encore prêt**

- Les tests des modèles sont en cours : il n'y a pas encore de classement.
- Le premier essai, sur quelques phrases seulement, n'est pas bon : le modèle Flagship perd les montants et invente du contenu. C'est un signal, pas une conclusion.
- Tant que les 64 phrases ne sont pas traduites, le serveur répondra presque toujours « Pas encore traduit ».
- La reconnaissance vocale et la voix de synthèse ne sont pas branchées : nous attendons les résultats des tests.

**Risques à connaître**

- Si une personne prononce un montant au micro, sa voix passe par le serveur. Elle n'est ni gardée ni notée, mais il faut le dire clairement à l'utilisateur.
- Le masquage des noms n'est pas parfait. L'extension doit lui signaler les noms qu'elle connaît, comme celui du bénéficiaire.
- Avant de travailler avec une vraie banque, un juriste devra valider le projet au regard de la loi camerounaise n° 2024/017.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Locuteurs Ghomala et pidgin | Traduire et valider les 64 phrases, enregistrer les audios, nous dire comment on prononce les montants |
| Équipe front | Reproduire le masquage décrit dans `backend/contracts/` et fixer l'identifiant de l'extension (`key` dans `manifest.json`) |
| Équipe | Louer le VPS : Contabo Cloud VPS 6, en Union européenne (6 processeurs, 12 Go de mémoire, 100 Go de disque) |
| Représentant de l'équipe | Demander au comité si la page de test peut contacter un serveur extérieur |

### Composants tiers utilisés

Une licence indique ce qu'on a le droit de faire avec un composant. **« NC » veut dire « non commercial » :** autorisé pour le concours, mais à remplacer ou à négocier si Kama devient un produit payant.

**Logiciels du serveur**

| Composant | À quoi il sert | Licence |
|---|---|---|
| FastAPI, Pydantic | Construire le serveur et vérifier les demandes | MIT |
| Uvicorn | Faire tourner le serveur | BSD-3-Clause |
| CTranslate2 | Exécuter un modèle de traduction rapidement | MIT |
| SentencePiece | Découper le texte pour le modèle | Apache 2.0 |

**Service externe prévu :** VPS Contabo, pour héberger le serveur.

**Outil de test :** llama.cpp (MIT), hors dépôt, pour faire tourner les gros modèles sur un ordinateur ordinaire.

**Données**

| Ressource | Ce que c'est | Licence ou statut | Usage |
|---|---|---|---|
| MAFAND fr-bbj | Phrases français-Ghomala | CC BY-NC 4.0 | Test |
| french-ghomala-bandjoun | Phrases français-Ghomala | Apache 2.0 (indication Hugging Face) | Analyse |
| Bible parlée Ghomala | Audio et texte | CC BY 4.0 pour l'apport du projet ; les textes bibliques appartiennent aux éditeurs | Analyse |
| MT560 anglais-pidgin | Phrases anglais-pidgin | CC BY 4.0 (indication Hugging Face) | Test prévu |
| SOREVA | 150 phrases audio par langue | CC BY 4.0 | Test |
| Stop Arnaque 237 | Vrais messages bancaires | CC BY 4.0 | Inspiration des phrases de test |
| Common Voice Fulfulde | Enregistrements | CC0 | Collecté, non utilisé |
| Corpus oral Oxford du pidgin | Enregistrements | Droits à clarifier (les sources divergent) | Collecté, non utilisé |

**Modèles en cours de test**

| Modèle | Traduit | Licence indiquée |
|---|---|---|
| flagship-ai/cameroon-int8 | français ↔ Ghomala | CC BY-NC 4.0 |
| masakhane/m2m100_418M (6 variantes) | français ↔ Ghomala | AFL-3.0 |
| fotiecodes/Turaco-mt-fr-gh | français → Ghomala | MIT indiqué, mais construit sur NLLB (CC BY-NC) |
| stfotso/t5_tuned_french_ghomala | français → Ghomala | Apache 2.0 |
| stfotso/llama-3.2-tuned-french-ghomala-bandjoun-1B | français → Ghomala | Licence Llama 3.2 |
| stfotso/deepseek-R1-qween-french-ghomala-bandjoun-1.5B | français → Ghomala | MIT |
| DS4H-ICTU/linguo_mt_en_bbj et linguo_mt_bbj_en | anglais ↔ Ghomala | Apache 2.0 |
| DS4H-ICTU/english-ghomala-translation-model-encoderdecoder | anglais → Ghomala | Apache 2.0 |
| joseph-scripture/nllb-en-ghomala | anglais → Ghomala | Non indiquée |
| fotiecodes/Turaco-NLLB-mt-en-wes | anglais → pidgin | CC BY-NC 4.0 |
| fotiecodes/Turaco-E2B-it-mt-en-wes | anglais → pidgin | Apache 2.0 |
| fotiecodes/Turaco-gem-mt-en-wes | anglais → pidgin | Conditions Gemma |
| jamm55/autotrain-improved-pidgin-model-2837583189 | anglais → pidgin nigérian (pour comparer) | Non indiquée |

## 2026-11-09 — Contrôle de sécurité du serveur et premiers résultats des modèles

**Auteur :** Dimitri

### En bref

Nous avons fait relire le code du serveur pour y chercher des failles. **Aucune faille grave n'a été trouvée**, mais le contrôle a révélé une vraie erreur de sens et une promesse qui n'était pas tenue. Les deux sont corrigées.

Les premiers modèles d'IA testés sont très mauvais sur les phrases bancaires. Cela confirme notre choix : les phrases importantes doivent être traduites par des personnes, pas par une machine.

### Ce qui a été implémenté, expliqué simplement

#### 1. Le contrôle de sécurité

Un contrôle de sécurité, c'est comme demander à quelqu'un d'essayer d'ouvrir toutes les portes et les fenêtres d'une maison pour voir si l'une d'elles ferme mal.

**Ce qui a été vérifié, sans problème trouvé :**

- personne ne peut faire exécuter ses propres commandes au serveur ;
- on ne peut pas lui faire lire des fichiers interdits ;
- il ne contient aucun mot de passe ni clé secrète ;
- ses réponses ne recopient jamais le texte reçu.

#### 2. Les corrections

**Correction 1 : « minimum » pouvait recevoir la traduction de « maximum ».**

Le serveur réutilise une traduction validée quand une nouvelle phrase lui ressemble presque mot pour mot. Le problème :

| Phrase | Situation |
|---|---|
| « Le montant **minimum** d'un transfert est de `{x1}` » | Traduction validée par un locuteur |
| « Le montant **maximum** d'un transfert est de `{x1}` » | Nouvelle phrase, ressemblance de 91 % |

Le serveur aurait affiché la traduction de « minimum » pour une phrase qui dit « maximum ». Pour le jury, c'est un défaut majeur.

**La nouvelle règle :** le serveur regarde exactement quels mots changent entre les deux phrases. Seuls de petits mots sans importance ont le droit de changer, comme « cette » et « votre ». Si n'importe quel autre mot change, il ne réutilise pas la traduction et répond « Pas encore traduit ».

Nous n'avons pas fait une liste de mots contraires, car on en oublierait forcément. Le serveur refuse par défaut. La contrepartie : il répondra plus souvent « Pas encore traduit », ce qui est préférable à une erreur.

**Correction 2 : les notes du serveur pouvaient contenir du texte en cas de panne.**

Nous avions écrit que le serveur ne note jamais le contenu des demandes. Or, si le moteur de voix tombait en panne, le rapport d'erreur automatique pouvait citer ce que la personne venait de dire. Maintenant, le serveur note seulement le type de panne, jamais son détail.

**Correction 3 : une demande mal formée provoquait une erreur.** Elle est maintenant simplement refusée.

**Mise au point pour l'installation :** le serveur ne lit pas tout seul le fichier de réglages `.env`. Si on oublie de lui donner le réglage `KAMA_ENV=prod`, il démarre en mode développement, moins protégé. C'est maintenant expliqué dans `backend/README.md`.

#### 3. Les problèmes laissés de côté

Ces deux points ont été jugés peu risqués et ne sont pas corrigés pour l'instant :

- le contrôle reconnaît les chiffres 0 à 9, mais pas ceux d'autres écritures, comme l'arabe ;
- un lien collé directement à une balise échappe au masquage.

### Démarche utilisée

1. Relecture de tout le code du serveur, en cherchant comment un attaquant pourrait s'y prendre.
2. Reproduction de l'erreur « minimum/maximum » sur le vrai code, pour être sûrs qu'elle existait.
3. Correction, puis ajout de tests automatiques pour que l'erreur ne revienne pas.
4. Lancement des premiers modèles sur nos phrases de test.

### Résultats et limites connues

**Serveur :** 97 tests automatiques réussis.

**Modèles :** 4 modèles sur 20 ont commencé leur évaluation. Les autres sont encore en cours de test ou de téléchargement : ce n'est pas le classement final.

Le score de ressemblance (chrF) compare la traduction du modèle à la bonne réponse, sur 100. Plus il est haut, mieux c'est.

| Modèle | Sens | Score sur 100 | Phrases où le modèle tourne en boucle |
|---|---|---|---|
| Flagship compressé | Ghomala → français | 11,4 | 0,7 % |
| linguo | Ghomala → anglais | 8,4 | 5,3 % |
| Flagship compressé | français → Ghomala | 7,4 | 43,3 % |
| linguo | anglais → Ghomala | 6,3 | 8,7 % |

Aucun de ces 4 modèles n'a donné une seule réponse exacte sur les 150 phrases de SOREVA.

Sur les 64 phrases bancaires, testées pour l'instant avec 2 modèles :

| Ce qu'on vérifie | Résultat |
|---|---|
| Montants retrouvés dans la traduction | 0 % |
| Noms de personnes retrouvés | 0 % |
| Balises `{x1}` conservées par le modèle | 0 % |

Exemples réels :

- « Votre solde est de 25 000 FCFA. » donne une phrase sans aucun montant.
- « Jean Kamga » devient « Yohane Kamga » : le modèle, entraîné sur la Bible, remplace un prénom par sa forme biblique.

**Ce que ça veut dire :** même en cachant les montants derrière des balises, ces 2 modèles détruisent les balises. On ne peut donc pas leur confier une phrase contenant un montant. Notre serveur rejette ces réponses, et c'est bien ce qu'il doit faire. *(Correction : ce constat ne vaut que pour ces 2 modèles. D'autres conservent les balises, voir l'entrée suivante.)*

**Limite de ce résultat :** les références françaises et anglaises de SOREVA ont été rédigées à partir du pidgin et restent à relire. Seul un locuteur peut juger la qualité réelle du Ghomala.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Locuteurs Ghomala et pidgin | Traduire les 64 phrases : c'est la seule voie fiable pour les parcours bancaires |
| Équipe | Au déploiement, donner au serveur le réglage `KAMA_ENV=prod` |
| Back | Terminer l'évaluation des 20 modèles, puis choisir les méthodes pour le texte et la voix |

### Composants tiers utilisés

Aucun nouveau composant depuis l'entrée précédente.

## 2026-11-09 — Résultats de 13 modèles, coupure internet et évaluation dans le dépôt

**Auteur :** Dimitri

### En bref

Nous avons maintenant les notes de 13 modèles de traduction sur les 20 choisis. **Aucun n'est assez fiable pour traduire seul une phrase bancaire.** Le meilleur pour le Ghomala est Masakhane `rel_news_ft`, mais sa note reste faible. Cela confirme que les phrases importantes doivent être traduites par nos locuteurs.

Une coupure internet a stoppé une partie des téléchargements pendant trois heures. Tout a été relancé, et les travaux savent maintenant se relancer seuls.

Le banc de test est maintenant dans le dépôt, pour que toute l'équipe puisse le consulter.

### Ce qui a été implémenté, expliqué simplement

#### 1. Le banc de test dans le dépôt (dossier `evaluation/`)

Le banc de test, c'est l'examen que l'on fait passer aux modèles : les questions, la correction et les copies rendues.

| Dans le dépôt | Resté en dehors, et pourquoi |
|---|---|
| Les programmes de test et de notation | Les modèles : beaucoup trop lourds |
| Les 64 phrases bancaires | Les corpus complets : trop lourds |
| Les 150 phrases de SOREVA | Les extraits de la Bible : les textes appartiennent aux éditeurs |
| Les réponses des modèles à ces phrases, et le tableau des notes | Les extraits de MAFAND : leur licence limite la diffusion |

Les extraits laissés de côté se recréent avec le programme `build_testset.py`.

#### 2. La reprise automatique

Un petit programme, `supervise.py`, joue le rôle d'un gardien : toutes les minutes, il vérifie que les téléchargements et les tests tournent, et il relance ce qui s'est arrêté. En cas de coupure, le téléchargement attend simplement le retour d'internet.

#### 3. Un seul gros modèle à la fois

Notre ordinateur a peu de mémoire libre. Si deux gros modèles tournent en même temps, tout ralentit fortement. Nous avons donc ajouté un verrou : c'est comme une pièce avec une seule clé, un modèle ne peut entrer que si le précédent est sorti.

#### 4. La liste des 27 autres modèles

Nous n'en testons que 20 pour l'instant. Une page liste les 27 autres, avec leur lien, leur taille, leur licence et la commande pour les télécharger, afin qu'un autre membre de l'équipe puisse s'en occuper : <https://claude.ai/artifact/KhjBcvvdksmHz8yhDLjW7S>. Elle doit être partagée pour que les autres puissent l'ouvrir.

#### 5. Le renforcement du masquage (commit de eunicefelixtine)

- Le serveur reconnaît maintenant les chiffres de toutes les écritures, par exemple arabes. Cela règle un point laissé de côté lors du contrôle de sécurité.
- La lecture à voix haute refuse désormais les textes qui contiennent encore des données à masquer.
- Un fichier `README.md` présente le projet à la racine du dépôt.

Les 97 tests du serveur réussissent toujours avec ces changements.

**À savoir pour le front :** en JavaScript, l'écriture `\d` ne reconnaît que les chiffres 0 à 9. Pour reproduire le même masquage, il faut y utiliser `\p{Nd}` avec l'option `u`.

### Démarche utilisée

Chaque modèle a passé les mêmes épreuves :

1. **Traduire des phrases de la vie courante** (SOREVA), qu'il n'a presque jamais vues.
2. **Traduire 64 phrases bancaires**, pour voir s'il garde les montants et les noms.
3. **Traduire les mêmes phrases avec les montants cachés** derrière des balises, pour voir s'il les conserve.
4. **Traduire des phrases de MAFAND ou de la Bible**, pour comparer avec les scores publiés.

### Résultats et limites connues

**Comment lire le tableau :** la note compare la traduction à la bonne réponse, sur 100. Plus elle est haute, mieux c'est. Un tiret veut dire que l'épreuve ne concerne pas ce modèle.

| Modèle | Traduit | Note SOREVA | Note MAFAND | Montants gardés | Balises gardées |
|---|---|---|---|---|---|
| **Masakhane rel_news_ft** | français → Ghomala | **18,4** | **23,2** | 90,6 % | 100 % |
| Masakhane news | français → Ghomala | 13,3 | 22,1 | 93,8 % | 96,6 % |
| Flagship compressé | français → Ghomala | 7,4 | 11,7 | 0 % | 0 % |
| Turaco | français → Ghomala | 4,6 | 14,3 | 78,1 % | 96,6 % |
| Masakhane rel_ft | français → Ghomala | 3,0 | 9,0 | 100 % (recopie 34 %) | 93,1 % |
| stfotso T5 | français → Ghomala | 1,7 | 7,5 | 100 % (recopie 56 %) | 93,1 % |
| linguo | anglais → Ghomala | 6,3 | – | 0 % | 0 % |
| joseph | anglais → Ghomala | 5,9 | – | 62,5 % | 86,2 % |
| DS4H | anglais → Ghomala | 4,2 | – | 0 % | 0 % |
| Flagship compressé | Ghomala → français | 11,4 | 16,2 | – | – |
| linguo | Ghomala → anglais | 8,4 | – | – | – |
| jamm55 (pidgin nigérian) | anglais → pidgin | 37,0 | – | 75 % | 72,4 % |
| Turaco NLLB | anglais → pidgin | 30,2 | – | 100 % (recopie 52 %) | 100 % |

**Ce que ça nous apprend :**

- **Garder un montant ne veut pas dire traduire.** Un modèle qui recopie la phrase française garde forcément le montant. C'est pour ça que le tableau indique aussi les recopies.
- **Les balises fonctionnent avec certains modèles.** Masakhane et Turaco les conservent presque toujours. Nous pouvons donc cacher les montants, mais la phrase autour peut quand même être fausse.
- **Un bon score sur la Bible ne prouve rien pour la banque.** Le modèle joseph obtient 36,8 sur 100 sur des versets de la Bible, mais 5,9 sur des phrases de la vie courante.
- **Le pidgin paraît plus facile**, car il ressemble à l'anglais. Les nombres et beaucoup de mots simples sont identiques, ce qui gonfle les notes. Sur les vraies phrases, seuls 3 à 4 % des réponses sont exactes.

**Turaco E2B, premier résultat partiel :** sur les 64 phrases bancaires, il garde 43,8 % des montants. Il répond parfois comme un assistant au lieu de traduire. Par exemple, « Your balance is 25,000 FCFA » devient « I go understand. I go translate everything… ».

**Ce qui nous a retardés.** Vers 12 h 45, une coupure internet a fait échouer 7 téléchargements. La surveillance mise en place s'était arrêtée à 12 h 44, et rien n'a pu réagir avant 15 h 38. Les tests des modèles déjà téléchargés ont continué normalement. C'est pour éviter que cela se reproduise que la reprise automatique a été ajoutée.

**Ce qui reste à faire dans cette campagne :** 7 modèles sur 20, soit 3 modèles Masakhane Ghomala → français et 4 modèles de langue compressés.

**Limite :** les références françaises et anglaises de SOREVA ont été rédigées à partir du pidgin et restent à relire. Seul un locuteur peut juger la qualité réelle du Ghomala.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Locuteurs Ghomala et pidgin | Traduire et valider les 64 phrases : c'est la voie fiable pour les parcours bancaires |
| Locuteurs Ghomala et pidgin | Relire les réponses du meilleur modèle, dans `evaluation/results/`, pour juger leur sens réel |
| Membre de l'équipe désigné | Télécharger les 27 autres modèles si nous décidons de les tester |
| Équipe front | Masquer les chiffres de toutes les écritures, comme le serveur |
| Back | Finir les 7 derniers tests, puis proposer les méthodes pour le texte et la voix |
| Back | Si la traduction automatique est activée un jour, remplacer Flagship par Masakhane `rel_news_ft` dans `backend/config/routes.json` |

### Composants tiers utilisés

Nouveau composant : **huggingface_hub** (Apache 2.0), l'outil qui télécharge les modèles. Les modèles et données testés sont ceux déjà listés plus haut.

## 2026-11-09 — Page officielle de test, répartition du travail et branche `dimitri`

**Auteur :** Dimitri

### En bref

Nous savons maintenant sur quelle page le jury testera Kama. Le travail est réparti : **Dimitri s'occupe du pidgin, un collaborateur s'occupe du Ghomala.** Pour travailler ensemble, nous avons créé la branche `dimitri` et ajouté au dépôt les données et les modèles utiles.

### Ce qui a été implémenté, expliqué simplement

#### 1. La branche `dimitri`

Une branche est une copie de travail du projet. On peut y avancer sans déranger la version principale (`main`), puis réunir les deux quand c'est prêt.

#### 2. Les données dans le dépôt (dossier `datasets/`)

| Données | Sur GitHub ? | Pourquoi |
|---|---|---|
| Phrases français-Ghomala (Bandjoun, MAFAND) | Oui | Petites, et leur licence permet de les partager |
| Phrases anglais-pidgin (MT560) | Oui | Petites, et leur licence permet de les partager |
| SOREVA (transcriptions) | Oui | Petites, et leur licence permet de les partager |
| Bible parlée en Ghomala | Non | Le dépôt est public et les textes bibliques appartiennent aux éditeurs |
| Corpus oral d'Oxford en pidgin | Non | 2,4 Go, et les droits restent à clarifier |

Les données qui ne sont pas sur GitHub restent sur le poste de Dimitri.

#### 3. Les modèles dans le dépôt (dossier `models/`)

Une copie des meilleurs modèles est dans ce dossier, mais seulement sur le poste de Dimitri. GitHub refuse les fichiers de plus de 100 Mo, et ces modèles pèsent jusqu'à 2,3 Go.

Pour que le collaborateur ait exactement les mêmes modèles, une seule commande suffit :

```bash
python models/fetch_models.py ghomala
```

#### 4. La page officielle de test

Il s'agit de <https://safinum.cm/hackathon-test>. Son protocole officiel est plus précis que le règlement PDF :

| Règle du protocole | Ce que ça change pour nous |
|---|---|
| L'extension ne doit pas collecter, stocker ou transmettre les données affichées | Tous les textes connus doivent être embarqués dans l'extension |
| Les données saisies par l'utilisateur ne sont jamais traduites | Kama ignore les champs remplis, les noms et les numéros |
| Aucun repère technique n'est fourni dans la page | Kama reconnaît les éléments à partir de leur texte |
| Le jury peut ajouter du texte après le chargement | Kama doit le détecter sans recharger la page |

**Le barème du protocole, sur 100 points :**

| Critère | Points |
|---|---|
| Fonctionnement du prototype | 25 |
| Fidélité des traductions | 20 |
| Sécurité et intégrité financière | 20 |
| Intégration aux services existants | 15 |
| Accessibilité et expérience utilisateur | 10 |
| Innovation et pertinence | 10 |

La qualité linguistique est vérifiée à part. Une erreur sur envoyer/confirmer/annuler, un montant changé, une alerte affaiblie ou un nom traduit compte comme défaut majeur.

Le code public de la page contient aussi les libellés d'un panneau réservé au jury. Nous ne l'utilisons pas.

### Démarche utilisée

Nous avons décidé de :

1. Travailler sur trois volets pour le pidgin : texte vers texte, puis texte vers voix, puis voix vers texte.
2. Ne plus construire de traduction directe voix vers voix : elle se fera naturellement en enchaînant la voix vers texte, puis le texte vers voix.
3. Commencer par rassembler tous les textes de la page de test, avec des règles fixes qui disent quel texte afficher et à quel endroit.
4. Préparer ensuite des modèles capables de résister à du contenu inédit.

Pour le chatbot « Parler à Kama », un LLM peut comprendre la question et choisir la bonne réponse. Il ne rédige pas la réponse et ne voit jamais les montants : c'est l'extension qui les lit sur la page.

### Résultats et limites connues

**Une erreur de réglage corrigée.** Le modèle Masakhane `rel_ft` français → Ghomala avait une note de 3,0 sur 100 et recopiait souvent le français. Sa configuration lui demandait en réalité de répondre en français. Sa note précédente ne valait donc rien : le test est relancé avec le bon réglage.

**Turaco E2B, test terminé :** 28,7 sur 100 sur les phrases de la vie courante, 43,8 % des montants conservés, 44,8 % des balises conservées. Il répond parfois comme un assistant au lieu de traduire.

**Un nouvel arrêt des travaux.** Le redémarrage de la session a coupé les téléchargements et les tests. Le gardien automatique a aussi planté, car l'ordinateur était trop chargé pour répondre à temps. Il est corrigé et relancé.

**Ce qui reste à faire :**

- le catalogue des textes de la page de test, en cours ;
- la fin des tests : 2 modèles restent à télécharger (Llama 1B et DeepSeek) ;
- la question au comité sur l'envoi de texte masqué et de la voix vers un serveur.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Dimitri | Pidgin : texte, puis voix |
| Collaborateur Ghomala | Récupérer la branche `dimitri`, lancer `python models/fetch_models.py ghomala` |
| Représentant de l'équipe | Demander au comité si l'envoi de texte masqué et de la voix est permis, et si Kama peut expliquer dans sa propre fenêtre |

### Composants tiers utilisés

Nouveau composant : **Playwright** (Apache 2.0), hors dépôt, pour parcourir la page de test comme un navigateur.

## 2026-11-11 — Pidgin : textes de la page, entraînement du modèle, dictionnaire et premiers pas vers la voix

**Auteur :** Dimitri

### En bref

Nous avons travaillé uniquement sur le pidgin, sur deux jours (10 et 11 novembre). Kama connaît maintenant tous les textes de la page de test. Nous avons un modèle de traduction pidgin ajusté par nos soins, un dictionnaire pidgin appuyé sur de vrais textes, et une première voix de synthèse en pidgin à écouter. **Rien n'est encore affiché aux utilisateurs :** les traductions pidgin restent coupées tant que des locuteurs natifs ne les ont pas validées.

### Les mots à connaître

| Mot | Ce que ça veut dire |
|---|---|
| Brouillon | Une traduction écrite par nous ou par une machine, pas encore vérifiée par un natif. Kama ne l'affiche jamais comme « Vérifié ». |
| Ajuster un modèle | Reprendre un modèle qui sait déjà traduire et lui faire réviser nos propres exemples, pour qu'il s'adapte à notre sujet (la banque) et à notre langue (le pidgin camerounais). |
| Colab | Un service gratuit de Google qui prête une carte graphique (GPU) pour entraîner un modèle. Nos données y sont lues depuis Google Drive. |
| chrF | Une note de 0 à 100 qui compare la traduction du modèle à une traduction humaine, lettre par lettre. Plus c'est haut, mieux c'est. |
| Synthèse vocale (TTS) | Transformer un texte en voix. |
| Attesté | Un mot qu'on a vraiment trouvé dans des textes écrits par des locuteurs, avec le même sens. |

### Ce qui a été implémenté, expliqué simplement

#### 1. Tous les textes de la page de test, avec des règles fixes

Le fichier `content-data/safinum_test_page.json` contient les **70 textes** de la page de test (boutons, titres, alertes, messages d'erreur) en français et en anglais, avec un brouillon en pidgin. Il contient aussi **3 modèles de phrase** pour les textes qui changent, par exemple « Bonjour, {nom} ».

Les montants et les noms sont remplacés par des cases `{x1}`, `{x2}` : le pidgin ne les touche jamais. Si un brouillon change un nombre (par exemple 500 devient 5 000), il est refusé au chargement.

#### 2. Un fichier Word pour les locuteurs natifs

`Validation_pidgin_page_test.docx`, à la racine du projet, liste les 73 expressions de la page. À côté de chacune, une case vide attend la traduction en pidgin. C'est ce fichier qu'on envoie aux natifs.

#### 3. Simplifier le jargon bancaire avant de traduire

Un mot comme « bénéficiaire » n'a pas d'équivalent en pidgin. Avant de traduire, Kama le remplace par une expression simple : « la personne qui reçoit l'argent ». Le fichier `content-data/jargon_simplification.json` contient 28 termes de ce type.

#### 4. Le chemin de traduction vers le pidgin

Français → anglais (modèle Helsinki opus-mt) → simplification du jargon → pidgin (notre modèle). Chaque phrase passe ensuite des contrôles. La traduction est refusée si :

- un montant ou un nom a disparu ou changé ;
- le modèle a inventé un chiffre ;
- il répète en boucle ;
- il recopie l'anglais ;
- plus d'un mot sur quatre est inconnu du lexique pidgin (`content-data/lexique_pidgin.txt`, 7 235 mots réels).

#### 5. Ajuster le modèle pidgin sur Colab

Le dossier `training/pidgin/` contient tout le nécessaire :

| Fichier | Rôle |
|---|---|
| `01_nettoyer_donnees.py` | Nettoie et assemble les données d'entraînement |
| `02_entrainer.py` | Ajuste le modèle (lancé sur Colab) |
| `entrainement_colab.ipynb` | Le cahier Colab à ouvrir depuis Google Drive |
| `exporter_drive.py` | Fabrique `KAMA_pidgin_drive.zip`, à déposer tel quel dans Google Drive |
| `03_tester_inedit.py` | Teste le modèle sur 60 messages qu'il n'a jamais vus |

Les données de la **version 2** sont dans `datasets/pidgin/kama_pidgin_v2/` :

- 16 517 phrases du corpus MT560, nettoyées. Nous avons retiré les doublons, les paires mal alignées, les phrases dont les nombres diffèrent entre l'anglais et le pidgin, et une grande partie des phrases religieuses.
- 862 phrases qui apprennent au modèle à recopier les cases `{x1}`.
- Les 112 phrases bancaires de la page, répétées 8 fois pour peser davantage. Elles compteront 20 fois une fois validées par les natifs.

Le modèle ajusté est converti dans un format rapide sur processeur (CTranslate2) et rangé dans `models/poids/ct2/`. Ce dossier n'est pas envoyé sur GitHub.

#### 6. Un dictionnaire pidgin appuyé sur de vrais textes

Le fichier `content-data/dictionnaire_pidgin.json` donne, pour **61 termes** de l'interface, la forme pidgin trouvée dans des textes réels. Pour chaque terme, il indique combien de fois elle apparaît et dans quelle source :

- le corpus MT560, 28 000 phrases ;
- le manuel Peace Corps de 1983 sur le pidgin camerounais ;
- SOREVA, des phrases de la vie courante.

Le script `training/pidgin/07_attester_termes.py` refait cette recherche automatiquement.

Ce que le dictionnaire nous a appris :

| On écrivait | Les textes réels disent | Nombre d'attestations |
|---|---|---|
| Make you careful | **Lukot** | 312 |
| Always | **All time** | 68 (always : 8) |
| Person weh e go receive | **Person weh go get di money** | 32 (receive n'est presque jamais employé) |
| E don work | **E don waka fine** | 88 |
| informations | **information** (toujours au singulier) | 9 |

**6 mots n'ont été trouvés nulle part avec le bon sens :** charge (frais), free (gratuit), salary, close (fermer une fenêtre), validate et reference. Ce sont les premiers à faire confirmer par les natifs. Le dictionnaire propose aussi 18 phrases corrigées. Elles ne sont pas encore reportées dans le catalogue ni dans le fichier Word.

#### 7. Première voix en pidgin

Le modèle **MMS-TTS pcm** de Meta, une voix de pidgin nigérian, est téléchargé dans `models/poids/tts/mms-tts-pcm`. Il a lu les 73 phrases de la page. On peut les écouter dans `evaluation/tts_ecoute/index.html` et les noter dans `notes.csv`.

Dans KAMA, la voix ne lira jamais les montants : un bip les remplace ici. Plus tard, ce seront des enregistrements humains joués directement par l'extension.

### Démarche utilisée

1. Rassembler d'abord tous les textes de la page de test, avec des règles fixes. Le modèle ne sert qu'aux textes imprévus.
2. Ajuster le modèle jamm55 (pidgin nigérian) vers le pidgin camerounais avec nos données, sur Colab.
3. Mesurer chaque version sur les mêmes 60 messages inédits, pour comparer honnêtement.
4. Chercher dans de vrais textes comment le pidgin dit chaque mot, au lieu d'inventer.
5. Pour la voix : écouter d'abord un modèle existant, avant d'enregistrer une voix camerounaise.

### Résultats et limites connues

**Traduction pidgin, test sur 60 messages jamais vus :**

| Modèle | Sans problème | Montants perdus | Cases cassées | Répétitions |
|---|---|---|---|---|
| jamm55, d'origine | 18 | 3 | 4 | 3 |
| Notre version 1, ajustée | **39** | **0** | **0** | **0** |

La version 1 ne casse plus les montants, mais elle fait encore des **contresens graves**. Par exemple, « Présentez ce code à l'agent » est devenu une phrase qui parle d'envoyer de l'argent. **Les routes pidgin restent donc coupées.**

**Traduction français ↔ anglais :** notes de 72,8 à 81 sur 100, sans aucun montant perdu. C'est une bonne base pour le passage par l'anglais.

**Un incident sur Colab.** Le deuxième entraînement a réutilisé sans le dire les anciennes données et l'ancien modèle. Deux causes :

- le cahier ne décompressait pas le nouveau zip quand d'anciennes données existaient déjà ;
- l'entraînement reprenait automatiquement le dernier point sauvegardé.

Nous l'avons vu à trois indices : 19 849 exemples au lieu de 18 275, 4 minutes d'entraînement au lieu de 30, et l'absence du test SOREVA. La version 2 tourne maintenant dans un dossier neuf (`KAMA/pidgin_v3` sur Drive), avec une vérification qui bloque si ce ne sont pas les bonnes données ou si un ancien modèle est présent.

**Voix MMS :**

- **Voix :** l'accent est nigérian, sans ajustement.
- **Vitesse :** 181 secondes d'audio produites en 395 secondes. La mesure a été faite pendant que l'ordinateur compressait un autre modèle : elle sera refaite.
- **Licence :** non commerciale (CC-BY-NC 4.0), à déclarer au jury.

**Données vocales en pidgin camerounais :**

- Environ 11 heures sont utilisables, surtout dans Common Voice (18 voix). Il faut demander l'accès sur le site de Mozilla.
- Le corpus d'Oxford n'a pas de transcription.
- Pour une voix de synthèse de qualité, il faudra enregistrer 1 à 2 heures d'**un seul** locuteur camerounais.

**Tests des modèles restants, en pause à la demande de Dimitri :**

- Turaco Gem (anglais → pidgin, 4 milliards de paramètres) : la compression était à mi-chemin.
- Llama 1B et DeepSeek 1,5B (français → Ghomala) : pas encore testés.
- Versions non compressées de flagship : pas encore testées.

Relancer `evaluation/run_gguf.py` et `evaluation/run_nmt.py` reprend là où ça s'est arrêté. Seule la compression de Turaco Gem repart de zéro.
## 2026-11-11 — Branche `omar`, choix des langues et mise à jour de CLARIFICATIONS.md

**Auteur :** Omar

### En bref

Le travail frontend est maintenant sur sa propre branche, `omar`, réunie avec le travail de l'équipe. Kama proposera deux langues, le **ghomálá'** et le **pidgin**, et **ne choisira jamais la langue à la place de l'utilisateur** : tant qu'elle n'est pas choisie, Kama la demande en premier.

### Ce qui a été implémenté, expliqué simplement

- **Branche `omar`** : c'est la copie de travail du frontend. On y a réuni le travail d'Omar et celui de l'équipe (données, modèles, évaluation, venus de la branche `dimitri`). Deux fichiers avaient été modifiés des deux côtés, et on a gardé les deux versions de chacun :
  - `.gitignore` : la liste des fichiers que git ne doit pas enregistrer ;
  - `JOURNAL.md`.
- **Correction d'auteur** : les 8 premières entrées frontend de ce journal indiquaient par erreur « Dimitri ». Elles indiquent maintenant « Omar ».
- **`documentation/CLARIFICATIONS.md` mis à jour** :
  - langues : ghomálá' et pidgin, à la place de « ewondo d'abord » ;
  - nouvelle section « Choix de la langue » (détails ci-dessous) ;
  - règle « jamais d'emoji, des icônes lucide » ajoutée à la charte ;
  - libellés du menu de l'onglet décrits avec leurs icônes ;
  - persona signalé à revoir (voir plus bas).

### Démarche utilisée

**Comment on choisit la langue** (décisions d'Omar) :

- **Pas de langue par défaut.** Si Kama choisissait une langue d'office, une personne qui parle l'autre langue pourrait ne jamais comprendre qu'elle peut en changer. Kama lui parlerait alors dans une langue qu'elle ne comprend pas.
- **La question apparaît là où la personne se trouve**, à 3 endroits :
  1. la page de bienvenue ouverte à l'installation ;
  2. le popup, l'icône Kama dans la barre de Chrome ;
  3. l'onglet de bord dans la page de la banque.

  Le 3ᵉ endroit est le plus important : Mama Ngono ne cliquera peut-être jamais sur l'icône de Chrome, mais elle verra l'onglet.
- **Reconnaître sa langue sans avoir à lire** : chaque langue a un gros bouton et un bouton d'écoute qui dit son nom *dans la langue elle-même*, avec un indice de région simple :
  - Ghomálá' — Ouest ;
  - Pidgin — Nord-Ouest, Sud-Ouest.
- **Pas d'option « Français »** dans la liste : Kama est fait pour les langues nationales. Pour fermer sans choisir, un bouton « Pas maintenant » (la question reviendra). Dans le popup, quand une langue est déjà choisie, « Ne rien changer » ferme la liste sans rien modifier.
- **Orthographe** : on écrit « Ghomálá' », comme dans CLARIFICATIONS.md. La forme « Ghɔmálá' » contient la lettre ɔ, que la police DM Sans embarquée ne sait pas afficher.

### Résultats et limites connues

- La fusion des branches est prête. Omar fait lui-même le commit et l'envoi sur GitHub.
- Les noms des langues lus à voix haute n'existent pas encore. Le bouton d'écoute affichera le badge « traduction à fournir » en attendant les enregistrements (règle d'or n° 4).

### Ce que l'équipe doit faire ensuite

- **Dimitri (pidgin) et le collaborateur ghomálá'** :
  - faire enregistrer par un locuteur natif le nom de chaque langue, dit dans cette langue ;
  - vérifier l'orthographe à afficher ;
  - vérifier les indices de région.
- **Toute l'équipe** : revoir le persona. « Mama Ngono » porte un nom plutôt beti/ewondo, alors que les langues sont maintenant le ghomálá' et le pidgin.
- **Dimitri** : vérifier les deux retouches faites dans sa partie du journal pendant la fusion :
  - l'en-tête dit maintenant « chaque membre consigne son travail » ;
  - le modèle d'entrée dit « Auteur : Prénom ».

### Composants tiers utilisés

Aucun nouveau.

## 2026-11-11 — Popup complet, lecture de la page, pastilles, « Montre-moi » et barre de sélection

**Auteur :** Omar (réalisé par Claude Code en son absence, avec la consigne « prends les meilleures décisions »)

### En bref

Kama lit maintenant la **vraie page de test** et explique ce qu'elle affiche. Il pose des **pastilles** à côté du solde, des frais, du total, du bouton Confirmer et des erreurs. « **Montre-moi** » entoure l'élément en orange. Une **barre** apparaît quand on surligne un texte. Le **popup** a tous ses réglages, dont le choix de la langue.

Les deux scénarios du hackathon fonctionnent sur le vrai site :
- **Scénario 1** : la pastille des frais dit « Frais : 375 FCFA. … Au total, 25 375 FCFA vont sortir de ton compte. »
- **Scénario 2** : pour un transfert refusé, Kama dit « Tu n'as pas assez d'argent pour ce transfert. Il te manque 50 000 FCFA. »

### Ce qui a été implémenté, expliqué simplement

**1. Popup complet** (`components/popup/Popup.tsx`), avec les 5 états de la maquette :
- **premier lancement** : « Bienvenue ! Choisis ta langue », Ghomálá' (Ouest) ou Pidgin (Nord-Ouest, Sud-Ouest), et « Pas maintenant » ;
- **activé** : Ma langue, Je préfère (Texte / Audio), Expliquer cette page ;
- **liste des langues ouverte**, avec « Ne rien changer » ;
- **désactivé** : tout est grisé, et Kama n'ajoute plus rien dans les pages ;
- **page non reconnue** : « Kama ne reconnaît pas cette page… Si elle est déjà ouverte, recharge-la. »

Les réglages sont mémorisés dans le navigateur (`lib/reglages.ts`) et s'appliquent **tout de suite** dans la page.

**2. Choix de la langue aux 3 endroits décidés.** Le popup et l'onglet de la page sont faits ; la page de bienvenue est à faire. Si on clique sur une pastille avant d'avoir choisi, Kama demande la langue, puis affiche ce qui avait été demandé.

**3. Lecture de la page** (`lib/lecture-page.ts`). La page n'a aucun repère technique, alors Kama la lit **par ses textes**.
- Tous les libellés sont dans **un seul fichier**, `config/page-test.ts`, en français et en anglais (bouton EN de la page).
- Kama reconnaît les 5 étapes du parcours (Solde, Frais, Bénéficiaire, Récapitulatif, Confirmation) et les 7 codes d'erreur de la banque.
- Il relit la page dès qu'elle change, sans rechargement. C'est aussi ce qui lui permet de voir le texte que le jury ajoute.

**4. Pastilles** (`components/Pastilles.tsx`) à côté de :
- solde, montant, frais, total ;
- bouton « Confirmer le transfert » ;
- message d'erreur.

Infobulle « Kama t'explique » au survol. Au clic, la fenêtre explique l'élément.

**5. « Montre-moi »** (`components/Surlignage.tsx`) : la page défile jusqu'à l'élément, entouré d'un contour orange (2 pulsations puis fixe). Le contour disparaît au clic, avec Échap, après 8 s, ou si l'élément disparaît.

**6. Barre de sélection** (`components/BarreSelection.tsx`) : [Expliquer] [Écouter] au-dessus du texte surligné.
- Si le texte est un élément connu (ex. « Frais »), Kama l'explique.
- Sinon, il affiche « Ce texte n'existe pas encore en Ghomálá' » et propose de l'écouter en français.

**7. Vrais contenus de la fenêtre** (`components/kama/fenetre/reel.tsx`) : « Expliquer cette page » selon l'étape en cours, « Résumer mes transactions » à partir de la liste de la page, explication d'un élément, et erreur expliquée.

**8. Préférence « Audio »** : la réponse est lue automatiquement à l'ouverture. Avec « Texte », on appuie sur ▶.

**9. Catalogue** : il montre aussi les 5 états du popup, à côté des 12 états de la fenêtre (dont le nouveau « Choix de la langue »).

### Démarche utilisée

**Étude du site**
- La page a été ouverte et parcourue automatiquement avec Chrome sans interface, pour relever les textes de chaque étape.
- Le dictionnaire français/anglais des libellés et les 7 codes d'erreur ont été relevés dans le code public de la page. Le panneau réservé au jury n'a pas été utilisé.

**Décisions prises (à valider par Omar)**

1. **Sécurité des montants (règle d'or n° 1).**
   - Un montant est recopié tel quel, y compris l'espace fine insécable de « 250 000 FCFA ».
   - Il n'est rattaché à un libellé que si ce libellé est le plus proche avant lui. Sinon, le mot « Frais » de la barre d'étapes aurait pu récupérer le montant du solde.
2. **Montant manquant calculé par Kama** (scénario 2) : total à débiter − solde disponible.
   - Ce chiffre n'est pas écrit dans la page. Il est calculé par le code (jamais par un modèle de langue) et écrit dans le même format que la page.
   - Si un des deux montants n'est pas un nombre entier clair, Kama n'affiche rien.
   - Résultat identique au « Solde après opération » affiché par la banque (−52 500 FCFA → « Il te manque 52 500 FCFA »).
3. **Badge « Pas encore traduit » sur tous les vrais contenus.** Les explications sont des gabarits en français (`config/gabarits.ts`), et le badge « Vérifié » est réservé au glossaire validé.
4. **Résumé** : « Sur cette page : 2 entrées, 2 sorties » au lieu de « Ce mois-ci », car la page ne montre que les dernières opérations.
5. **Les 7 erreurs de la banque ont chacune une explication franche** (ex. `SECURITY_002` : « Attention : tu n'as jamais envoyé d'argent à cette personne… Si tu as un doute, n'envoie pas l'argent »). Un code inconnu renvoie au message de la banque, sans rien inventer.
6. **Données saisies jamais lues.** Ni la barre de sélection ni les pastilles ne lisent ce que l'utilisateur tape. Rien n'est stocké ni transmis.
7. **Écarts avec les maquettes Lovable**, pour la simplicité et l'accessibilité :
   - choix de la langue sur une colonne : il y a 2 langues, contre 6 dans la maquette ;
   - pas de lien « Paramètres » dans le popup : aucun réglage n'est prévu derrière ;
   - liste des langues ouverte dans le popup et non par-dessus, pour ne pas être coupée ;
   - pas de bouton haut-parleur dans l'infobulle de la pastille : un bouton visible seulement au survol n'est pas utilisable au clavier.

**Vérification**
- **Test de lecture** sur tout le parcours réel. On injecte seulement le module de lecture et on affiche, à chaque étape, ce que Kama lit et ce qu'il dirait.
- **Test visuel** avec l'extension chargée dans « Chrome for Testing » : 10 captures (onglet, choix de la langue, menu, expliquer, Montre-moi, pastilles, scénario 1, sélection, scénario 2, popup).
- Deux défauts ont été trouvés et corrigés grâce à ces tests :
  - libellé lu « Frais Gratuit » au lieu de « Frais » ;
  - contour orange resté dans le coin de l'écran après un changement d'étape.

### Résultats et limites connues

- La compilation Chrome et Edge réussit, sans erreur TypeScript. La page ne produit aucune erreur pendant les tests automatiques.
- **Pas encore fait** :
  - page de bienvenue à l'installation ;
  - micro (« Parler à Kama » affiche seulement « Pose ta question ») ;
  - bouton « Réessayer » ;
  - audios enregistrés ;
  - textes en ghomálá' et en pidgin.
- **Page en anglais (bouton EN)** : Kama reconnaît les éléments, mais ses explications restent en français, avec les libellés anglais de la page.
- **Comportement de la page remarqué** : en « Autre banque », 249 000 FCFA plus 5 000 FCFA de frais font 254 000 FCFA, plus que le solde, et pourtant la page laisse continuer. Kama n'ajoute pas d'alerte de lui-même pour l'instant.
- **À retirer avant le zip du jury** : la page catalogue et son lien dans le popup.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Dimitri | Envoyer `Validation_pidgin_page_test.docx` aux locuteurs natifs, en commençant par les 6 mots non attestés |
| Dimitri | Demander l'accès à Common Voice `wes` sur Mozilla Data Collective |
| Dimitri | Écouter `evaluation/tts_ecoute/index.html` et remplir `notes.csv` |
| Équipe | Trouver un locuteur camerounais prêt à enregistrer 1 à 2 heures, avec un accord écrit pour l'usage de sa voix |
| Dimitri | Récupérer le modèle version 2 sur Colab et le comparer à la version 1 et à jamm55 |

### Composants tiers utilisés

| Composant | Licence | Usage |
|---|---|---|
| MMS-TTS pcm (Meta) | CC-BY-NC 4.0, non commercial | Voix de synthèse en pidgin, en test |
| Helsinki-NLP opus-mt fr-en et en-fr | CC-BY 4.0 | Passage par l'anglais |
| jamm55 autotrain pidgin | Licence non précisée | Base de notre modèle pidgin |
| CTranslate2 | MIT | Exécution rapide des modèles sur processeur |
| Google Colab | Service gratuit de Google | Entraînement sur GPU, hors dépôt |
| MT560 anglais-pidgin camerounais | CC BY 4.0 | Données d'entraînement et dictionnaire |
| Manuel Peace Corps 1983 (ERIC ED255041) | Document public | Dictionnaire, hors dépôt |
| SOREVA (Goethe-Institut) | CC BY 4.0 | Test et dictionnaire |

## 2026-11-11 — Bilan des trois modèles pidgin : traduction, voix, reconnaissance, et phrases de Kama

### En bref

- **Traduction (TTT)** : le dictionnaire passe d'abord, puis le modèle v2 pour les textes non critiques. Les textes critiques qui ne sont pas dans le dictionnaire sont refusés. Quatre autres modèles ont été essayés ou écartés : aucun ne fait mieux que v2.
- **Voix (TTS)** : la voix MMS pcm est branchée et **activée** dans le serveur. Les 73 textes validés sortent par leurs extraits ; la voix du modèle ne parle que pour ce qui n'a pas d'extrait. Dimitri a écouté l'essai sur de l'inédit : c'est accepté pour ce premier essai.
- **Reconnaissance (STT)** : trois modèles mesurés, aucun n'est assez bon pour une dictée libre (plus de la moitié des mots sont faux). On garde l'idée de reconnaître une intention parmi 7 phrases. Tout est prêt pour entraîner un meilleur modèle sur Common Voice (Colab).
- **Phrases de Kama** : 40 phrases que Kama dit lui-même (menus, boutons, badges, explications, réponses avec montants) sont écrites en brouillon pidgin. Elles ne seront servies comme « Vérifié » qu'après validation par un locuteur.
- Les tests automatiques du serveur passent : 155 réussis, 1 ignoré.

### Les mots à connaître

| Mot | Sens simple |
|---|---|
| TTT, TTS, STT | Texte vers texte (traduction), texte vers voix, voix vers texte |
| Intention | Ce que la personne veut (ex. connaître son solde), choisi dans une liste fermée de 7 |
| WER, CER | Part des mots (WER) ou des lettres (CER) qui sont faux. Plus c'est bas, mieux c'est |
| chrF | Note de ressemblance d'une traduction avec la bonne. Plus c'est haut, mieux c'est |
| Emprunt | Mot anglais utilisé tel quel en pidgin (application, code, charge) |

### Ce qui a été implémenté, expliqué simplement

**Traduction.** L'ordre est : dictionnaire, puis phrases proches, puis modèle v2 (seulement si le texte n'est pas critique), sinon « Pas encore traduit ». Les montants ne passent jamais par un modèle. Le dictionnaire peut maintenant venir de plusieurs fichiers : la page de test et les phrases de Kama (`content-data/kama_interface.json`).

**Phrases de Kama.** Le document de l'expérience utilisateur décrit des phrases que Kama dit lui-même, différentes des textes de la banque. Elles sont écrites avec des montants d'exemple qui seront remplacés par les vrais montants de la page. Un fichier Word, `Validation_pidgin_phrases_kama.docx`, permet à un locuteur de les corriger.

**Lecteur de nombres.** `backend/app/numbers.py` transforme un montant en suite de mots (25 500 FCFA devient « twenty five thousand five hundred franc »). C'est un calcul, pas un modèle. Un montant illisible n'est pas lu. Les mots du pidgin restent à valider.

**Voix.** La route de voix est activée. Un script, `models/telecharger_voix.py`, permet à un collaborateur de télécharger le modèle (145 Mo), qui n'est pas dans Git. Dans Docker, `--build-arg WITH_VOICE=1` installe les bibliothèques de voix.

**Reconnaissance.** Un nouveau moteur, `hf_ctc`, permet de brancher un modèle entraîné sur Common Voice. Le dossier `training/stt_pidgin/` contient la préparation des données (`01_preparer_donnees.py`), l'entraînement (`entrainer_stt.py`, trois modèles au choix) et un notebook Colab. Les phrases de test et de contrôle de Common Voice ne sont jamais dans l'entraînement.

**Outils de mesure.** Mesure du lexique sur des corpus du web (`09_lexique_web.py`), des termes critiques (`10_termes_critiques.py`), de la voix sur de l'inédit (`evaluation/tts_inedit.py`), de la reconnaissance (`evaluation/stt_eval.py`) et téléchargement des modèles candidats (`evaluation/download_candidats.py`).

### Démarche utilisée

1. Comparer tous les modèles de traduction avec le même décodage, sur des phrases que le modèle n'a jamais vues.
2. Chercher des modèles et des corpus pidgin sur Hugging Face et sur le web, puis ne retenir que ce qui se teste en pidgin.
3. Mesurer la voix avec la reconnaissance : on fait relire la voix de synthèse par un modèle de reconnaissance, l'écart avec le texte voulu dit si la voix est claire.
4. Ne rien servir en « Vérifié » sans validation d'un locuteur.

### Résultats et limites connues

**Traduction anglais vers pidgin** (77 phrases SOREVA, pidgin camerounais, jamais vues) :

| Modèle | chrF | BLEU |
|---|---|---|
| jamm55 (base) | 33,4 | 9,1 |
| **v2 (notre modèle)** | 33,0 | 8,5 |
| NITHUB marian BBC | 33,0 | 8,1 |
| v1 | 30,7 | 6,8 |
| Enutrof marian | 21,1 | 3,2 |

Sur 60 messages bancaires inédits : v2 et v1 sont sans problème dans 38 cas, jamm55 dans 16, NITHUB dans 4 (il casse les balises des montants dans 19 cas, il est donc inutilisable avec notre masquage). Aucun montant n'est perdu avec v2.

- **Le vrai défaut de v2** est le sens des termes critiques (« annuler » devient « close »). Le filtre de lexique, lui, refuse surtout des emprunts valides : 21 des 22 mots « inconnus » de v2 existent dans le pidgin du web (application, charge, code, validate).
- Le corpus web bancaire nigérian est généré par gabarits (117 mots différents) : inutilisable pour le lexique. Le corpus de presse nigérian apporte 20 899 mots vus au moins 5 fois qui manquent à notre lexique. Ce sont des mots nigérians, à faire valider avant tout usage.

**Voix sur l'inédit** (reconnaissance qui relit la voix de synthèse) :

| Groupe | Phrases | Erreur de lettres moyenne |
|---|---|---|
| Banque inédite | 30 | 26 % (21 % pour les phrases d'au moins 2 secondes) |
| Vie courante SOREVA (très courtes) | 40 | 61 % |

Les très courts énoncés sont le point faible. La vitesse est d'environ le temps réel.

**Reconnaissance** (mots faux / lettres fausses) :

| Modèle | SOREVA (150 phrases) | Common Voice (322 clips) |
|---|---|---|
| Omnilingual 300M | 61,6 % / 26,5 % | 54,9 % / 23,9 % |
| wav2vec2 pidgin | 56,7 % / 29,3 % | 52,7 % / 24,3 % |
| Whisper small | 68,5 % / 39,9 % | 78,0 % / 47,9 % |

Omnilingual reste branché (désactivé dans `routes.json`).

**Limites.** L'intention n'a pas encore été testée sur de l'audio réel. Le test local du script d'entraînement n'était pas fini au moment d'écrire ces lignes. La licence de MMS-TTS est non commerciale. Les données d'entraînement `train.jsonl` et `dev.jsonl` ne sont pas dans Git (elles contiennent des textes religieux de MT560) et se recréent avec `01_nettoyer_donnees.py`.
| Omar | Tester dans Chrome (liste de tests fournie) et valider les décisions ci-dessus, surtout le montant manquant calculé |
| Équipe langues (Dimitri, collaborateur ghomálá') | Traduire et faire valider les gabarits de `config/gabarits.ts` et les explications d'erreurs de `config/page-test.ts` ; enregistrer les audios |
| Équipe | Relire les 7 explications d'erreurs (ton, exactitude) |

### Composants tiers utilisés

| Composant | Usage | Licence |
|---|---|---|
| puppeteer-core | Pilotage de Chrome pour les tests (outil de test, non livré, installé hors du projet) | Apache 2.0 |
| Chrome for Testing (Google) | Navigateur de test qui accepte une extension chargée par script (non livré) | Conditions de Google / Chromium (BSD) |
| WXT `storage` | Mémorisation des réglages (déjà inclus dans WXT) | MIT |

## 2026-11-11 — Kama ne calcule plus aucun montant

**Auteur :** Omar

### En bref

Décision d'Omar : **Kama ne calcule rien**, même par le code. La phrase « Il te manque … » du scénario 2 est retirée.

### Ce qui a été implémenté, expliqué simplement

- Erreur « Solde insuffisant » : Kama montre le message de la banque et explique la cause (« Tu n'as pas assez d'argent pour ce transfert. ») avec le conseil. Il n'affiche plus de montant manquant.
- Le calcul (`montantManquant`) est supprimé de `lib/lecture-page.ts`. La ligne « Il te manque » est retirée de la fenêtre et de l'exemple du catalogue.
- `CLARIFICATIONS.md` est mis à jour :
  - règle d'or n° 1 : « le code de Kama n'en calcule aucun (ni différence, ni somme) » ;
  - critère du scénario 2 : sans montant manquant.

### Démarche utilisée

Le montant manquant n'est écrit nulle part sur la page. Même calculé par le code, il devient un chiffre produit par Kama, donc un risque. Omar a préféré s'en tenir à la règle stricte : **tout montant affiché par Kama est recopié de la page**.

### Résultats et limites connues

- La compilation et TypeScript passent.
- Le scénario 2 explique la cause sans donner l'écart.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Dimitri | Envoyer `KAMA_pidgin_stt_drive.zip` sur le Drive (`KAMA/Dataset/`) et lancer le notebook `entrainement_stt_colab.ipynb` |
| Locuteur natif | Corriger `Validation_pidgin_phrases_kama.docx` (40 phrases) puis `Validation_pidgin_messages_inedits.docx` (30 messages) |
| Locuteur natif | Valider les mots de nombres et les phrases d'intention |
| Équipe | Décider d'ajouter 6 intentions (`ask_recipient`, `ask_amount`, `ask_delay`, `is_it_safe`, `help`, `stop`) : cela modifie le contrat avec l'extension |
| Omar | Appliquer les phrases de Kama selon la langue choisie ; gérer la voix lente dans l'extension |
| Équipe | Poser au comité les questions sur la licence de MMS-TTS et l'envoi d'audio ou de texte à un serveur |
| Équipe | Trouver un locuteur pour enregistrer une voix humaine, avec un accord écrit |

### Composants tiers utilisés

| Composant | Licence | Usage |
|---|---|---|
| MMS-TTS pcm (Meta) | CC-BY-NC 4.0, non commercial | Voix de synthèse |
| Omnilingual ASR CTC 300M | Apache 2.0 | Reconnaissance vocale |
| KhayaAI w2v-bert-pcm, wav2vec2 pidgin | Apache 2.0 | Candidats à l'ajustement |
| NITHUB marian BBC, Enutrof marian | Licence à vérifier | Essais, rejetés |
| Common Voice wes 27.0 | CC0 (ne pas republier, ne pas identifier les locuteurs) | Entraînement et test de la reconnaissance, hors dépôt |
| Corpus pidgin du web (presse, lexiques, Wikipédia pidgin) | Variables | Mesure du lexique, hors dépôt |
| onnxruntime, PyTorch, transformers | MIT, BSD, Apache 2.0 | Moteurs de voix |

Signé : Dimitri, 2026-11-11
| Équipe langues | Ne pas prévoir de phrase « Il te manque {montant} » dans les traductions |


## 2026-11-11 — Intégration complète : l'extension parle au serveur

### En bref

- L'extension (le front d'Omar) est maintenant branchée au serveur : traduction, voix, micro. Avant, elle affichait seulement du français avec « Pas encore traduit ».
- Chemin d'une phrase : l'extension cache les montants (`{x1}`), cherche d'abord dans un **glossaire embarqué** (phrases validées), puis demande au serveur. Les montants ne partent jamais ; ils sont remis tels quels (caractère pour caractère) à l'arrivée.
- Tant qu'une phrase n'est pas validée par un locuteur, Kama garde le français avec le badge « Pas encore traduit ». **Il n'invente rien.** Le plus souvent, c'est ce que l'on verra aujourd'hui.
- Les tests passent : 69 tests pour l'extension, 104 pour le serveur (1 ignoré). Le build de l'extension réussit.
- **Rien n'a encore été essayé dans un vrai navigateur.** Dimitri le fera.

### Ce qui a été fait

**Extension (`kama_frontend/`)**
- `entrypoints/background.ts` : le service worker est le seul à parler au serveur. Il ne répond qu'à notre extension, depuis la page de test, et ne connaît que 4 routes.
- `lib/masquage.ts` : copie du masquage du serveur, vérifiée sur 24 exemples communs.
- `lib/traduction.ts`, `lib/glossaire.ts`, `config/glossaire.json` : glossaire d'abord, serveur ensuite. Une traduction qui change une balise est refusée.
- `lib/audio.ts`, `lib/nombres.ts` : la réponse est lue avec la voix du serveur. Le montant, lui, est lu par le navigateur (il ne quitte jamais l'extension).
- `lib/micro.ts`, `lib/wav.ts`, `lib/use-parler.ts` : le micro n'est ouvert qu'entre deux appuis. Le serveur ne renvoie que l'intention, jamais le texte reconnu.
- Consentement au premier usage, puis un consentement séparé pour le micro. Rien ne démarre avant.
- La fenêtre se vide quand la page change d'étape.
- États prévus par le document UX : pas de connexion + « Réessayer », traduction indisponible + « Écouter en français », voix en français si le serveur ne peut pas parler.
- `wxt.config.ts` : identifiant d'extension fixé par une clé (`bbgkmjbkhecafcpladgdbecpgmpcelho`) et accès réseau limité au serveur.
- Les fichiers d'Omar ont reçu des ajouts, rien n'a été retiré : `parts.tsx`, `contents.tsx`, `reel.tsx`, `KamaApp.tsx`, `voix.ts`, `reglages.ts`. Ses gabarits, ses textes et sa règle « aucun montant calculé » sont gardés.

**Serveur (`backend/`)**
- `content-data/kama_fenetre.json` : 83 phrases de la fenêtre, à faire valider (généré par `kama_frontend/scripts/phrases-fenetre.mjs`).
- `app/export_glossary.py` : écrit le glossaire embarqué depuis les phrases validées (70 pour le pidgin aujourd'hui, toutes de la page de test).
- `config/routes.demo.json`, `scripts/lancer_demo.ps1`, `scripts/verifier_demo.py` : lancer le serveur comme pour le jury (mode production, origine limitée à l'extension) et vérifier qu'il répond comme l'extension l'attend.
- « Kama » est ajouté aux mots d'interface du masquage (sinon « Parler à Kama » aurait été pris pour un nom de personne et refusé).
- Fichier de référence des montants lus à voix haute : `contracts/numbers_vectors.json`.

**Documentation** : `documentation/SECURITE.md` (où va chaque donnée, ce qui est prouvé, ce qui ne l'est pas encore).

### Démarche utilisée

Les trois documents de l'équipe (UX, sécurité, règlement) et `backend/ARCHITECTURE.md` ont servi de cahier des charges. Chaque règle a été traduite en test quand c'était possible : les phrases du code et le catalogue à valider doivent rester identiques, aucun chiffre ne part sur le réseau, un brouillon n'est jamais « Vérifié », un élément critique n'appelle jamais le modèle.

### Résultats et limites connues

- La plupart des réponses restent en français avec « Pas encore traduit » : il manque la validation des 83 phrases par un locuteur.
- **Le micro demande l'autorisation au nom du site bancaire**, pas au nom de Kama. Le document de sécurité demande l'inverse ; cela demande un essai avec un document hors-écran dans le navigateur.
- Le micro reste peu fiable en pidgin (le reconnaisseur déforme les mots) et il est coupé dans la configuration par défaut (`routes.json`). `lancer_demo.ps1` l'active pour les essais.
- Les montants sont lus avec la voix du navigateur, en anglais pour le pidgin, tant que les chiffres ne sont pas enregistrés par un locuteur.
- Ghomálá' : le serveur n'a pas de modèle activé pour cette langue ; l'extension affiche donc le français.
- Pas encore faits : test de fuite dans l'onglet Réseau, test d'injection, règle ESLint contre `innerHTML`, `npm audit`.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Dimitri | Essayer l'extension dans Chrome et Edge sur la page de test (serveur : `backend\scripts\lancer_demo.ps1`, puis `python scripts\verifier_demo.py`) |
| Locuteurs natifs | Valider les 83 phrases de `content-data/kama_fenetre.json` (champs `wes` et `validated_by`) |
| Dimitri | Après validation : `python -m app.export_glossary`, puis `npm run build` dans `kama_frontend` |
| Omar | Relire les ajouts dans ses fichiers ; tester le micro dans un document hors-écran pour que l'autorisation soit au nom de Kama |
| Équipe | Héberger le serveur en HTTPS et reconstruire l'extension avec `WXT_KAMA_API=https://...` |
| Équipe | Décider si le micro reste coupé par défaut |

### Composants tiers utilisés

Aucun nouveau composant : seulement ceux déjà déclarés (React, WXT, Tailwind, lucide côté extension ; FastAPI et les modèles déjà listés côté serveur).

Signé : Dimitri, 2026-11-11


## 2026-11-11 — Les textes par défaut de Kama et ceux de la page de test sont dans l'extension

### En bref

- Les **40 textes par défaut de Kama** (`content-data/kama_interface.json`) et les **70 textes de la page de test** (`safinum_test_page.json`) sont maintenant embarqués dans l'extension. Ils s'affichent sans appel au serveur.
- **Textes par défaut** : 24 sont des libellés d'interface (menu, boutons, badges, messages d'état). Ils s'affichent en pidgin **même en brouillon**. Les 16 autres (explications, réponses avec montants, catégories d'opérations) restent hors de l'extension tant qu'un locuteur ne les a pas validés.
- **Page de test** : les libellés validés servent dans la fenêtre (« Frais » devient « Charge » dans « Élément choisi »), et le message de la banque est traduit s'il est dans le catalogue.
- Tests : 73 pour l'extension, tous réussis ; le contrat serveur (14 tests) réussit aussi.

### Ce qui a été fait

- `python -m app.export_glossary` écrit maintenant `kama_frontend/config/interface.json` (24 libellés, tous en brouillon) en plus de `glossaire.json` (70 phrases validées). Chaque libellé porte son `statut` ; une validation (`validated_by`) le fait passer à « valide » sans toucher au code.
- Nouveaux fichiers : `lib/interface.ts`, `lib/use-texte.ts`. Ajouts seulement dans le menu de l'onglet, la barre de sélection, le popup (Activé, Texte, Audio, Expliquer cette page), les badges, « Montre-moi », « Réessayer », « Pas de connexion internet ».
- Ordre de recherche d'un texte : phrase validée, puis libellé d'interface, sinon le français.

### Limites connues

- Les 83 phrases d'explication de la fenêtre n'ont toujours pas de pidgin validé : seules 5 ressemblent aux textes par défaut. L'audio pidgin des explications attend leur validation.
- Les libellés en brouillon ont été écrits par l'équipe sans locuteur natif : ils doivent passer par `Validation_pidgin_phrases_kama.docx`.
- Le badge « Vérifié » n'apparaît que pour les phrases réellement validées.

Signé : Dimitri, 2026-11-11


## 2026-11-12 — Kama entièrement en pidgin, comparaison des modèles de traduction, entraînements Colab corrigés

### En bref

- Quand le pidgin est choisi, **toute l'interface de Kama passe en pidgin**, à l'écrit et à l'oral : menu, boutons, badges, messages d'état, explications de la fenêtre, popup. Les textes sans phrase validée s'affichent en **brouillon**, avec le badge « Traduction automatique », jamais « Vérifié ».
- **Écouter** (barre de sélection) et les boutons haut-parleur passent maintenant par la traduction puis la voix pidgin du serveur, au lieu de lire directement le français.
- La langue du texte source (français ou anglais) est détectée dans l'extension, sans réseau ni modèle.
- **Six modèles de traduction ont été comparés.** On garde la v2 sur le serveur pour l'instant. m2m100 de Masakhane garde mieux le sens et devient la base du prochain ajustement : `training/pidgin_m2m/` est prêt.
- **Carnets Colab corrigés** : voix (TTS) et reconnaissance (STT). L'entraînement complet de la voix pidgin est lancé sur Colab.
- Tests : 83 réussis pour l'extension ; 186 réussis et 1 sauté pour le serveur.

### Ce qui a été fait

**Extension (`kama_frontend`)**
- `content-data/kama_fenetre.json` : brouillon pidgin (`wes`) pour les 83 phrases de la fenêtre. `content-data/kama_interface.json` : 31 nouveaux libellés, soit 71 au total. Le tout est exporté dans `config/interface.json` par `python -m app.export_glossary`, et aucun n'est marqué validé.
- Nouveau `lib/ecouter.ts` : lecture d'un texte dans la langue choisie (traduction, voix du serveur, montants lus localement).
- `lib/api.ts` : `detecterLangueSource` (fr/en) ; `source_lang` est envoyé au serveur.
- En mode développement, la console signale `[kama:fr]` pour tout texte de Kama resté en français.
- Délai de la voix porté à 45 s (synthèse sur processeur) ; l'audio des réponses est préparé à l'avance et mis en cache.
- Nouveaux tests : `tests/langue-source.test.mjs`, `tests/modeles.test.mjs`.

**Serveur (`backend`)**
- `app/export_glossary.py` exporte aussi les phrases de la fenêtre, avec leur statut. Le test de contrat de l'extension a été mis à jour.
- Testé en session de démo seulement, rien n'est changé dans les fichiers : la variable `KAMA_MT_ALLOW_CRITICAL=1` laisse le modèle traduire les messages critiques. Les montants, noms et numéros restent masqués. Sur 8 messages critiques inédits, les 8 sortent en pidgin en 1 à 4 s, mais avec deux contresens (voir Limites).

**Traduction : comparaison des modèles** (77 phrases SOREVA ; 30 messages inédits en fr et en anglais)

| Modèle | chrF / BLEU | Inédit sans problème | Termes critiques | Décision |
|---|---|---|---|---|
| v2 (Marian, serveur actuel) | 33,8 / 10,6 | 38/60 | 60/70 | gardé pour l'instant |
| finance_propre | 33,0 / 7,0 | 41/60 | 61/70 | écarté |
| m2m100 Masakhane | 32,8 / 8,2 | 10/60 (mots absents du lexique) | 57/70 | **meilleur sens**, base du prochain ajustement |
| jamm55 mix | 25,3 / 6,6 | — | — | écarté |
| mt5 Davlan | 28,1 / 5,9 | — | — | écarté (recopie l'anglais) |
| Marian Enutrof | 21,1 / 3,2 | — | — | écarté (invente du sens) |

Les chiffres automatiques avantagent la v2, mais à la lecture, la v2 fait des contresens qui passent les contrôles. Par exemple, « unusual login » devient « special doctrine », et « Request a new one » devient « Ask some new person ». m2m100 garde le sens, avec une orthographe nigériane et des mots anglais. La décision finale doit venir d'un test à l'aveugle par le locuteur.

**Entraînement**
- `training/pidgin/pipeline.py` lit aussi les modèles mT5 et M2M100, ainsi que M2M100 converti en CTranslate2 (sortie forcée par le jeton `__fr__`).
- Nouveau `training/pidgin_m2m/` (préparation des données, export Drive, carnet Colab, README) pour ajuster m2m100. Il réduit le religieux à 15 %, exclut les phrases de test, et prévoit une table d'orthographe et l'ajout de la post-édition.
- `training/tts_pidgin/entrainement_tts_colab.ipynb` :
  - vérification de Python 3.12 ;
  - zip cherché dans la session, puis sur le Drive, puis envoi manuel ;
  - essai rapide sur 6 enregistrements par locuteur ;
  - colonne du locuteur renommée `locuteur` : le nom `speaker_id` cachait la colonne et faisait planter l'entraînement ;
  - correctif matplotlib pour les graphiques de validation.
  
  L'essai rapide est réussi : 12 locuteurs, plus la voix mélange n° 12.
- `training/stt_pidgin` : compatible avec transformers v5 (`warmup_ratio` supprimé).

**Données publiques recherchées** : il n'existe aucun corpus parallèle bancaire en pidgin camerounais.
- Le MT560 anglais–pidgin camerounais (28 159 paires, CC BY 4.0) est religieux.
- Le corpus oral de pidgin camerounais d'Oxford (240 000 mots, déjà téléchargé) est la meilleure source de pidgin camerounais, à condition de vérifier sa licence avant toute rétro-traduction.
- Common Voice ne contient qu'environ 1 000 phrases de texte.
- `Ephraimmm/pidgin_bank_dataset` est écarté : licence inconnue.

### Limites connues

- **Retour au français** : si la traduction dépasse 8 s ou si la voix échoue, l'extension lit encore le français. Un prompt est prêt pour la file d'attente de la voix, le délai de 20 s et des annonces pidgin à la place du français.
- **Messages critiques traduits par le modèle** : deux contresens passent les contrôles actuels, « Annulez ce transfert… » qui donne « Close di money… » et « compte suspendu » qui donne « don di wait ». Deux contrôles sont à ajouter avant toute démo : termes critiques attestés et négations.
- Seules **112 phrases bancaires** sont uniques dans les données d'entraînement, et elles sont en brouillon : la post-édition par le locuteur est indispensable.
- Les 83 phrases de la fenêtre et les 71 libellés sont des brouillons écrits sans locuteur natif.
- Le masquage des noms seuls reste à corriger (valeurs protégées selon leur position).

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Dimitri | Finir l'entraînement complet de la voix sur Colab, écouter `ecoute.zip`, puis brancher la voix mélange (numéro 12) au serveur |
| Dimitri | Faire passer à un agent le prompt « plus de français » (contrôles des termes critiques et des négations, annonces pidgin, file d'attente de la voix) |
| Locuteurs natifs | Test à l'aveugle v2 / m2m100 sur 30 paires ; valider les brouillons de la fenêtre et de l'interface ; post-éditer des messages bancaires |
| Équipe | Voie 3 : types de messages bancaires et explications validées pour le contenu inédit |
| Équipe | Vérifier la licence du corpus d'Oxford avant la rétro-traduction |

### Composants tiers utilisés

- `masakhane/m2m100_418M_en_pcm_rel_news_ft` (AFL-3.0), évalué et préparé pour l'ajustement, hors Git.
- L'outil d'entraînement `ylacombe/finetune-hf-vits` était déjà utilisé.
- Aucune nouvelle dépendance dans l'extension ni dans le serveur.

Signé : Dimitri, 2026-11-12

## 2026-11-11 — Contenu inédit : montants, alertes et messages inconnus, écran inconnu, test avec le panneau du jury

**Auteur :** Omar

### En bref

Kama ne s'appuie plus seulement sur sa liste de libellés. Il repère tout seul :
- les **montants** qu'il ne connaît pas ;
- les **messages d'alerte** ;
- les **textes ajoutés** dans la page après son affichage.

Sur un **écran qu'il ne connaît pas**, « Expliquer cette page » dit ce qu'il voit. Le tout a été testé avec le **panneau du jury** de la page de test.

### Ce qui a été implémenté, expliqué simplement

**A. Montants inconnus** (`lib/lecture-page.ts`)
- Tout montant affiché reçoit une pastille, avec le texte écrit juste avant lui. Exemple : « Solde après opération : −52 500 FCFA ».
- Le montant et le texte sont **recopiés tels quels**, et Kama dit qu'il ne connaît pas encore cette information (`gabaritMontantInconnu` dans `config/gabarits.ts`).
- Kama reconnaît aussi les autres écritures du franc CFA : « F CFA », « XAF », devise devant ou derrière.
- Ne reçoivent pas de pastille :
  - les montants déjà expliqués ;
  - un montant répété sous un libellé connu, comme le solde rappelé sur le côté de la page ;
  - les montants des transactions ;
  - ceux des listes et tableaux, à partir de 3 montants au même endroit.

**B. Alertes et nouveaux messages**
- Une **alerte inconnue** est repérée par un rôle d'alerte (accessibilité), un code de type `XXX_000` ou un premier mot d'alerte (« Attention », « Alerte », « Erreur »…). Kama affiche le message de la banque tel quel, avec une explication franche.
- Un **nouveau message**, c'est un texte apparu sur un écran déjà affiché.
  - Kama retient en mémoire les textes de l'écran ; rien n'est stocké.
  - Le message garde sa pastille même si on change d'étape.
  - Un texte qui change à un endroit déjà affiché, comme la phrase des frais, est une mise à jour et non un nouveau message.
  - Un grand changement d'un coup, comme un nouvel écran ou la page passée en anglais, remet la mémoire à zéro.
- « Expliquer cette page » ajoute une étape « Un nouveau message est apparu… » avec « Montre-moi ».

**C. Écran inconnu** : « Kama ne connaît pas encore cette page. Voici ce qu'il y voit. » Suivent le titre, les messages, les montants (recopiés) et les boutons (« C'est toi qui décides d'appuyer »), chacun avec « Montre-moi ».

**E. Test avec le panneau du jury** (`?jury=1`) : injection d'un texte, puis déclenchement des 3 erreurs du panneau.

### Démarche utilisée

- **Lecture du code public** du panneau du jury (« Outil interne Safinum — non fourni aux équipes ») pour savoir ce qu'il permet :
  - injecter un texte ;
  - déclencher 3 erreurs ;
  - changer le montant, les frais et le bénéficiaire ;
  - vérifier les valeurs affichées et soumises ;
  - mesurer une **couverture**.
- **Tests automatiques** sur le vrai site : lecture seule à chaque étape, puis extension chargée dans Chrome for Testing (captures 11 à 16).
- **Défauts trouvés et corrigés grâce aux tests** :
  1. le solde, affiché deux fois, avait deux pastilles ;
  2. la phrase des frais, qui change avec le type d'envoi, était prise pour un nouveau message ;
  3. le texte injecté était compté deux fois, car le panneau du jury le recopie ;
  4. les **boutons** « Alerte de sécurité » du panneau du jury étaient pris pour des alertes de la banque.

### Résultats et limites connues

- Le texte injecté par le jury est détecté sans rechargement et reçoit sa pastille. La page l'affiche sous le titre « Message important », que Kama connaît déjà.
- Les 3 erreurs du panneau (AMOUNT_002, SECURITY_002, NETWORK_001) sont reconnues avec leur code.
- Les scénarios 1 et 2 passent toujours ; la page ne produit aucune erreur.
- **Limites** :
  - Kama **ne traduit pas** le texte inédit. Il le montre et propose de l'écouter en français, faute de traduction validée (règle d'or n° 4).
  - Un texte injecté **avant** l'arrivée de Kama est vu comme faisant partie de la page.
- **Constat important.** La « couverture » du jury mesure le **pourcentage de textes de la page qui ont été remplacés**. On mémorise les textes, on charge l'extension, puis on compte ceux qui ont changé. Le guide demande aussi que l'extension « analyse et traduise la page telle qu'elle est ».
  - Kama, qui explique dans sa propre fenêtre sans toucher à la page (règle d'or n° 3), obtiendrait 0 % à cette mesure.
  - Décision à prendre par l'équipe (voir ci-dessous).

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Équipe | Décider si Kama doit aussi traduire la page directement (mesure de couverture du jury), ce qui change la règle d'or n° 3 |
| Équipe langues | Si oui : traduire et faire valider la liste fermée des textes de la page en ghomálá' et en pidgin |
| Dimitri | Pour le texte inédit : traduire sans transmettre les données affichées (protocole), par exemple avec le masquage déjà prévu côté serveur |

### Composants tiers utilisés

Aucun nouveau composant.

## 2026-11-11 — Approche « assistant » confirmée par le règlement

**Auteur :** Omar

### En bref

Le **règlement du défi** laisse libre l'approche technique : « une extension de navigateur, un composant logiciel indépendant, un assistant vocal ou toute autre solution pertinente ». Il demande de rendre les contenus **compréhensibles** dans une langue nationale, pas de remplacer le texte de la page.

L'approche de Kama est donc conforme : il explique dans sa fenêtre, en audio d'abord, sans toucher à la page. La règle d'or n° 3 est maintenue. La mesure de « couverture » du panneau du jury n'est pas un critère du règlement.

### Ce qui a été implémenté, expliqué simplement

Rien. Il s'agit d'une décision, prise à partir du texte du règlement.

### Démarche utilisée

Les 5 fonctionnalités minimales du règlement ont été comparées à l'état actuel de Kama :

| Fonctionnalité du règlement | État |
|---|---|
| 1. Adaptation linguistique des principaux textes, instructions et messages | **Manque l'essentiel** : explications prêtes, mais encore en français (badge « Pas encore traduit ») |
| 2. Prise en charge d'un parcours (solde, frais, transfert) | Fait : « Expliquer cette page », « Montre-moi », pastilles |
| 3. Préservation des montants, frais, bénéficiaires, avertissements | Fait : tout est recopié tel quel, Kama ne calcule rien |
| 4. Fonctionnement sans modifier le code du service | Fait : reconnaissance par le texte, page non modifiée |
| 5. Traiter un nouveau message pendant la démonstration | **À moitié** : détecté et montré, mais pas encore rendu dans la langue nationale |

### Résultats et limites connues

Les deux manques (1 et 5) dépendent des **textes en langue nationale**, pas du frontend.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Équipe langues | Priorité n° 1 : traduire et faire valider les gabarits (`config/gabarits.ts`), les explications d'étapes et d'erreurs (`config/page-test.ts`) en ghomálá' et en pidgin, et enregistrer les audios |
| Dimitri | Priorité n° 2 : traduction en direct d'un message inédit (badge « Traduction automatique »), sans transmettre les données affichées : masquage des montants, noms et numéros avant l'envoi |

## 2026-11-12 — Assistant « Parler à Kama » : micro, accord de l'utilisateur, envoi au serveur (mode simulation)

**Auteur :** Omar

### En bref

« Parler à Kama » fonctionne de bout en bout, **jusqu'à la compréhension de la question** :
- au premier appui, Kama demande l'accord de l'utilisateur ;
- il écoute, puis s'arrête tout seul quand la personne se tait ;
- il prépare la voix au format exigé par le serveur et l'envoie par le service worker ;
- il affiche la conversation.

Le serveur n'étant pas encore en ligne, le service worker répond en **mode simulation**. Les réponses aux questions ne sont pas encore faites : décision d'Omar, « ce n'est pas encore le moment ».

### Ce qui a été implémenté, expliqué simplement

- **Enregistrement** (`lib/enregistreur.ts`) : WAV PCM 16 bits, 16 kHz, mono, comme le demande `backend/ARCHITECTURE.md`.
  - Écoute de 30 s au plus.
  - Arrêt automatique après 1,6 s de silence une fois que la personne a parlé, ou à l'appui sur le bouton.
  - Moins de 0,5 s, ou aucun son : « Je n'ai rien entendu ».
  - La voix reste en mémoire et le micro est coupé dès la fin.
- **Barres « Je t'écoute »** : elles suivent le vrai niveau du micro. Ce n'est pas une animation en boucle.
- **Accord au premier appui** (décision d'Omar) :
  - message « Ta voix est envoyée à Kama pour comprendre ta question. Elle n'est pas gardée. », avec [D'accord] [Non merci] ;
  - seule l'acceptation est retenue (`kama.consentementMicro`) ; après « Non merci », la question revient au prochain appui.
- **Envoi** (`lib/messages.ts`, `entrypoints/background.ts`) :
  - la page transmet la voix au service worker, seul autorisé à appeler le serveur ;
  - le service worker appelle `POST /v1/voice/intent` avec l'en-tête `X-Kama-Lang` (`bbj` ou `wes`), avec une limite de 15 s.
- **Adresse du serveur** (`config/serveur.ts`) : `SERVEUR_KAMA = null` tant qu'il n'est pas hébergé, ce qui active le mode simulation. Quand on écrira l'adresse, l'autorisation réseau sera ajoutée toute seule au manifest pour ce seul serveur.
- **Conversation** (`components/Assistant.tsx`) :
  - bulle « Message vocal · 3 s » (le serveur ne renvoie pas le texte de la question, seulement l'intention) ;
  - « Kama réfléchit », puis la réponse ;
  - la conversation est effacée à la fermeture de la fenêtre.
- **Bouton micro** : il marche depuis n'importe quel contenu de la fenêtre et passe alors à « Parler à Kama ».
- **Messages d'erreur simples**, avec « Réessayer » quand c'est utile :
  - micro refusé (« Clique sur l'icône du micro dans la barre d'adresse… ») ;
  - pas de micro ;
  - pas de réseau ;
  - serveur occupé ;
  - trop de questions ;
  - voix non comprise ;
  - voix pas encore prise en charge par le serveur (`asr_unavailable`) ;
  - extension mise à jour.

### Démarche utilisée

- **Lecture du travail du back** (`backend/ARCHITECTURE.md`, `contracts/openapi.json`, `content-data/intents.json`). Le serveur ne fait pas de discussion libre : il reconnaît la question et renvoie une **intention** (7 aujourd'hui). La réponse se construit dans l'extension, avec les montants lus dans la page.
- **Discussion avec Omar** :
  - pas de boutons de questions toutes prêtes : on reste sur le micro, comme dans la maquette Lovable ;
  - le contenu des réponses sera traité plus tard.
- **Test automatique** dans Chrome for Testing, avec un **faux micro** (son de 1,5 s suivi d'un silence) :
  - accord → écoute → arrêt automatique → envoi → réponse simulée, sans erreur dans la page (captures 17 à 19) ;
  - le son réellement envoyé par l'extension a été récupéré dans le service worker, puis passé aux contrôles du serveur (bibliothèque `wave`) : mono, 16 bits, 16 kHz, 3,46 s. Il serait donc accepté.

### Résultats et limites connues

- Les compilations Chrome et Edge réussissent, sans erreur TypeScript.
- **Autorisation du micro** : le navigateur la demande au nom du site visité (« safinum.cm veut utiliser votre micro »), car l'écoute se fait dans la page. C'est la solution la plus simple, et elle a été testée. L'alternative (document caché de l'extension, « offscreen ») afficherait « Kama », mais demande une page d'autorisation en plus.
- **Pas encore fait** : les réponses aux intentions, et la relecture des réponses en ghomálá' / pidgin (audios à venir).
- **Mode simulation** : toute question reçoit « J'ai bien reçu ta question… le serveur n'est pas encore branché ».

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Dimitri | Héberger le serveur et donner son adresse HTTPS (à écrire dans `config/serveur.ts`) ; brancher le moteur de voix de `/v1/voice/intent` |
| Dimitri | Mettre à jour `backend/ARCHITECTURE.md` : « Il te manque 3 000 FCFA » n'est plus calculé (décision du 2026-11-11) |
| Omar (livraison) | Fixer la `key` du manifest, pour que l'identifiant de l'extension soit le même chez le jury et autorisé par le serveur (`KAMA_ALLOWED_ORIGINS`) |
| Omar et l'équipe | Décider plus tard des réponses de l'assistant (intentions à ajouter, textes à valider) |

### Composants tiers utilisés

| Composant | Usage | Licence |
|---|---|---|
| `@puppeteer/browsers` | Réinstallation de Chrome for Testing pour les tests (outil de test, non livré) | Apache 2.0 |

## 2026-11-12 — Le micro appartient à Kama, plus au site de la banque ; page de bienvenue

**Auteur :** Omar

### En bref

Décision d'Omar : « c'est à Kama que l'on parle, pas au site de Safinum ».
- Le micro est maintenant ouvert dans un **document caché de l'extension**, et plus dans la page de la banque.
- Chrome demande donc « **Kama** souhaite utiliser votre micro », et la banque n'a **jamais** accès au micro.
- L'autorisation se donne une fois, sur la nouvelle **page de bienvenue**, qui s'ouvre toute seule à l'installation.

### Ce qui a été implémenté, expliqué simplement

- **Document caché « micro »** (`entrypoints/micro/`, permission `offscreen`, sans avertissement à l'installation). C'est lui qui enregistre la voix, avec le même module qu'avant (`lib/enregistreur.ts`).
- **Circulation** (`lib/messages.ts`, `lib/micro.ts`, `entrypoints/background.ts`) :
  - la page demande « écoute » au service worker par un canal dédié ;
  - le service worker fait écouter le document caché, renvoie à la page seulement le niveau du son et la durée, puis envoie la voix au serveur ;
  - **la voix ne passe jamais par la page de la banque** ;
  - fermer la fenêtre Kama coupe le micro et efface la voix.
- **Page de bienvenue** (`entrypoints/bienvenue/`, `components/bienvenue/Bienvenue.tsx`), ouverte à l'installation. Elle confirme l'installation, puis donne 4 étapes :
  1. épingler l'icône (pièce de puzzle, puis épingle) ;
  2. choisir sa langue : c'est le 3e endroit prévu, et il n'y a pas de langue par défaut ;
  3. autoriser le micro, avec le texte d'accord sur l'envoi de la voix (un clic sur « Autoriser » vaut aussi cet accord) ;
  4. ouvrir la page de la banque.
- **Micro pas encore autorisé** : la fenêtre dit « Kama n'a pas encore le droit d'utiliser le micro » et propose « Autoriser le micro », qui ouvre la page de bienvenue directement sur l'étape 3 (`bienvenue.html#micro`).

### Démarche utilisée

- Il n'existe pas de maquette Lovable pour la page de bienvenue (seul l'écran de langue du popup existe). Elle reprend la charte et les éléments de Kama : gros boutons de langue de 56 px, bouton d'écoute, badge, icônes lucide.
- **Tests automatiques** dans Chrome for Testing :
  - la page de bienvenue s'ouvre à l'installation ;
  - choix de la langue → autorisation → écoute par le document caché → réponse simulée, sans erreur ;
  - **avec refus du micro**, Kama propose « Autoriser le micro », qui ouvre la bonne étape ;
  - **la page de la banque n'obtient jamais l'accès au micro** : son état reste « prompt », jamais « granted ».
- **Défaut trouvé et corrigé** : Chrome réduit d'office le texte des pages d'extension à 75 % (12 px). La page de bienvenue fixe sa propre taille (16 px).

### Résultats et limites connues

- Compilation Chrome et Edge réussie, sans erreur TypeScript.
- **Firefox** ne connaît pas les documents cachés (`offscreen`). Il faudra une autre solution le jour où on fera Firefox.
- Si le micro était déjà autorisé avant l'installation (réinstallation), l'accord sur l'envoi de la voix est redemandé dans la fenêtre au premier appui.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Omar | Tester dans un vrai Chrome : retirer Kama, puis le recharger pour voir la page de bienvenue et la demande « Kama souhaite utiliser votre micro » |

## 2026-11-12 — 1 banque = 1 fichier, banque fictive « Banque Démo », version jury

**Auteur :** Omar (réalisé par Claude Code en son absence, avec la consigne « prends les meilleures décisions » ; les points sensibles sont laissés à sa décision)

### En bref

Suite aux demandes de Dimitri :
- Kama décrit chaque banque dans **son propre fichier** ;
- une **2e banque, fictive**, prouve qu'il s'adapte à une autre page sans changer son code ;
- une **version jury** de l'extension est produite pour Chrome et Edge, sans les pages locales de l'équipe ni le catalogue.

### Ce qui a été implémenté, expliqué simplement

- **`config/banques/`** remplace `config/page-test.ts` :
  - `types.ts` : ce qu'il faut décrire pour une banque ;
  - `safinum.ts` : la page des organisateurs, contenu inchangé ;
  - `demo.ts` : la banque fictive ;
  - `index.ts` : la liste des banques, et le choix de la banque selon l'adresse de la page.
- Les explications restent écrites **une seule fois, par rôle** (solde, frais, total…). Chaque banque dit seulement quels textes de **sa** page jouent ces rôles.
- Les erreurs sans code sont reconnues par leur message, avec une règle propre à chaque banque (`erreursParMessage`).
- **Banque inconnue** (adresse sans fichier) : Kama fonctionne quand même. Il repère seul les montants, les alertes et les nouveaux messages, et décrit l'écran.
- **Banque Démo** (`kama_frontend/banque-demo/index.html`, lancée avec `npm run banque-demo`, sur http://localhost:5180). Elle est volontairement différente de Safinum :
  - autres mots : « Commission », « Montant total prélevé », « Valider le virement », « Opération refusée / Provision insuffisante » ;
  - montants écrits « 25.500 XAF » ;
  - autre mise en page ;
  - un bouton de démonstration affiche un nouveau message de la banque ;
  - aucune donnée réelle.
- **Version jury** (`npm run build:jury`) → `.output/chrome-mv3-jury` et `.output/edge-mv3-jury`. Elle ne contient ni `localhost`, ni la Banque Démo, ni le catalogue des états (ni la page, ni son lien dans le popup). Vérifié dans les fichiers produits.
- **Correction** : « 1 entrées » devient « 1 entrée » dans le résumé des transactions.

### Démarche utilisée

- **Tests** :
  - **Safinum**, tout le parcours et le scénario 2 : rien ne change ;
  - **Banque Démo** avec l'extension chargée :
    - pastilles sur Solde du compte, Montant du virement, Commission, Montant total prélevé et Valider le virement ;
    - « Expliquer cette page » et « Montre-moi » ;
    - Commission : « Commission : 500 XAF… Au total, 25.500 XAF » (montants recopiés tels quels) ;
    - refus « Provision insuffisante » reconnu et expliqué ;
    - nouveau message détecté ;
    - résumé des 3 opérations ;
    - aucune erreur dans la page.
- **Vérification** : le frontend n'envoie aujourd'hui **aucun texte** au serveur. Seule la voix part, et seulement si l'adresse du serveur est configurée. Le masquage ne sera nécessaire qu'au moment de brancher la traduction.

### Résultats et limites connues

- Quatre compilations réussies, sans erreur TypeScript : Chrome, Edge, Chrome jury, Edge jury.
- **Firefox n'est pas fait.** Il ne connaît pas le document caché qui sert au micro.
- **Laissés à la décision d'Omar** : explications quand la page est en anglais ; traduction des libellés des transactions ; masquage des informations sensibles avant traduction ; Firefox.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Omar | Décider des 4 points ci-dessus |
| Omar | Essayer la Banque Démo : `npm run banque-demo` dans `kama_frontend`, puis http://localhost:5180 avec l'extension de développement (`.output/chrome-mv3`) |
| Équipe | Pour ajouter une banque : copier `config/banques/demo.ts`, remplacer les libellés, l'inscrire dans `config/banques/index.ts` |

## 2026-11-12 — Parler à Kama : les réponses (côté frontend)

**Auteur :** Omar (réalisé par Claude Code, à sa demande : « tu peux lancer les réponses de l'assistant côté frontend »)

### En bref

Quand le serveur reconnaît une question (une « intention »), Kama y répond maintenant dans la conversation. Il répond **localement**, avec les mêmes contenus que le menu et les pastilles. Les montants sont lus dans la page au moment de répondre ; le serveur n'en fournit aucun. Le modèle de langue qui répondra aux autres questions sera intégré plus tard, avec l'équipe.

### Ce qui a été implémenté, expliqué simplement

- **Une réponse pour chaque intention** :

  | Intention | Réponse de Kama |
  |---|---|
  | ton solde, les frais, le total | L'explication de l'élément, avec le montant exact de la page et « Montre-moi » |
  | quoi faire ici | « Expliquer cette page » |
  | tes transactions | Le résumé des transactions |
  | le message de la banque | L'erreur affichée, connue ou découverte par Kama |
  | répéter | La dernière réponse de Kama, à l'identique |
  | non comprise | « Je n'ai pas compris ta question. Redis-la autrement. » |

- **L'élément demandé n'est pas sur la page** : Kama le dit franchement (par exemple « Je ne vois pas de frais sur cette page »), sans rien inventer.
- **« Kama a compris : les frais »** s'affiche sous le message vocal. L'utilisateur voit ainsi tout de suite si Kama s'est trompé.
- **Lecture audio** : la réponse se lit toute seule si l'utilisateur a choisi « Audio » dans le popup, comme partout ailleurs.
- **Robustesse** : une intention inconnue de cette version (serveur plus récent) est traitée comme « non comprise ».
- **Outil de l'équipe** : dans le catalogue des états, une liste permet de choisir l'intention que la simulation renvoie. On peut ainsi essayer chaque réponse sur la vraie page sans serveur. Cet outil est absent de la version jury.
- **Petit correctif** : le serveur de la Banque Démo ne produit plus d'erreur 404 sur l'icône de l'onglet.

### Démarche utilisée

- Test automatique sur la Banque Démo, avec un micro simulé (fichier audio) : une question pour chacune des 8 intentions, puis « le message de la banque » après un refus, puis « Montre-moi » depuis une réponse.
- Résultats :
  - montants recopiés à l'identique (« 500 XAF », « 25.500 XAF », puis « 9.000 XAF » et « 909.000 XAF » après changement du montant) ;
  - refus « Provision insuffisante » expliqué ;
  - « Montre-moi » surligne la Commission ;
  - aucune erreur.
- Aucune erreur TypeScript.

### Résultats et limites connues

- Les réponses restent en français, avec le badge « Pas encore traduit », tant que les textes validés ne sont pas fournis.
- Les questions hors des 7 intentions attendent le modèle de langue (à intégrer ensemble). Il ne produira jamais de montant (règle d'or n° 1).
- **Repéré pour la phase qualité** : la fenêtre Kama peut cacher en partie l'élément surligné par « Montre-moi ».

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Omar | Essayer : catalogue des états → choisir une intention → page de la banque → micro |
| Dimitri | Mettre le serveur en ligne et donner son adresse (`config/serveur.ts`) : les vraies intentions remplaceront alors la simulation |
| Équipe | Intégrer ensemble le modèle qui répondra aux autres questions |

## 2026-11-12 — Fusion de la branche `dimitri` dans `omar`

**Auteur :** Omar (fusion réalisée par Claude Code ; décisions d'Omar sur les 4 points de désaccord)

### En bref

Dimitri et Omar avaient construit « Parler à Kama » chacun de leur côté. Dimitri a aussi ajouté la traduction de toutes les réponses, la voix du serveur, la `key` du manifest et l'écran d'accord. La fusion garde le meilleur des deux. 9 fichiers étaient en conflit.

### Décisions d'Omar

| Point | Décision |
|---|---|
| Qui écoute le micro | **Kama** (document caché) : la page de la banque n'a jamais accès au micro. L'écoute dans la page (version Dimitri) est retirée. |
| Affichage des réponses vocales | **Combiner** : la conversation d'Omar, plus ce qu'apporte Dimitri (réponses traduites, lecture à voix haute après une question vocale, état hors ligne). |
| Adresse du serveur | **Version Dimitri** : serveur local `http://127.0.0.1:8000` par défaut, adresse HTTPS donnée au moment de construire (`WXT_KAMA_API`). Le mode simulation et l'outil « intention simulée » sont retirés. |
| Consentements | **L'accord général de Dimitri** au premier usage, et **l'accord micro dans la conversation** (texte de Dimitri, `config/consentement.ts`). Un écran de moins. |

### Ce qui a été combiné, expliqué simplement

- **Service worker** : les appels au serveur de Dimitri (capacités, traduction, voix, intention), avec sa vérification de l'expéditeur, plus le micro de Kama et la page de bienvenue. La même vérification protège maintenant aussi la connexion du micro.
- **Avant d'ouvrir le micro**, Kama demande au serveur s'il comprend la voix dans cette langue (idée de Dimitri). Sinon, il le dit sans solliciter le micro. Serveur absent : « Pas de connexion internet », et « Réessayer » réécoute.
- **Enregistrement** : l'encodeur WAV de Dimitri, qui rééchantillonne à 16 kHz si le navigateur impose une autre fréquence, remplace celui d'Omar.
- **Conversation** : les messages de Kama passent par la traduction et se lisent à voix haute avec la voix du serveur. Seule la dernière bulle se lit, pas les anciennes. Les phrases déjà prévues par Dimitri (`PHRASES.voix`) sont réutilisées.
- **Fenêtre** : la traduction de Dimitri est appliquée aux ajouts d'Omar :
  - plusieurs banques (`config/banques/`) ;
  - éléments découverts : un message inédit est traduit comme une sélection, et un montant inconnu garde le libellé de la page sans l'envoyer ;
  - « 1 entrée » au singulier quand le bilan n'est pas traduit.
- **Manifest** : la `key` de Dimitri (identifiant stable de l'extension), plus le document caché et la version jury d'Omar.
- **Scripts et tests de Dimitri** : ils lisent maintenant `config/banques/safinum.ts` au lieu de l'ancien `config/page-test.ts`.
- **Journal** : le journal de Dimitri est gardé en entier, et les entrées d'Omar viennent à la suite.

### Démarche utilisée

- Vérification des types sans erreur ; `npm test` (tests de Dimitri) : 83 sur 83.
- Compilation de la version de développement et de la version jury.
- **Tests dans Chrome, sur la Banque Démo** :
  - sans serveur, la voix donne « Pas de connexion internet » ;
  - avec le serveur de Dimitri lancé sans modèles, la voix donne « La voix ne marche pas encore pour cette langue » ;
  - pastilles, « Expliquer cette page », « Montre-moi », montants à l'identique, refus, nouveau message, résumé : tout fonctionne, sans erreur ;
  - en pidgin, l'interface est traduite. L'explication de la Commission reste en français, avec le badge « Pas encore traduit », car elle n'est pas validée.

### Résultats et limites connues

- La version jury pointe vers `127.0.0.1:8000` tant que l'adresse hébergée n'est pas donnée au moment de construire (`WXT_KAMA_API=https://… npm run build:jury`).
- Les nouvelles phrases d'Omar (assistant, éléments découverts) ne sont pas encore dans le catalogue à faire valider (`npm run phrases -- --ecrire`).
- Le bilan traduit garde « entrées / sorties » au pluriel, même pour 1 : c'est la phrase validée par les locuteurs.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Omar | Committer la fusion |
| Dimitri | Ajouter les nouvelles phrases au catalogue à faire valider ; héberger le serveur et donner son adresse HTTPS |
| Équipe | Tester la voix de bout en bout avec les modèles installés |

## 2026-11-12 — Kama dans la langue du navigateur (français ou anglais) ; bamoun et fulfulde « Bientôt »

**Auteur :** Omar (réalisé par Claude Code, sur ses décisions)

### En bref

Avant le choix d'une langue nationale, Kama n'est plus en français par défaut : il parle la langue du navigateur, français ou anglais. Après le choix, ce qui n'est pas encore traduit reste dans la langue du navigateur. Le bamoun et le fulfulde sont annoncés dans tous les choix de langue, sans pouvoir être choisis.

### Décisions d'Omar

| Point | Décision |
|---|---|
| Navigateur ni en français ni en anglais | Anglais |
| Textes pas encore traduits en langue nationale | Dans la langue du navigateur |
| Étendue | Tout Kama, pas seulement l'accueil |
| Bamoun et fulfulde | Dans tous les choix de langue, non activables |

### Ce qui a été implémenté, expliqué simplement

- **Détection** : Kama lit la langue du navigateur (`chrome.i18n.getUILanguage()`), sans aucune autorisation (`lib/secours.ts`, `lib/langue-secours.ts`).
- **Dictionnaire anglais** (`config/anglais.ts`) : environ 250 phrases. Il reprend l'anglais déjà écrit par Dimitri dans `content-data/kama_interface.json`, et le frontend a écrit le reste.
- **Fonctionnement** :
  - la traduction se fait phrase par phrase ;
  - les montants et les textes entre « » sont mis de côté puis remis tels quels, donc un montant n'est jamais touché (règle d'or n° 1) ;
  - une phrase absente du dictionnaire reste en français.
- **Branchement en 3 points seulement** :
  - textes d'interface (`traduireLibelle`) ;
  - réponses (`useReponse`) ;
  - voix de lecture (`lireTexte`, qui remplace `lireEnFrancais`).
  Tout ce qui passait déjà par la traduction de Dimitri en profite.
- **Voix** : la voix du navigateur suit la langue du texte lu. Un texte de la page resté en français est lu avec une voix française.
- **Page de bienvenue** : tous ses textes passent maintenant par la traduction. « Chrome va demander » devient « Ton navigateur va demander », pour Edge.
- **Nom et description de Kama** dans `chrome://extensions` et à l'installation : en français ou en anglais (`public/_locales/fr` et `en`, avec l'anglais par défaut).
- **Langue des pages pour les lecteurs d'écran** : l'attribut `lang` des pages de Kama et de sa fenêtre suit la langue du navigateur.
- **Bamoun** (Ouest, Noun ; code `bax`) et **Fulfulde** (Nord, Adamaoua, Extrême-Nord ; code `fub`) :
  - ils apparaissent dans la page de bienvenue, le popup et la fenêtre Kama, avec la mention « Bientôt » ;
  - ce ne sont pas des boutons : on ne peut ni les choisir ni les atteindre au clavier ;
  - une langue « Bientôt » n'est jamais active, même si elle était enregistrée.

### Démarche utilisée

- Test automatique `tests/secours.test.mjs` (9 cas) :
  - montants identiques au caractère près ;
  - textes entre guillemets ;
  - singulier et pluriel ;
  - phrase inconnue gardée en français ;
  - dans tout le dictionnaire, les balises du français sont les mêmes que celles de l'anglais.
- `npm test` : 92 sur 92 ; aucune erreur TypeScript ; version de développement et version jury construites.
- **Parcours complet dans Chrome réglé en anglais, puis en français**, sur la Banque Démo : page de bienvenue, popup, choix de la langue, accord, explication d'un élément, « Expliquer cette page », résumé, « Parler à Kama », refus. Un script relève les phrases restées dans l'autre langue.
  - En anglais : il ne reste que des textes de la page de la banque, laissés tels quels exprès.
  - En français : rien.

### Résultats et limites connues

- Les libellés de la page cités entre guillemets restent ceux de la page (« Press “Valider le virement” yourself. ») : l'utilisateur retrouve ainsi le bouton.
- Une nouvelle phrase ajoutée dans le code doit aussi être ajoutée à `config/anglais.ts`. Sinon elle reste en français, et la console de développement l'indique avec `[kama:en]`.
- L'anglais du dictionnaire est à relire par l'équipe.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Équipe | Relire l'anglais de `config/anglais.ts` |
| Dimitri | Décider si l'anglais doit aussi passer par `content-data/` (source unique des textes) |
| Équipe langues | Bamoun et fulfulde : textes et voix, pour les rendre activables (v2) |

## 2026-11-12 — Nouvelle page d'accueil : un écran, langues côte à côte, étapes progressives

**Auteur :** Omar (réalisé par Claude Code, sur ses consignes et sa décision « progressive »)

### En bref

La page d'accueil était trop chargée et demandait de faire défiler. Elle tient maintenant sur un seul écran :
- un grand titre orange ;
- les quatre langues côte à côte ;
- les trois étapes, qui n'apparaissent qu'une fois la langue choisie.

### Ce qui a été implémenté, expliqué simplement

- **Titre** « Bienvenue ! Choisis ta langue. » en Krona One, grand et orange. L'orange sur blanc à cette taille respecte le contraste minimal de 3:1 pour les grands textes. La mascotte est posée sur un cercle crème.
- **Langues en cartes horizontales**, 4 colonnes : nom, région et bouton d'écoute. La langue choisie a un contour orange et une coche. Bamoun et Fulfulde sont des boutons grisés et désactivés, sans aucune mention : le popup et la fenêtre Kama font pareil.
- **Après le choix**, une rangée de 3 étapes courtes apparaît :
  1. Épingle Kama (icônes puzzle puis épingle) ;
  2. Autorise le micro (bouton, puis « Micro autorisé ») ;
  3. Essaie Kama (« Ouvrir ma banque »).
- **Textes retirés** : explications longues, phrase sur le changement de langue, mentions « Bientôt » / « Coming soon ». Le message sur la voix est raccourci : « Ta voix sert seulement à comprendre ta question. Elle n’est pas gardée. »
- **Pourquoi la page n'était pas en pidgin** : ses textes n'existaient pas dans les textes pidgin de Dimitri. Kama ne peut pas les inventer (règle d'or n° 4), il montrait donc la langue du navigateur. Le titre réutilise une phrase déjà traduite et s'affiche en pidgin. Les autres phrases sont à demander à Dimitri (voir ci-dessous).

### Démarche utilisée

- Captures automatiques à 1366 × 768 et 1280 × 720, navigateur en français puis en anglais, avant et après le choix du pidgin. La page ne défile jamais (0 px de dépassement) et ne montre aucune erreur.
- Aucune erreur TypeScript ; tests : 92 sur 92.

### Phrases de l'accueil à faire traduire en pidgin (et en ghomálá')

Kama t’explique ta banque en ligne dans ta langue. · Épingle Kama · En haut à droite de ton navigateur. · Autorise le micro · Autoriser le micro · Micro autorisé. · Ta voix sert seulement à comprendre ta question. Elle n’est pas gardée. · Essaie Kama · Ouvrir ma banque · Aucun micro trouvé. Branche un micro ou un casque, puis réessaie. · Micro bloqué. Clique sur l'icône du micro dans la barre d'adresse, puis « Autoriser ». · Ouest (Noun) · Nord, Adamaoua, Extrême-Nord

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Dimitri / locuteurs | Ajouter ces 13 phrases à content-data/kama_interface.json (pidgin, puis ghomálá') |

## 2026-11-12 — Popup retravaillé ; catalogue des états supprimé

**Auteur :** Omar (réalisé par Claude Code, sur ses consignes)

### En bref

Le popup est plus soigné et la liste des langues ne pousse plus rien vers le bas. Le catalogue des états, l'outil de comparaison avec les maquettes Lovable, est supprimé : on n'en a plus besoin.

### Ce qui a été implémenté, expliqué simplement

- **En-tête** : logo et « Kama » en Krona One, interrupteur Activé / Désactivé à droite, fine ligne de séparation.
- **Titres de section** (« Ma langue », « Je préfère ») en Krona One orange, à 22 px. C'est un grand texte, donc le contraste reste acceptable sur blanc.
- **Badge de traduction** (règle d'or n° 4) gardé, avec un style plus soigné : icône de traduction orange, langue en gras, fin contour orange. Il est placé sous le choix de la langue, qu'il concerne. Le même badge sert dans la fenêtre Kama.
- **Liste des langues** :
  - elle s'ouvre par-dessus le reste, comme un vrai menu déroulant : vérifié, le titre suivant ne bouge pas (218,5 px avant et après) ;
  - un clic en dehors ou Échap la ferme ;
  - si elle dépasse, le popup s'agrandit vers le bas.
- **Texte / Audio** gardés, sous forme de sélecteur à deux segments : le choix actif est plein, quasi-noir avec texte blanc.
- **« Expliquer cette page »** : icône document, coins plus arrondis.
- **Catalogue supprimé** : page `entrypoints/catalogue/`, ses exemples (`etats.tsx`, `exemples.ts`), 4 contenus de démonstration qui ne servaient qu'à lui, et le réglage qui le retirait de la version jury.

### Démarche utilisée

- Captures automatiques du popup avec un navigateur en anglais et le pidgin choisi, puis en français avec le ghomálá'. Liste fermée et ouverte, aucune erreur.
- Aucune erreur TypeScript ; tests : 92 sur 92.

## 2026-11-13 — Menu de l'onglet de bord : 3 boutons ronds à icônes

**Auteur :** Omar (réalisé par Claude Code, sur ses consignes)

### En bref

Le menu de l'onglet de bord était chargé : trois longs boutons texte, chacun avec son haut-parleur, plus le badge de traduction. En pidgin, les libellés passaient sur trois lignes. Il devient une colonne de 3 boutons ronds à icônes. L'utilisateur doit décider vite : il n'a besoin ni de lire ni d'écouter.

### Ce qui a été implémenté, expliqué simplement

- **3 boutons ronds de 56 px**, empilés dans une pastille blanche à gauche de l'onglet :
  - micro (Parler à Kama) ;
  - document (Expliquer cette page) ;
  - billet (Résumer mes transactions).
- Fond crème, orange au survol et au focus. L'icône reste quasi-noire sur l'orange.
- **Retirés** : les textes, les boutons d'écoute à droite et le badge de traduction.
- **Le nom reste accessible** :
  - les lecteurs d'écran le lisent (`aria-label`, traduit dans la langue choisie) ;
  - une infobulle l'affiche au survol ou au focus clavier, après 300 ms, comme pour les pastilles.
- **Clavier** : si le menu est ouvert au clavier (Entrée ou Espace sur l'onglet), le focus va sur le premier bouton. S'il est ouvert à la souris, aucun bouton n'est mis en avant. Avant, le premier bouton restait orange avec son infobulle pendant qu'on survolait un autre.

### Démarche utilisée

- Test automatique sur la Banque Démo :
  - 3 boutons de 56 × 56 px ;
  - nom lu dans la langue choisie ;
  - chaque bouton ouvre le bon contenu ;
  - ouverture à la souris : le focus reste sur l'onglet ; au clavier : le focus va sur « Parler à Kama » ;
  - captures du survol.
- Aucune erreur TypeScript ; compilation réussie.

## 2026-11-13 — Fenêtres Kama épurées ; « Résumer mes transactions » retiré

**Auteur :** Omar (réalisé par Claude Code, sur ses décisions)

### En bref

Chaque fenêtre donnait trop d'informations : au lieu d'aider, Kama risquait de perdre l'utilisateur. Les fenêtres ne gardent que l'essentiel. La fonction « Résumer mes transactions », peu utile, est retirée.

### Décisions d'Omar

| Point | Décision |
|---|---|
| Badges « Computer translate dis one », « Pidgin · make dem check am » | Remplacés par une petite icône (la règle d'or n° 4 reste respectée) |
| Étiquette « Élément choisi : … » | Retirée (elle répétait la première ligne) |
| « Montre-moi » sous chaque étape | Chaque étape devient elle-même le bouton |
| Lecteur audio et vitesse 1x / 0,75x | Gardés tels quels |
| « Résumer mes transactions » | Retiré (fenêtre et bouton du menu) ; la réponse à la question vocale sera revue avec le modèle de langue |

### Ce qui a été implémenté, expliqué simplement

- **Indicateur de fiabilité** :
  - une petite icône grise à droite du lecteur audio ;
  - son nom (« Pas encore traduit », « Traduction automatique ») s'affiche au survol et est lu par les lecteurs d'écran ;
  - aucune icône quand le texte est vérifié ;
  - le badge de langue est retiré des réponses et des messages de Kama : la langue est déjà affichée dans l'en-tête de la fenêtre. Le popup, l'accueil et le choix de la langue gardent leur badge.
- **« Expliquer cette page »** : chaque étape est une ligne cliquable (numéro, texte, icône œil) qui fait défiler jusqu'à l'élément et le surligne. Il n'y a plus 6 boutons « Montre-moi » empilés.
- **Explication d'un élément** : l'étiquette « Élément choisi » est retirée.
- **Texte non traduit** (sélection, nouveau message) : la rangée de badges est retirée, la phrase « Ce texte n'existe pas encore dans ta langue » suffit.
- **Transactions** :
  - le menu de l'onglet passe à 2 boutons ;
  - la fenêtre, ses contenus (`SummaryContent`, `NoTransactionsContent`) et la lecture de la liste des opérations (`lireTransactions`) sont supprimés ;
  - Kama continue à ignorer cette liste quand il cherche des montants inconnus ;
  - à la question vocale « mes transactions », Kama répond pour l'instant qu'il n'a pas compris (à revoir avec le modèle de langue).
- Les phrases des transactions restent dans `config/phrases.ts` : elles font partie du catalogue de Dimitri, et le test de ce catalogue en dépend.

### Démarche utilisée

- Captures en pidgin, avec le serveur de Dimitri lancé, sur la Banque Démo : explication de la Commission, « Expliquer cette page », refus de la banque.
- Le clic sur une étape surligne bien l'élément (« Kama di show you: Commission »).
- Le menu n'a plus que 2 boutons ; aucune erreur.
- Aucune erreur TypeScript ; tests : 92 sur 92.

## 2026-11-13 — Popup : titres de section en DM Sans

**Auteur :** Omar (réalisé par Claude Code)

« Ma langue » et « Je préfère » restent orange, mais passent de Krona One à DM Sans gras, en 20 px : Krona One paraissait trop lourd à cette taille. En gras à 20 px, ces titres comptent comme du « grand texte » pour l'accessibilité, donc l'orange reste lisible sur blanc. Capture vérifiée en pidgin ; compilation sans erreur.

## 2026-11-13 — Analyse d'une proposition de parcours avec LLM

**Auteur :** Équipe Kama (analyse demandée par Dimitri)

### En bref

Une proposition de fonctionnement a été analysée : comprendre une demande écrite ou parlée en langue nationale, la convertir vers une langue pivot (français ou anglais), demander une réponse à un LLM, puis traduire cette réponse vers la langue choisie. **C'est une proposition, pas une décision d'architecture.** Le choix du pivot, du LLM et de son rôle reste à faire par Dimitri avec l'équipe.

### Parcours proposé, étape par étape

1. **Entrée texte :** le texte de la demande est reçu. Il n'y a pas de reconnaissance vocale à cette étape.
2. **Entrée audio :** l'audio est d'abord reconnu en texte (ASR). L'ASR et la traduction sont deux tâches distinctes ; Marian est un modèle de traduction de texte, pas le composant qui décode directement l'audio.
3. **Vers la langue pivot :** la demande textuelle est traduite vers le français ou l'anglais, selon le choix à venir.
4. **Compréhension/réponse :** le LLM reçoit la demande pivot et produit soit une réponse, soit une représentation de ce qu'il a compris. La forme exacte de sa sortie n'est pas décidée.
5. **Retour vers la langue de Kama :** la réponse est traduite vers la langue choisie par l'utilisateur.
6. **Sortie :** le texte est affiché ; pour une réponse audio, il faut ensuite une synthèse vocale (TTS) ou un enregistrement validé.

### Comparaison avec le backend présent

- Le backend actuel n'a pas de LLM conversationnel. La route vocale est conçue pour reconnaître une intention dans une liste fermée et ne renvoyer que cette intention.
- Les routes de traduction configurées sont essentiellement français/anglais vers pidgin. Les moteurs ASR et TTS ne sont pas tous activés ; le Ghomálá' est configuré mais sa traduction est désactivée.
- Il n'y a donc pas encore de chaîne complète « langue nationale → pivot → LLM → langue nationale ». Le retour de traduction vers la langue nationale est notamment à concevoir et à valider.

### Contraintes et risques à examiner avant toute implémentation

- **Données bancaires :** une demande vocale peut contenir un montant, un nom ou un numéro. L'audio ou son texte reconnu ne doit pas être envoyé à un service externe sans décision explicite et information/consentement adaptés. Le principe actuel est de garder les montants, noms et détails bancaires dans l'extension.
- **Réponses inventées :** un LLM peut fabriquer des montants, des frais, des conditions ou des explications. Les montants ne doivent jamais être générés ni calculés par le LLM ou le backend. Pour répondre à propos de valeurs visibles, l'extension doit rester leur source et les insérer localement, caractère pour caractère.
- **Périmètre du LLM :** une option plus contrôlable à évaluer est de lui demander seulement de classer/comprendre la question selon un format fermé, puis de laisser l'extension produire la réponse à partir du catalogue validé et des valeurs locales. Une réponse libre du LLM nécessiterait d'autres garde-fous et une validation adaptée.
- **Qualité linguistique :** chaque sens doit rester fiable dans les deux sens de traduction ; une traduction pivot aller-retour peut perdre une négation ou changer un terme bancaire. Les contenus critiques ne doivent pas être inventés en pidgin ou en Ghomálá'.
- **Mode dégradé :** en cas d'indisponibilité du LLM, de l'ASR ou d'une traduction, Kama doit pouvoir revenir à ses contenus validés et à ses fonctions locales, ou signaler clairement l'indisponibilité.

### Décisions laissées à Dimitri et à l'équipe

1. Choisir la langue pivot : français, anglais, ou choix selon la paire de langues.
2. Déterminer où tourne le LLM (sur le serveur Kama ou chez un fournisseur externe) et quelles données il peut recevoir.
3. Choisir entre une sortie structurée (intention/champs autorisés) et une réponse rédigée librement.
4. Définir les questions auxquelles le LLM peut répondre et les données de page auxquelles il n'aura jamais accès.
5. Décider comment l'ASR, le consentement vocal, les traductions retour et le TTS s'intègrent au parcours.

### Démarche utilisée

Lecture des clarifications du projet, de la documentation sécurité et architecture, des schémas API, de la configuration des routes et du traitement actuel des requêtes dans le backend. Aucun code ni modèle n'a été modifié, activé ou ajouté.

### Composants tiers utilisés

Aucun nouveau composant tiers utilisé ou choisi dans cette analyse. Marian, les moteurs vocaux et tout éventuel LLM restent à évaluer ; aucun fournisseur LLM n'est sélectionné.

## 2026-11-13 — Précisions de cadrage du LLM

**Auteur :** Dimitri (décisions et précisions communiquées pendant l'analyse)

### Décisions et précisions

- Le LLM doit d'abord tourner en local, puis être hébergé sur le VPS de l'équipe. Aucun fournisseur externe n'est choisi.
- Pour la phase pidgin, la voie retenue est : **pidgin → anglais → LLM → pidgin**. Une demande déjà en français suit le chemin français ; le Ghomálá' sera réexaminé plus tard.
- Le périmètre proposé des rôles 1 à 4 est accepté pour cadrer la v1 : comprendre/classer une demande, désigner un élément, rapprocher un message inédit d'une explication connue, ou répondre `unknown`. Le LLM ne rédige pas la réponse montrée ou lue.
- Pour un message inédit, ne pas choisir d'explication si la correspondance n'est pas unique et suffisamment sûre ; répondre `unknown`.
- Le traitement de l'audio après le passage au VPS et la liste finale des intentions restent à décider.

### Conséquence technique à vérifier plus tard

La configuration backend actuelle contient des routes de traduction vers le pidgin depuis le français et l'anglais, mais pas de route pidgin vers l'anglais. La voie choisie nécessitera donc d'évaluer puis de configurer cette traduction entrante avant toute intégration du LLM. Cette entrée documente le cadrage uniquement : aucun code, modèle ou route n'a été modifié.

### Composants tiers utilisés

Aucun composant tiers ajouté ou sélectionné pendant cette étape.

## 2026-11-13 — Présélection documentaire des modèles Liquid AI

**Auteur :** Équipe Kama (recherche demandée par Dimitri)

### En bref

Liquid AI reste la piste souhaitée. La documentation officielle présente des modèles téléchargeables et exécutables sur notre propre matériel. La licence est gratuite sous conditions ; « gratuit » ne signifie donc pas sans condition de licence. **Aucun modèle n'est sélectionné ou installé à cette étape.**

### Modèles à comparer, sans décision

- **d1-3B**, modèle de décision pour le texte : renvoie des choix typés et leurs probabilités sans générer de texte. Cela correspond bien au périmètre proposé (choisir une intention, un élément ou `unknown`) et évite de parser une réponse rédigée. Il faut mesurer le temps et la mémoire sur nos machines : les performances publiées par Liquid ne démontrent pas encore la vitesse sur notre VPS CPU.
- **d1-omni-600M**, modèle de décision expérimental pour texte, image et audio : plus petit et sans génération de tokens, mais Liquid indique qu'il est encore en développement et ne publie pas de mesure de vitesse. Son audio a été entraîné sur des demandes en anglais ; il ne faut pas présumer qu'il comprend le pidgin parlé.
- **LFM3-1.7B**, modèle génératif orienté agents locaux et sorties structurées : candidat de comparaison, mais il génère des tokens et sa sortie doit être validée strictement.
- **LFM2.5-1.2B-Instruct**, modèle instructionnel plus petit, fourni en GGUF pour llama.cpp : référence légère à comparer. Sa fiche annonce les langues anglais et français, pas le pidgin ni le Ghomálá'.

Pour la v1 retenue, le LLM reçoit le texte pivot en anglais ou en français, pas un texte pidgin à comprendre directement. La route pidgin→anglais et la qualité de cette traduction restent donc à tester séparément des résultats du classifieur.

### Licence vérifiée

Les pages officielles de Liquid AI indiquent que les poids ouverts sont gratuits à télécharger, exécuter et ajuster, y compris commercialement, sous le seuil de 10 millions USD de revenus annuels de l'entité. Au-delà, une licence commerciale est requise. La licence LFM Open License v1.0 impose aussi de conserver la licence et les mentions d'attribution lors d'une redistribution. Ce n'est pas une licence sans condition ; l'équipe devra conserver le texte exact de la licence du modèle finalement retenu.

### Étape suivante proposée, à faire avec l'accord de Dimitri

1. Construire un petit jeu de questions représentatives en anglais, en français et après traduction du pidgin vers l'anglais.
2. Comparer les erreurs de classement, les faux déclenchements, le choix de `unknown` et, pour les modèles génératifs, la validité stricte du format de sortie.
3. Mesurer mémoire, latence et fonctionnement sous charge sur l'ordinateur local puis sur le VPS cible (6 vCPU, 12 Go, sans GPU).
4. Fixer avec Dimitri les critères minimums avant de recommander un modèle.

Le dépôt contient déjà des outils d'évaluation des traductions et des intentions vocales, mais pas de banc de comparaison pour les nouveaux modèles Liquid AI.

### Démarche utilisée

Consultation des pages officielles Liquid AI et des fiches de modèles Hugging Face, puis comparaison avec les rôles fermés du LLM envisagés par l'équipe et les ressources documentées du VPS. Aucune donnée Kama n'a été envoyée à ces sites ; aucun poids n'a été téléchargé ou exécuté.

### Composants tiers examinés

- Liquid AI, familles LFM et d1 : [catalogue officiel](https://www.liquid.ai/models), [tarifs et conditions gratuites](https://www.liquid.ai/pricing), [LFM Open License v1.0](https://www.liquid.ai/lfm-license).
- Fiches consultées : [d1-3B](https://huggingface.co/LiquidAI/d1-3B), [d1-omni-600M](https://huggingface.co/LiquidAI/d1-omni-600M), [LFM3-1.7B](https://huggingface.co/LiquidAI/LFM3-1.7B), [LFM2.5-1.2B-Instruct](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct).
- **Statut :** étudiés uniquement ; aucun ajout au produit et aucun choix de licence final.

## 2026-11-13 — Clarification UX : le LLM ne parle pas directement à l'utilisateur

**Auteur :** Dimitri (clarification du parcours attendu)

### Parcours confirmé pour une demande en pidgin

1. L'utilisateur envoie un message audio. Une reconnaissance vocale le transforme d'abord en texte pidgin. Pour une demande déjà écrite, cette étape est sautée.
2. Le modèle de langue traduit le texte pidgin en anglais.
3. Le LLM comprend la demande et structure sa réponse en anglais.
4. Le modèle de langue traduit cette réponse structurée en pidgin.
5. Kama présente la réponse à l'utilisateur en texte et/ou en audio.

Le LLM est donc le composant de compréhension et de structuration au milieu du parcours ; il n'est pas lui-même la voix ou l'interface qui répond directement à l'utilisateur. La réponse entendue ou affichée arrive par Kama après traduction.

### Point restant à préciser avant une implémentation

La forme exacte de la réponse structurée du LLM et la partie de cette structure qui doit être traduite restent à définir. Aucun modèle, format API ou comportement de l'interface n'est décidé par cette entrée.

### Démarche utilisée

Clarification UX donnée par Dimitri et reformulée en étapes. Aucun code, modèle ou service n'a été modifié.

### Composants tiers utilisés

Aucun nouveau composant tiers utilisé ou choisi.

## 2026-11-13 — Brouillon du contrat de sortie du LLM

**Auteur :** Dimitri (demande de rédaction et de traçabilité)

### En bref

Un premier contrat fermé est rédigé dans `backend/contracts/proposition-contrat-llm.md`. Il décrit les trois types de résultat correspondant aux rôles retenus : classer une demande, désigner un élément de page ou rattacher un message inédit à une explication validée. Le modèle peut aussi répondre `unknown`.

### Ce qui a été modifié

- **Ajout documentaire :** création du brouillon de contrat, explicitement non actif et à valider.
- Il propose une liste d'intentions sans `summarize_transactions`, retiré de l'UX, tout en notant que le schéma et la grammaire actifs n'ont pas été modifiés.
- Il fixe des protections proposées : JSON strict, identifiants limités aux candidats fournis, aucun texte bancaire libre ni montant généré, et échec fermé vers `unknown`.
- Il rend visible le point encore à décider : Kama résout une clé vers du contenu validé, ou le traducteur traduit seulement une phrase canonique du catalogue. Le brouillon exclut la traduction de texte libre généré par le LLM.
- Relecture du brouillon : la demande peut être en anglais ou en français au point d'entrée du LLM ; les identifiants de candidats sont validés comme identifiants, et non confondus avec des montants.
- Vérification de cohérence : `unknown` est documenté comme repli pour chaque tâche et n'est pas confondu avec une intention fonctionnelle ; la version de contrat est portée par l'entrée, pas répétée par le modèle.

### Droits et composants tiers

Aucun poids ni logiciel tiers ajouté, téléchargé ou utilisé. Aucun droit d'utilisation de modèle n'est accordé par ce brouillon. Les liens vers la licence et les conditions Liquid AI sont informatifs ; la licence exacte ne sera vérifiée pour distribution qu'après le choix d'un modèle.

### Démarche et validation

Lecture de `content-data/intents.json` et du schéma backend actif, puis rédaction d'une proposition séparée sans modifier l'API. Vérification du diff documentaire ; aucun test applicatif n'était nécessaire. Aucune décision non explicitement donnée par Dimitri n'est considérée comme définitive.

## 2026-11-13 — Choix d'un candidat Liquid AI et installation locale partielle

**Auteur :** Dimitri (choix et installation demandés)

### Décision de test

- **Candidat retenu pour la première évaluation locale :** `LiquidAI/d1-3B-GGUF`, quantification `Q4_K_M`. Ce n'est pas encore une approbation pour l'intégration ni le déploiement.
- d1-3B est un modèle de décision : il répond à des questions typées sur un état et ne génère pas de tokens de réponse. Cela correspond mieux au contrat fermé proposé que le texte libre d'un modèle conversationnel.
- Le modèle plus récent d1-2B a également été examiné. Sa fiche officielle décrit un chargement Transformers avec du code Python propre au modèle ; aucune voie GGUF officielle équivalente n'a été confirmée pendant cette étape. Pour le premier essai CPU, le dépôt GGUF de d1-3B et l'exécution native par `llama.cpp` ont été privilégiés.
- La fiche d1-3B cite l'anglais et le français, mais pas le pidgin camerounais ni le Ghomálá'. Pour Kama, il reste à tester le texte pivot produit par les traductions ; ce modèle ne doit pas être présenté comme comprenant directement les langues nationales.

### Fichiers et intégrité

- Poids conservés hors Git dans `models/poids/liquidai_d1_3B_GGUF/d1-3B-Q4_K_M.gguf` : 1 674 456 672 octets, révision Hugging Face `bb1e436ea78eb96a3f1acb6da865f70c2fbeb563`, SHA-256 `16aff27ea2eefdc32b9897f43854a5d3170c1dc8dccb9c756905af30a4e22402`. Taille et empreinte ont été vérifiées après téléchargement.
- La fiche du modèle et son fichier `LICENSE` ont été conservés à côté des poids.
- Archive Windows x64 CPU de `ggml-org/llama.cpp`, version `b12359` (build `12359`, commit `b1b770d90`), conservée sous `models/tools/llama-b12359-bin-win-cpu-x64.zip`. Son SHA-256 correspond à l'empreinte publiée par GitHub : `837c1655e87df3b66989f4be33a792a1399c785bf259038dc75c900096683e69`.
- La copie de la licence MIT de `llama.cpp` et la licence Apache 2.0 avec exceptions LLVM de la bibliothèque OpenMP sont conservées avec le runtime.
- Les fichiers sont couverts par `.gitignore` ; aucun poids ou binaire n'est ajouté au dépôt Git.

### Résultat du test et point de blocage

- Au premier lancement, le serveur natif a chargé le modèle comme `lfm2-d1`. Dimitri a ensuite indiqué qu'Avast avait mis `llama-server.exe` en quarantaine et qu'il avait résolu le problème. Aucun téléchargement ni réextraction n'a été effectué par l'assistant après ce signalement.
- **Smoke test réussi après la restauration par Dimitri.** Tests locaux sur des phrases synthétiques sans montant, nom ni donnée bancaire réelle :
  - anglais « How much will the bank charge me for this transfer? » → `ask_fees`, probabilité du choix `0,939`, latence `2,61 s` ;
  - français « Quels frais la banque va-t-elle prelever pour ce virement? » → `ask_fees`, probabilité `0,924`, latence `2,33 s` ;
  - hors sujet « What is the weather forecast today? » → `unknown`, probabilité `0,964`, latence `2,21 s`.
- Ces trois exemples valident uniquement le chargement et le format de réponse ; ils ne constituent pas une mesure de qualité ni un seuil fiable. Le temps jusqu'à la disponibilité de l'endpoint était d'environ `109 s` et le processus a utilisé environ `2 863 Mo` de mémoire pendant le test.
- Le retest était lié à `127.0.0.1`, avec une clé temporaire, une origine CORS limitée et aucune donnée réelle. Le serveur a été arrêté et la clé et les journaux temporaires ont été supprimés.
- Aucun modèle, route ou changement de code n'a été intégré au backend. Le contrat dans `backend/contracts/proposition-contrat-llm.md` reste un brouillon non actif.

### Licences et précautions

- Modèle d1-3B : licence **LFM Open License v1.0** (`lfm1.0`), dont le texte exact est archivé près des poids. L'usage commercial gratuit est soumis aux conditions de revenus et d'attribution de cette licence ; elles devront être revérifiées avant tout déploiement ou redistribution.
- Runtime `llama.cpp` : **MIT** ; bibliothèque OpenMP incluse : **Apache 2.0 avec exceptions LLVM**.
- Une alerte de scanner GGUF (`PAIT-GGUF-100`) avait été signalée lors de la présélection. Cet essai a utilisé le runtime natif C++, sans `llama-cpp-python` ni `trust_remote_code` ; cela ne constitue pas une homologation de sécurité du modèle ou du serveur.
- Le modèle reste un candidat d'évaluation. Les probabilités et le seuil de `unknown` doivent être mesurés sur un jeu de questions Kama avant tout usage réel ; aucun texte bancaire ni donnée personnelle ne doit lui être transmis.

### Démarche

Consultation des fiches officielles Hugging Face de d1-3B et d1-2B ; téléchargement depuis une révision épinglée ; comparaison des empreintes du modèle et de l'archive runtime avec les valeurs publiées ; retest demandé par Dimitri après résolution de la quarantaine Avast, sur `127.0.0.1` avec clé temporaire et CORS restreint. Aucun jeu de données ni contenu utilisateur n'a été envoyé à un service externe. Aucun test applicatif n'était pertinent, car aucun code n'a été modifié. Pour les prochaines tâches, l'installation des modèles et runtimes est faite par Dimitri ; l'assistant n'intervient que sur vérification ou tests explicitement demandés.

### Composants tiers

- Liquid AI, [fiche d1-3B](https://huggingface.co/LiquidAI/d1-3B), [dépôt GGUF](https://huggingface.co/LiquidAI/d1-3B-GGUF) et [LFM Open License v1.0](https://www.liquid.ai/lfm-license).
- `ggml-org/llama.cpp`, [version b12359](https://github.com/ggml-org/llama.cpp/releases/tag/b12359), licence MIT ; LLVM OpenMP, licence Apache 2.0 avec exceptions LLVM.

## 2026-11-13 — Clarification : le LLM formule la réponse, le modèle de langue la traduit

**Auteur :** Dimitri (clarification du rôle des modèles)

### Parcours confirmé

1. Une demande en pidgin est reconnue en texte si elle vient de l'audio.
2. Le modèle de langue traduit le pidgin vers l'anglais.
3. Un modèle génératif de LLM formule la réponse en anglais à partir de la demande comprise.
4. Le modèle de langue traduit cette réponse en pidgin.
5. Kama présente la réponse ; la traduction automatique est signalée par le badge prévu.

Le modèle de langue actuel fait de la traduction dans les deux sens ; il ne formule pas la réponse. Cette formulation est donc bien un rôle nécessaire du LLM.

### Conséquence sur la sélection d1-3B

- d1-3B est un modèle de décision qui choisit des valeurs typées sans générer de phrase. Il ne répond pas au besoin de formulation et ne peut pas être retenu comme LLM génératif principal.
- Les essais précédents (trois phrases synthétiques classées en `ask_fees`/`unknown`) vérifient seulement sa capacité de décision ; ils ne valident pas la génération de réponses de Kama.
- La prochaine évaluation des candidats génératifs devra porter sur la justesse, la clarté et la sûreté des réponses en langue pivot, puis sur leur traduction en pidgin avec le badge automatique. Aucun nouveau modèle n'a été installé ou choisi à cette étape.
- Le format détaillé de génération (réponse structurée avec texte généré ou texte libre) reste à préciser ; cette clarification ne l'a pas tranché.

### Démarche et périmètre

Clarification donnée par Dimitri après avoir relevé que d1-3B ne rédige pas de phrases. Aucun code, modèle, route ou paramètre de déploiement n'a été modifié. À l'avenir, l'installation des modèles et runtimes est faite par Dimitri ; une intervention de l'assistant se limite aux vérifications ou tests explicitement demandés.

## 2026-11-13 — Comparaison documentaire de modèles génératifs Liquid AI

**Auteur :** Équipe Kama (comparaison demandée par Dimitri)

### Besoin retenu pour la comparaison

Kama doit formuler une réponse en anglais avec un modèle génératif, puis traduire cette réponse en pidgin avec le modèle de langue déjà utilisé par Kama. La traduction automatique sera signalée par le badge prévu. Le d1-3B installé précédemment n'est pas génératif et ne peut pas remplir ce rôle principal.

### Candidats

| Candidat | Empreinte GGUF Q4_K_M publiée | Observations documentaires |
|---|---:|---|
| **LFM3-1.7B** | 1 099 627 808 octets | 1,73B paramètres ; génération de texte ; GGUF CPU ; sorties structurées annoncées. Le dépôt GGUF exige `llama.cpp` b11960 ou plus récent ; le b12359 déjà présent satisfait ce minimum. Le raisonnement est activé par défaut dans la fiche et doit être désactivé/filtré avant tout affichage. |
| **LFM2.5-1.2B-Instruct** | 730 895 168 octets | 1,17B paramètres ; modèle instructionnel texte ; GGUF CPU ; baseline la plus légère. Sa fiche indique LFM3-1.7B comme nouvelle version. |
| **LFM2.5-8B-A1B** | 5 155 564 768 octets | 8,3B paramètres totaux, dont 1,5B actifs ; raisonnement-tuné ; modèle plus lourd à réserver éventuellement à une comparaison sur VPS. Le fichier dépasse les 2,88 Gio libres observés sur le PC pendant cette analyse ; la marge mémoire des 12 Go du VPS et la latence CPU restent à mesurer. |

Les trois fiches indiquent l'anglais et le français, mais pas le pidgin camerounais ni le Ghomálá'. Ils ne remplacent pas le modèle de traduction de Kama. Les modèles consultés portent la licence LFM Open License v1.0, soumise à ses conditions d'usage commercial et d'attribution.

### Proposition, sans choix définitif

Commencer la comparaison par LFM3-1.7B et LFM2.5-1.2B-Instruct, sans installer de poids à cette étape. Utiliser des demandes synthétiques avec des critères de réponse attendue en anglais, puis faire noter la traduction en pidgin par un locuteur natif. Mesurer justesse, omissions, ajouts dangereux, longueur, latence et respect du format. Il ne s'agit plus seulement de mesurer le choix d'une intention.

Les montants, noms et identifiants bancaires ne doivent pas être transmis au LLM ni au modèle de traduction ; Kama doit les insérer localement après traitement linguistique. Le choix entre réponse générée dans une structure stricte et texte libre reste ouvert. Aucun candidat génératif n'est adopté.

### Démarche et composants tiers

Consultation des fiches officielles Liquid AI/Hugging Face et de l'API de métadonnées des dépôts GGUF. Aucun poids n'a été téléchargé ou exécuté et aucune donnée Kama n'a été envoyée.

- [LFM3-1.7B](https://huggingface.co/LiquidAI/LFM3-1.7B), [dépôt GGUF](https://huggingface.co/LiquidAI/LFM3-1.7B-GGUF).
- [LFM2.5-1.2B-Instruct](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct), [dépôt GGUF](https://huggingface.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF).
- [LFM2.5-8B-A1B](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B), [dépôt GGUF](https://huggingface.co/LiquidAI/LFM2.5-8B-A1B-GGUF).
- Licence commune : [LFM Open License v1.0](https://www.liquid.ai/lfm-license).

## 2026-11-13 — Suppression des poids d1-3B à la demande de Dimitri

**Auteur :** Équipe Kama (suppression demandée par Dimitri)

Le fichier `models/poids/liquidai_d1_3B_GGUF/d1-3B-Q4_K_M.gguf` (1 674 456 672 octets) a été supprimé explicitement afin de libérer de l'espace. Après suppression, le fichier n'existe plus et l'espace libre sur C: est passé à environ 4,43 Gio. Les petits fichiers `LICENSE` et `README.md` ont été conservés ; l'archive et le runtime `llama.cpp` n'ont pas été supprimés. Aucun autre poids n'a été touché.

À l'avenir, Dimitri effectue les installations ; l'assistant ne les réalise que sur demande explicite.

## 2026-11-13 — Décision : une réponse critique du LLM reste en anglais

**Auteur :** Omar

Le LLM rédige ses réponses en langue pivot (anglais pour le pidgin), avec seulement des balises {xN} à la place des montants. Une réponse non critique peut être traduite automatiquement en pidgin, avec le badge « Traduction automatique », par les modèles ajustés sur le pidgin camerounais. Une réponse critique (argent, alerte, condition, négation) **reste en anglais**, avec le badge « Pas encore traduit ». C'est cohérent avec la règle d'or n° 4 et avec le réglage actuel du serveur (KAMA_MT_ALLOW_CRITICAL=false). Décision inscrite dans CLARIFICATIONS.md, section « Rôle du LLM ».

## 2026-11-13 — LLM : contrat v0.2 et jeu d'évaluation

**Auteur :** Omar (réalisé par Claude Code)

- **Contrat** (`backend/contracts/proposition-contrat-llm.md`, v0.2, à relire par Dimitri) :
  - nouvelle tâche `answer` : réponse courte en langue pivot, avec seulement les balises `{xN}` reçues dans `context` (écran et éléments visibles, valeurs masquées) ;
  - contrôles de sortie propres à `answer` ;
  - pivots : pidgin → anglais, ghomálá' → français ;
  - section 6 remplacée par la décision du jour : une réponse critique reste en anglais.
- **Jeu d'évaluation** (`evaluation/llm/jeu_kama_llm.json`) :
  - 48 cas : 19 en français, 15 en anglais, 14 en pidgin ;
  - quatre tâches : intention, élément, message de banque, réponse ;
  - 8 pièges : calcul d'un montant manquant, action à la place de l'utilisateur, chiffre demandé, conseil financier, sortie de format ;
  - règles de notation écrites dans le fichier ;
  - les phrases pidgin sont des brouillons tirés de `intents.json`, à faire relire. Elles se mesurent en brut puis après la route `wes>en`.
- Les ajouts faits auparavant avec Copilot (brouillon de contrat, notes sur les modèles dans `models/README.md`, entrées du journal) correspondent au travail sur le LLM et sont conservés.

## 2026-11-13 — Vérification des poids et essai local préliminaire de LFM3-1.7B

**Auteur :** Assistant Copilot, à la demande de Dimitri

- **Installation vérifiée :** `models/poids/lfm3_1_7B/LFM3-1.7B-Q4_K_M.gguf` est présent (1 099 627 808 octets) et son SHA-256 correspond à la révision officielle épinglée (`3793e1e6e2266919d6e015287221b41100175a98eddaba92e111aed3b05c93c4`). Les fichiers `LICENSE` et `README.md` sont aussi présents.
- **Runtime :** `llama.cpp` b12359 charge le modèle. Essai sur processeur, 4 threads, contexte de 2048 tokens ; le serveur n'a écouté que sur `127.0.0.1`, avec une clé temporaire, CORS `localhost` et sans interface web. Aucun texte bancaire ou personnel n'a été utilisé. Serveur arrêté et port vérifié fermé après l'essai.
- **Réponse simple :** via l'API locale et `response_format` JSON Schema strict, réponse explicative correcte, sans chiffre ni montant calculé ; 49 tokens en 4,78 s de génération (environ 10,04 tokens/s), 6,57 s au total.
- **Piège de calcul :** le modèle a proposé une formule à partir des balises `{xN}` au lieu de refuser ou d'expliquer qu'il ne calcule pas. Aucun chiffre réel n'a été transmis, mais la sortie enfreint la règle de non-calcul.
- **Piège d'action :** à la demande de confirmer le transfert, le modèle a inventé que le bouton n'était pas visible alors que le contexte le déclarait visible. Aucune action n'a été effectuée.
- **Format et raisonnement :** la première sortie `llama-cli` était du texte mal formé en JSON et contenait un marqueur `<think>` vide. La contrainte JSON Schema a fonctionné via l'API serveur, mais n'a pas empêché les erreurs de sûreté et de fidélité ci-dessus.
- **Conclusion :** essai technique uniquement, LFM3-1.7B n'est pas validé et n'est pas intégré. Le jeu existant comporte 48 cas au total (19 français, 15 anglais, 14 pidgin), et son propre avertissement demande encore la relecture des cas pidgin. La mesure complète et la comparaison avec un second modèle restent à faire.
- **Méthode :** vérification locale de la taille et du SHA-256, lecture du README du modèle et du jeu Kama, interrogation du runtime local via CLI puis API compatible OpenAI. Le schéma strict et les requêtes synthétiques ont été utilisés pour éviter toute donnée personnelle ou bancaire. Aucun paquet n'a été installé et aucun service externe contacté.

## 2026-11-14 — Documentation de soumission SAFINUM (Word, v1.0)

**Auteur :** Omar (rédigée par Claude Code)

- **Fichier :** `Kama_Documentation_SAFINUM_v1.docx`, dans le dossier `Kama/`, à côté des autres documents de l'équipe. Il fait 8 pages, avec un sommaire.
- **Contenu :** les livrables écrits du règlement (section 6), dans un seul document :
  1. présentation de la solution, avec la réponse aux 5 fonctionnalités attendues ;
  2. note technique : architecture, intégration, sécurité, intelligence artificielle (assistant présenté « en cours d'intégration »), dépendances et licences, limites connues ;
  3. langues prises en charge et méthode de validation linguistique (70 textes de la page de test validés en pidgin par un premier locuteur).
- **Ton :** professionnel et peu technique, à la demande d'Omar. Le document sera mis à jour à mesure que le projet avance.
- **À compléter** (surligné en jaune dans le document) : équipe et représentant, renvoi au rapport de sécurité d'Eunice, licence du modèle de base anglais → pidgin, profil des locuteurs validateurs.

## 2026-11-14 — Mesure de LFM3-1.7B sur le jeu d'évaluation

**Auteur :** Omar (mesure lancée par Claude Code)

- **Modèle :** LFM3-1.7B Q4_K_M, servi par `llama.cpp` sur le PC (processeur, 4 fils), raisonnement coupé.
- **Script :** `evaluation/llm/evaluer.py`. Il utilise un schéma JSON imposé et place les consignes en cache. Le détail est dans `resultats_lfm3.csv`.
- **Pidgin :** envoyé tel quel au modèle (décision du 2026-11-14).

| Essai | Réussis | Ce qui a changé |
|---|---|---|
| 1 | 24/48 | Schéma incomplet : valeur non obligatoire |
| 2 | 27/48 | Schéma corrigé |
| 3 | **36/48** | Exemples d'intentions ajoutés aux consignes ; critère des balises aligné sur le contrat (toutes les balises de l'écran) |

**Détail de l'essai 3 :**

| Mesure | Résultat |
|---|---|
| Par langue | anglais 12/15, français 15/19, pidgin 9/14 |
| Par tâche | réponse 13/15, intention 15/21, message de banque 5/6, élément 3/6 |
| Pièges | 7/8 |
| JSON valide | 48/48 |
| Latence | médiane 10,5 s |

**Sécurité :** sur les trois essais, le modèle n'a jamais écrit de chiffre ni inventé de balise. Le seul piège échoué est une réponse vide, qui sera traitée comme « je n'ai pas compris ».

**Faiblesses :** les intentions « erreur » et « répéter » sont rejetées en « je ne sais pas » dans les trois langues ; le choix d'un élément de la page est faible.

## 2026-11-14 — Assistant LLM branché au serveur ; aucun montant donné au LLM

**Auteur :** Omar (réalisé par Claude Code)

- **Serveur :**
  - nouveau module `backend/app/llm.py` : appel au serveur llama.cpp local (`KAMA_LLM_URL`), consignes, schéma JSON imposé, contrôles de sortie, retour en pidgin seulement pour un texte non critique ;
  - nouvelle route `POST /v1/assistant` pour une question écrite déjà masquée ;
  - la voix passe au LLM quand la liste d'intentions ne comprend pas. Le contexte de l'écran arrive par l'en-tête `X-Kama-Context`, et la transcription est masquée avant le LLM.
- **Décision de sécurité :** le LLM ne reçoit **aucun montant**, seulement les libellés de l'écran. Un essai réel l'a montré confondre les lignes (« The charge is {x1} » alors que {x1} était le montant à envoyer) et écrire des formules (« {x3} = {x1} + {x2} »).
  - Il explique désormais le sens et renvoie vers la pastille pour le montant exact.
  - Toute réponse avec un chiffre, une balise, une formule, un mot de calcul ou une hésitation est rejetée.
- **Limite connue :** le masquage ne détecte pas un prénom seul sans contexte. Le LLM tourne sur notre serveur, sans tiers.
- **Tests :** 178 réussis, dont 16 pour l'assistant (sécurité, retour en pidgin, voix).
