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
| Texte → texte Pidgin | Pas encore de route | Ajouter l'adaptateur du modèle retenu |
| Voix → texte (`/v1/voice/intent`) | Route et grammaire prêtes, aucun moteur | Brancher le modèle retenu, remplir `bbj` et `wes` dans `intents.json` |
| Texte → voix (`/v1/tts`) | Route prête, aucun moteur | Priorité aux audios enregistrés ; le moteur couvre l'inédit |

Pour ajouter un modèle : écrire une classe avec `translate(text) -> str` dans `app/engines.py`, l'inscrire dans `FACTORIES`, puis ajouter sa route dans `config/routes.json`.

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
