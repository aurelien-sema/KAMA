# Journal de documentation de KAMA

Ce fichier raconte ce qui a été fait dans le projet, pourquoi, et comment ça marche. Il est mis à jour à la demande de Dimitri.

**Règle d'écriture :** chaque entrée doit être comprise par n'importe quel membre de l'équipe, même sans connaissance technique. On n'écrit pas seulement ce qui a été fait : on explique à quoi ça sert, avec des mots simples et des exemples.

## Format d'une entrée

```markdown
## AAAA-MM-JJ — Sujet

**Auteur :** Dimitri

### En bref

### Ce qui a été implémenté, expliqué simplement

### Démarche utilisée

### Résultats et limites connues

### Ce que l'équipe doit faire ensuite

### Composants tiers utilisés
```

La section « Composants tiers utilisés » est obligatoire : le règlement du SAFINUM Innovate Challenge impose de déclarer tout ce qu'on utilise et qui ne vient pas de nous.

## Entrées

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

**Ce que ça veut dire :** même en cachant les montants derrière des balises, ces modèles détruisent les balises. On ne peut donc pas leur confier une phrase contenant un montant. Notre serveur rejette ces réponses, et c'est bien ce qu'il doit faire.

**Limite de ce résultat :** les références françaises et anglaises de SOREVA ont été rédigées à partir du pidgin et restent à relire. Seul un locuteur peut juger la qualité réelle du Ghomala.

### Ce que l'équipe doit faire ensuite

| Qui | Quoi |
|---|---|
| Locuteurs Ghomala et pidgin | Traduire les 64 phrases : c'est la seule voie fiable pour les parcours bancaires |
| Équipe | Au déploiement, donner au serveur le réglage `KAMA_ENV=prod` |
| Back | Terminer l'évaluation des 20 modèles, puis choisir les méthodes pour le texte et la voix |

### Composants tiers utilisés

Aucun nouveau composant depuis l'entrée précédente.
