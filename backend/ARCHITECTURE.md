# Architecture du backend de Kama

Ce document décrit le serveur intermédiaire de Kama et la façon dont l'extension s'y branche. Il complète `Kama_Experience_Utilisateur.pdf`, `Kama_Synthese_Developpement_Securite.pdf` et le règlement du SAFINUM Innovate Challenge.

## 1. Rôle du serveur

Une extension a deux niveaux qu'il ne faut pas confondre :

| Niveau | Où ça tourne | Contenu | Responsable |
|---|---|---|---|
| Extension | Navigateur de l'utilisateur | Popup, onglet, pastilles, fenêtre, service worker, `core/` (détection, extraction, masquage, glossaire, gabarits) | Front |
| Serveur intermédiaire | Hébergement Kama | Ce dossier `backend/` | Back |

Le service worker joue le rôle de « backend interne » de l'extension : il reçoit les messages de l'interface et appelle le serveur. Il fait partie du code de l'extension.

L'extension doit fonctionner sans serveur pour tout ce qui est déjà dans son paquet. Le serveur n'intervient que pour ce que le paquet ne sait pas faire :

1. traduire un texte absent du glossaire local ;
2. comprendre une commande vocale ;
3. synthétiser une phrase qui n'a pas d'audio enregistré.

Il détient aussi les modèles et les clés, qui ne doivent jamais se trouver dans l'extension.

## 2. Ce qui ne passe jamais par le serveur

Ces fonctions restent entièrement dans l'extension, car elles manipulent des données bancaires :

| Fonction (document UX) | Traitement |
|---|---|
| Résumer mes transactions (3.5) | Local. Les libellés et montants ne sont pas envoyés. |
| Pastilles sur solde, frais, total (3.6) | Local, par gabarit et valeur lue dans la page. |
| « Il te manque 3 000 FCFA » (scénario 2) | Calcul local sur les montants de la page. |
| « Tu as 22 500 FCFA » (scénario 2) | Le serveur renvoie seulement l'intention `ask_balance`. L'extension lit le solde. |
| Lecture audio des montants | Audios de chiffres embarqués dans l'extension. |
| Montre-moi, sélecteurs, domaines autorisés | Local. |

## 3. Parcours d'une demande

```text
Texte de la page
   │  masquage dans l'extension : « Frais : 500 FCFA » → « Frais : {x1} »
   ▼
Glossaire local ──trouvé──► gabarit rempli avec la valeur exacte de la page
   │ absent
   ▼
POST /v1/translate (texte masqué uniquement)
   │  1. refus si le texte n'est pas masqué (422)
   │  2. phrase validée exacte        → badge « Vérifié »
   │  3. phrase validée très proche   → badge « Traduction automatique »
   │  4. texte critique               → « Pas encore traduit », aucun modèle appelé
   │  5. modèle + contrôles de sortie → « Traduction automatique » ou « Pas encore traduit »
   ▼
Réponse avec ses {xN} → l'extension remet les valeurs exactes de la page
```

Quand le badge est `untranslated`, `text` vaut `null` : l'extension montre l'original et propose l'écoute en français (UX 3.8).

Est **critique** tout texte qui contient une balise, un terme financier, une alerte ou une négation, ainsi que tout élément signalé par l'extension (`balance`, `amount`, `fee`, `total`, `confirm`, `error`, `warning`). Le règlement traite une erreur sur un montant, une condition ou un avertissement comme un défaut majeur : un modèle non validé n'y a donc pas accès par défaut. Le réglage `KAMA_MT_ALLOW_CRITICAL` permettra de revoir ce choix après les tests de modèles.

## 4. API

Le contrat complet est dans `contracts/openapi.json`.

| Route | Entrée | Sortie |
|---|---|---|
| `GET /healthz` | — | État du service |
| `GET /v1/capabilities` | — | Langues, routes disponibles, limites |
| `POST /v1/translate` | `text` masqué, `source_lang`, `target_lang`, `element` | `text`, `badge`, `origin`, `reason` |
| `POST /v1/tts` | `text` avec balises, `lang` | Segments audio et balises, dans l'ordre |
| `POST /v1/voice/intent` | WAV PCM 16 bits, 16 kHz, mono, en-tête `X-Kama-Lang` | `intent`, `confidence` |

Les erreurs ont la forme `{"error": {"code": "...", "message": "..."}}`. L'extension se base sur `code`.

| Code | Statut | Sens pour l'extension |
|---|---|---|
| `unmasked_content` | 422 | Bug de masquage côté extension : ne pas réessayer |
| `invalid_audio`, `invalid_duration` | 415, 422 | Enregistrement à refaire |
| `asr_unavailable`, `tts_unavailable` | 503 | Basculer sur les boutons ou les audios locaux |
| `busy` | 503 | Proposer « Réessayer » |
| `rate_limited` | 429 | Attendre, voir `Retry-After` |
| `forbidden_origin` | 403 | Identifiant d'extension absent de la configuration |

### Règles de masquage partagées

`contracts/masking_vectors.json` contient les exemples de référence. Le module `core/` de l'extension doit donner exactement ces sorties, sinon le serveur répondra `unmasked_content`.

- Les balises sont **numérotées** de gauche à droite : `{x1}`, `{x2}`. Le document de sécurité écrit `{x}`, mais une langue cible peut inverser l'ordre des mots, et un `{x}` unique pourrait intervertir un montant et un nom.
- L'extension garde la correspondance `x1 → 25 500 FCFA` en mémoire et remplace les balises à la réception, sans reformater la valeur.
- Les gabarits `{montant}`, `{frais}`, `{total}` de `CLARIFICATIONS.md` restent locaux à l'extension. Les balises `{xN}` ne servent qu'aux textes envoyés au réseau.

### Synthèse vocale et montants

Le serveur ne reçoit pas les nombres. Pour « ywə {x1} tsə », il renvoie : audio de « ywə », balise `x1`, audio de « tsə ». L'extension joue les segments dans l'ordre et insère ses propres audios de chiffres à la place de la balise.

### Micro

L'extension envoie du WAV PCM 16 bits, 16 kHz, mono : `MediaRecorder` ne suffit pas, il faut un `AudioContext` à 16 kHz. Ce format évite d'exposer le serveur à un décodeur audio complexe. La limite est de 30 secondes.

## 5. Sécurité : exigence et réponse

| Exigence | Réponse du backend | Preuve |
|---|---|---|
| Ni base de données, ni comptes | Aucun stockage ; contenu en lecture seule | Code, `requirements.txt` |
| Pas de journal du contenu | Le journal ne contient que méthode, route connue, statut et durée | `test_nothing_sensitive_reaches_the_logs` |
| Aucun montant envoyé | Refus de tout texte non masqué, sans recopie | `test_unmasked_amount_is_refused_without_echo` |
| Aucun modèle ne génère de chiffre | Sortie rejetée si un chiffre apparaît ou si une balise change | `test_model_inventing_a_number_is_rejected` |
| Voix non conservée | Audio traité en mémoire, jamais écrit sur disque ; seule l'intention sort | `test_intent_only_never_the_amount` |
| Clés hors de l'extension | Le serveur porte les modèles et les clés ; l'extension n'en a aucune | Conception |
| Limitation des requêtes | Par client et globale, en mémoire ; adresse IP remplacée par un HMAC éphémère | `test_rate_limit*` |
| HTTPS uniquement | Terminé par le proxy d'hébergement, HSTS en production | À vérifier au déploiement |
| Dépendances maîtrisées | Peu de paquets, versions verrouillées | `requirements.txt` |
| Traduction non validée | Jamais servie sans `validated_by` | `test_unvalidated_translation_is_never_served` |

Le contrôle d'origine filtre les appels ordinaires, mais il ne constitue pas une authentification : un script peut imiter l'en-tête `Origin`. L'absence de clé dans l'extension rend ce constat inévitable. La protection réelle tient au fait que le serveur ne détient aucune donnée et limite le débit.

## 6. Modèles d'IA

Le serveur ne dépend d'aucun modèle précis. Chaque route est décrite dans `config/routes.json`, et un moteur absent rend simplement sa route indisponible.

| Volet | État | Suite |
|---|---|---|
| Texte → texte Ghomala | Marian int8 de Flagship configuré, mais **désactivé** (`"enabled": false`) | Règle d'or n° 4 de `CLARIFICATIONS.md` : aucun texte en langue nationale inventé. À activer seulement pour le P2, avec le modèle retenu dans `evaluation/` |
| Texte → texte Pidgin | Routes `en>wes` et `fr>wes` **activées**. Ordre : dictionnaire du catalogue validé, puis phrase proche, puis modèle ajusté v2 (`poids/ct2/pidgin_en_wes_ajuste_v2`) sous contrôle. Un texte critique ne passe jamais par le modèle | Étendre le dictionnaire avec les messages critiques validés par des locuteurs (voir ci-dessous) |
| Voix → texte (`/v1/voice/intent`) | Moteur `omnilingual_ctc` (ONNX) prêt, **désactivé** ; grammaire `wes` en brouillon, `bbj` vide | Tester le modèle (`evaluation/stt_eval.py`), puis activer ; faire valider les phrases `wes` |
| Texte → voix (`/v1/tts`) | Enregistrements humains validés (prioritaires) et moteur `mms_vits`, **désactivé** | Importer les enregistrements ; activer le moteur pour l'inédit (voir « La voix ») |

Pour ajouter un modèle : écrire une classe avec `translate(text) -> str` dans `app/engines.py`, l'inscrire dans `FACTORIES`, puis ajouter sa route dans `config/routes.json`.

### Dictionnaire d'abord, modèle ensuite

Pour un texte donné, le serveur essaie dans cet ordre : (1) le dictionnaire, c'est-à-dire le catalogue de la page de test et ses modèles de phrase (`Frais`, `Bonjour, {x1}`), qui rend le texte validé avec le badge « Vérifié » en quelques millisecondes ; (2) une phrase très proche du dictionnaire ; (3) le modèle ajusté, pour un texte non critique, avec le badge « Traduction automatique » ; (4) sinon rien, et l'extension montre l'original. Les messages qui parlent d'argent, d'alerte, d'annulation, de session ou d'horaires sont critiques : seul le dictionnaire peut les traduire. **Pour qu'ils soient traduits, il faut les ajouter au dictionnaire, avec la validation d'un locuteur.**

### Brancher le modèle pidgin ajusté

1. Sur Colab, la dernière cellule du notebook produit `pidgin_en_wes.zip`. Le décompresser dans `models/poids/ct2/`, ce qui remplace le modèle du même nom. Depuis un dossier Hugging Face, on peut aussi lancer `python backend/scripts/convertir_modele.py <dossier> pidgin_en_wes`.
2. Le passer au test inédit : `python training/pidgin/03_tester_inedit.py --modele <dossier>`.
3. S'il est accepté, passer `enabled` à `true` pour `fr>en`, `en>wes_modele`, `en>wes` et `fr>wes` dans `config/routes.json`, puis redémarrer le serveur.

Même activé, le modèle n'est jamais appelé sur un texte critique (argent, condition, alerte), sauf si `KAMA_MT_ALLOW_CRITICAL=true`. Sa sortie est rejetée si une balise change, si un chiffre apparaît, s'il se répète, s'il recopie l'anglais, ou si plus de 25 % de ses mots sont absents de `content-data/lexique_pidgin.txt`.

### La voix

**Reconnaissance (`asr` dans `routes.json`).** Le moteur `omnilingual_ctc` charge un modèle Omnilingual ASR exporté en ONNX (`poids/asr/omnilingual-ctc-300m-onnx`, licence Apache 2.0) et décode en glouton. Il couvre le pidgin camerounais et le Ghomala, sans indication de langue. Le texte reconnu ne sort jamais de `voice_intent` : seule l'intention est renvoyée. Une phrase approchante est acceptée (ressemblance d'au moins 0,85, deux mots minimum, écart net avec la deuxième intention), sinon `unknown`. La confiance est alors inférieure à 1.

**Synthèse (`/v1/tts`).** Le texte reçu est découpé en morceaux entre les balises `{xN}`. Pour chaque morceau :
1. un enregistrement humain validé, s'il existe dans `<KAMA_CLIPS_DIR>/<langue>/manifest.json` (par défaut `models/poids/audio`), est rendu tel quel avec `origin: "recorded"` ;
2. sinon le moteur de synthèse (`mms_vits`) parle, avec `origin: "synthetic"` : l'extension doit alors signaler une voix automatique ;
3. sinon, ou si le moteur échoue : `503 tts_unavailable`, et l'extension joue ses audios locaux ou affiche le texte.

Un enregistrement sans `validated_by`, dont le texte contient un chiffre ou une balise, ou dont le fichier n'est pas un WAV 16 bits 16 kHz mono, est ignoré avec un avertissement. Les enregistrements sont hors du dépôt public : c'est la voix d'une personne.

Préparer et importer les enregistrements : `python backend/scripts/audio_catalogue.py script | importer | verifier`. Dépendances : `requirements-voice.txt` ; dans Docker, `--build-arg WITH_VOICE=1`.

Autre moteur de reconnaissance disponible : `hf_ctc` (modèle CTC au format transformers, par exemple celui ajusté sur Common Voice par `training/stt_pidgin`). Il se branche en changeant `engine` et `path` dans `asr.wes`.

### Les intentions vocales : à quoi elles servent

La voix ne sert pas à dicter : elle sert à **choisir un texte déjà validé**. Le chemin est `parole → texte reconnu → intention (liste fermée) → texte validé du dictionnaire → voix`. Le texte reconnu n'est jamais affiché ni servi ; une erreur de reconnaissance donne au pire « je n'ai pas compris » (`unknown`), jamais une information fausse. C'est ce qui contourne les erreurs de lexique et de termes critiques du modèle de traduction.

| Intention | Ce que la personne dit (sens) | Ce que l'extension fait ensuite |
|---|---|---|
| `ask_balance` | « mon solde » | lit le solde affiché sur la page (nombre en extraits locaux) avec le gabarit validé « Solde disponible » |
| `ask_fees` | « les frais » | lit les frais de la page avec le gabarit validé « Frais de {x1} » |
| `ask_total` | « le total à débiter » | lit le total avec le gabarit validé « Total à débiter » |
| `what_to_do` | « que dois-je faire » | lit la consigne de l'étape en cours (texte du catalogue pour cette zone) |
| `explain_error` | « pourquoi ça ne marche pas » | relit le message d'erreur ou d'alerte affiché, depuis le catalogue validé |
| `summarize_transactions` | « mes transactions » | lit les dernières lignes avec les gabarits « Transfert reçu », « Salaire reçu »… |
| `repeat` | « répète » | rejoue le dernier audio |

Règles : une intention ne **déclenche jamais d'action** sur la page (pas de « confirme », « envoie », « annule » : ce sont des commandes critiques) ; elle ne fait que **lire**. Les montants viennent de la page, jamais de la parole. Une intention sans texte validé pour l'écran courant répond « non disponible ».

Intentions à ajouter (proposition, il faut modifier le contrat `IntentResponse` côté extension, donc à décider avec le front) : `ask_recipient` (« à qui j'envoie »), `ask_amount` (« combien j'envoie »), `ask_delay` (« quand ça arrive »), `is_it_safe` (lit le conseil de sécurité de la page), `help` (« qu'est-ce que c'est cette page »), `stop` (« arrête »). Chacune n'a de sens que si un texte validé existe pour l'écran.

### Le catalogue de la page de test

`content-data/safinum_test_page.json` est chargé avec `templates.json`. Ses valeurs (montants, taux) sont masquées au chargement. Une traduction qui change ou oublie une valeur est ignorée, avec un avertissement, sans arrêter le serveur. Seules les entrées dont `validated_by` (ou `validated_by_bbj` pour le Ghomala) est rempli sont servies.

Les noms de personnes ne sont pas détectés dans « Bonjour, Amina » : l'extension doit transmettre au masquage les valeurs qu'elle lit sur la page (nom, numéro de compte), sinon la phrase ne correspond à aucun motif.

`content-data/templates.json` est la source unique des phrases validées, partagée avec le glossaire de l'extension. Les traductions y sont vides : elles viendront des locuteurs natifs.

## 7. Déploiement

Le jury n'installe que le zip de l'extension. Le serveur est hébergé par l'équipe et son adresse HTTPS est écrite dans l'extension.

- **Machine retenue :** VPS Contabo Cloud VPS 6 en Union européenne (6 vCPU, 12 Go de RAM, 100 Go NVMe, sans GPU). L'entraînement des modèles reste hors de ce serveur.
- **HTTPS :** un proxy (par exemple Caddy) devant `python -m app`, avec un nom de domaine. Le serveur écoute seulement en local, et le proxy ne doit pas journaliser les corps de requêtes.
- **Identifiant d'extension stable :** une extension chargée « non empaquetée » reçoit un identifiant qui dépend de son dossier. Le front doit fixer `key` dans `manifest.json`, et cet identifiant doit figurer dans `KAMA_ALLOWED_ORIGINS`, sinon le serveur répondra `forbidden_origin` chez le jury.
- **Panne :** l'extension doit rester utilisable sans serveur pour le glossaire et les audios locaux (UX 3.8).

## 8. Limites connues

- Tant que `templates.json` n'est pas rempli, presque toutes les réponses seront « Pas encore traduit ».
- La détection des noms repose sur des indices (majuscules, prépositions). Un prénom seul sans contexte n'est pas détecté : l'extension doit fournir les valeurs connues de la page, comme le champ bénéficiaire.
- Le débit est limité processus par processus. Il faut une seule instance, ou un partage du compteur si on en déploie plusieurs.
- La voix envoyée au serveur peut contenir un montant ou un nom si l'utilisateur les prononce. Elle n'est ni stockée ni journalisée, mais elle transite : l'écran de consentement doit le dire, et les démonstrations se font uniquement sur des données simulées.
- La loi camerounaise n° 2024/017 impose une validation par un juriste avant tout déploiement avec une banque.
