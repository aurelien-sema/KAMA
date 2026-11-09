# Kama — Extension navigateur (Hackathon SAFINUM Innovate Challenge 2026)

Ce fichier explique le projet à Claude Code : ce qu'est Kama, ce qui est déjà décidé, les règles à respecter et ce qu'il reste à faire.
Lis-le en entier avant d'écrire du code.

---

## 1. Le projet en bref

**Kama** est une extension de navigateur (Chrome / Edge) qui explique une interface de banque en ligne dans la **langue maternelle** de l'utilisateur (ewondo d'abord ; puis duala, fulfulde, ghomálá', bassa'a), **en audio d'abord, avec le texte en appui**.

- **Utilisateur cible** : personne qui parle bien sa langue nationale, comprend mal le français bancaire et lit parfois difficilement. Persona : Mama Ngono, 52 ans, vendeuse au marché, parle ewondo.
- **Contexte** : hackathon SAFINUM (accessibilité des services financiers en langues nationales camerounaises). Les organisateurs fournissent un **environnement de test simulé : une page web bancaire**. Kama doit fonctionner sur cette page.
- **Livraison au jury** : un **fichier zip** que le jury installe lui-même (« Charger l'extension non empaquetée »). **La simplicité d'installation est notée.**
- **Quatre modes de traduction** : texte→texte, texte→audio, audio→texte, audio→audio.

---

## 2. Ce qui est déjà fait

- **Charte graphique** :
  - Orange principal `#FF5209`, quasi-noir `#030102`, blanc `#FFFFFF`, crème clair `#FFF1E0` (surfaces douces).
  - Polices : **Krona One** (uniquement grands titres et le nom « Kama ») ; **DM Sans** (tout le reste, chiffres compris, `font-variant-numeric: tabular-nums`).
  - Logo : fourni par l'équipe (à placer dans `assets/`).
- **Interfaces** : conçues dans Lovable (catalogue de chaque élément et de ses états + démo cliquable). **C'est la référence visuelle.** Le code Lovable (React) peut être récupéré via GitHub et ses composants réutilisés.
- **Document UX** : `Kama_Experience_Utilisateur.docx` (fonctionnalités, règles d'or, 2 scénarios).

> Si quelque chose dans ce fichier contredit les maquettes Lovable, demande à l'utilisateur avant de trancher.

---

## 3. Les 5 éléments de l'interface

Tous les éléments mènent à **une seule fenêtre Kama**, dont seul le contenu change.

| Élément | Où | Rôle |
|---|---|---|
| **Popup** | Icône Kama dans la barre du navigateur (popup d'extension, 340 px de large) | Réglages : activer/désactiver, choisir la langue, préférer texte ou audio, bouton « Expliquer cette page » |
| **Onglet de bord** | Injecté dans la page, collé au bord droit, centré verticalement, `position: fixed`, déplaçable verticalement (~44×44 px) | Au clic, menu de 3 boutons : 🎤 Parler à Kama · 📄 Expliquer cette page · 🧾 Résumer mes transactions |
| **Pastilles** | Petites icônes rondes (24 px) injectées à côté des éléments importants **seulement** : solde, montant, frais, total débité, bouton Confirmer, messages d'erreur | Au clic, la fenêtre s'ouvre avec l'explication de cet élément |
| **Barre de sélection** | Apparaît au-dessus d'un texte surligné : [Expliquer] [Écouter] | Explique ou lit le texte sélectionné |
| **Fenêtre Kama** | S'ouvre à gauche de l'onglet de bord, 360×520 px | Seul endroit où Kama répond : lecteur audio + texte, micro en bas |

### Contenus de la fenêtre (états)
1. Parler — attente / écoute / réflexion / réponse
2. Expliquer cette page : 1 phrase + étapes numérotées, chacune avec un bouton **« Montre-moi »** qui fait défiler jusqu'à l'élément et le surligne (contour orange, 2 pulsations puis fixe)
3. Résumer mes transactions (ou « Va sur la page Historique » s'il n'y en a pas sur la page)
4. Explication d'un élément (venue d'une pastille ou d'une sélection)
5. Erreur bancaire expliquée (message original affiché + explication sans minimiser)
6. Pas de connexion (+ Réessayer)
7. Traduction indisponible (texte original + « Écouter en français »)

Chaque réponse porte un **badge de fiabilité** : « Vérifié » (issu du glossaire validé) / « Traduction automatique » / « Pas encore traduit ».

---

## 4. Règles d'or (non négociables)

1. **Les montants ne passent JAMAIS par un modèle de langue.** Ils sont extraits du DOM tels quels et insérés dans les réponses par gabarit (`{montant}`, `{frais}`, `{total}`). Le modèle ou le système de traduction ne génère jamais un chiffre. Un montant affiché par Kama doit être identique au caractère près à celui de la page.
2. **Kama ne clique jamais à la place de l'utilisateur** et ne remplit aucun champ. Il explique et surligne, c'est tout.
3. **Kama ne modifie pas le contenu de la page bancaire.** Il ajoute seulement ses propres éléments (onglet, pastilles, barre, fenêtre).
4. **Aucun texte en langue nationale inventé.** Les textes en ewondo viennent du glossaire et des phrases validées par un locuteur natif. Sinon : badge « Pas encore traduit » et repli sur le français.
5. **Accessibilité** :
   - texte blanc sur orange seulement si ≥ 18 px **et** gras (contraste ≈ 3,2:1) ; sinon texte quasi-noir sur orange ;
   - jamais de petit texte orange sur blanc ;
   - zones cliquables ≥ 44×44 px ;
   - une erreur = icône + texte, jamais la couleur seule ;
   - aucune animation en boucle ;
   - tous les éléments utilisables au clavier, avec des `aria-label`.
6. **Une seule fenêtre** pour toutes les réponses.

---

## 5. Architecture proposée (à valider avec l'équipe)

- **Manifest V3**, compatible Chrome et Edge.
- **`popup/`** : page du popup (réglages), stockage avec `chrome.storage.local` (langue, mode texte/audio, activé/désactivé, premier lancement).
- **`content/`** : script injecté sur la page de test. Il :
  - détecte les éléments importants (sélecteurs dédiés à la page des organisateurs, regroupés dans **un seul fichier de configuration** pour pouvoir les ajuster) ;
  - injecte l'onglet, les pastilles, la barre de sélection et la fenêtre **dans un Shadow DOM**, pour que le CSS de la page et celui de Kama ne se mélangent pas ;
  - gère « Montre-moi » (scroll + surlignage).
- **`background/`** (service worker) : appels réseau (traduction, synthèse vocale, reconnaissance vocale) et messages entre popup et page.
- **`content-data/`** : glossaire et phrases validées par langue (JSON), et fichiers audio pré-enregistrés.
- **`permissions`** minimales : `storage`, `activeTab` / `host_permissions` limitées au domaine de la page de test. Moins il y a d'autorisations, plus l'installation rassure le jury.

### Points d'attention connus
- **Micro (audio→texte / audio→audio)** : `getUserMedia` depuis un content script demande l'autorisation au nom du site visité. Une alternative est un *offscreen document* MV3. À tester tôt, c'est le point le plus risqué techniquement.
- **Synthèse et reconnaissance vocales en ewondo** : la disponibilité d'un service fiable n'est pas confirmée. **Plan de repli pour la démo : des audios pré-enregistrés par un locuteur natif** pour les phrases du parcours, joués depuis `content-data/audio/`.
- **Chiffres lus en audio** : la lecture des grands nombres en langue nationale est très exposée aux erreurs. Le montant reste toujours affiché à l'écran pendant la lecture.

---

## 6. Ce qu'il reste à faire (par priorité)

### P0 — indispensable pour la démo
- [ ] Squelette de l'extension MV3 (manifest, popup, content script, service worker), chargeable via « Charger l'extension non empaquetée ».
- [ ] Popup avec réglages persistants + écran de premier lancement (choix de la langue).
- [ ] Analyse de la page de test des organisateurs : liste des éléments à détecter et de leurs sélecteurs (fichier de config).
- [ ] Onglet de bord + menu 3 boutons.
- [ ] Fenêtre Kama unique avec ses états.
- [ ] Pastilles sur les éléments importants + explication.
- [ ] « Expliquer cette page » + « Montre-moi ».
- [ ] Extraction fiable des montants depuis le DOM + gabarits de réponse.
- [ ] Lecteur audio (fichiers pré-enregistrés en premier).
- [ ] États d'erreur : pas de réseau, traduction indisponible, page non reconnue.

### P1 — important
- [ ] Barre de sélection de texte.
- [ ] Résumer mes transactions.
- [ ] Parler à Kama (micro → réponse audio).
- [ ] Badges de fiabilité.
- [ ] Page de bienvenue ouverte automatiquement à l'installation (`chrome.runtime.onInstalled`) : confirme l'installation, montre comment épingler l'icône, choix de la langue, lien vers la page de test.

### P2 — si le temps le permet
- [ ] Autres langues que l'ewondo.
- [ ] Traduction automatique en direct (avec badge « Traduction automatique »).

### Livraison au jury
- [ ] Zip avec cette structure exacte :
  ```
  Kama_Installation.zip
  ├── 1_LIRE_EN_PREMIER.pdf   ← guide d'installation illustré (Chrome + Edge)
  └── Kama/                    ← le seul dossier à sélectionner (manifest.json à sa racine)
  ```
- [ ] Tester l'installation avec 2 personnes extérieures à l'équipe : arriver à la première explication de Kama en moins de 3 minutes, sans aide.

---

## 7. Critères de réussite

- Le **scénario 1** fonctionne de bout en bout sur la page de test : Mama Ngono ouvre la page Transfert, clique « Expliquer cette page », utilise « Montre-moi », clique sur la pastille des frais, entend « Frais : 500 FCFA. Au total, 25 500 FCFA vont sortir de ton compte », puis appuie elle-même sur Confirmer.
- Le **scénario 2** fonctionne : transfert refusé (« Solde insuffisant »), Kama explique la cause et le montant manquant.
- Aucun montant affiché par Kama ne diffère de la page.
- L'extension s'installe depuis le zip sans erreur sur Chrome et Edge.

---

## 8. Façon de travailler

- Avance par petites étapes testables. Après chaque étape, dis-moi comment la vérifier dans le navigateur.
- Pose une question avant toute décision non couverte par ce fichier ou par les maquettes Lovable.
- Explications simples et directes, en français.
