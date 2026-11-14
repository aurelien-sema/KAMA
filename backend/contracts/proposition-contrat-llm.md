# Proposition de contrat du LLM Kama

**Version :** brouillon 0.2  
**Statut :** intègre les décisions d'Omar du 2026-11-13 (réponse rédigée par le LLM, retour en anglais pour un texte critique) ; à relire par Dimitri. Ce n'est pas encore le contrat de l'API active.  
**Date :** 2026-11-13

## 1. Rôle du LLM dans l'expérience

Le LLM comprend une demande normalisée en anglais ou en français et renvoie un résultat structuré. Quand aucune phrase validée de Kama ne répond, il peut **rédiger une réponse courte en langue pivot**, où chaque montant, nom ou numéro est une balise `{xN}` que l'extension remplace localement (section 4, `answer`).

Pour une demande en pidgin, le parcours prévu est :

1. Audio : reconnaissance vocale en texte pidgin. Cette étape est sautée si la demande est déjà écrite.
2. Traduction du texte pidgin vers l'anglais.
3. Compréhension et structuration par le LLM.
4. Résolution de la structure en contenu Kama, puis présentation dans la langue choisie, en texte et/ou en audio.

Une demande déjà en français ou en anglais va directement au LLM. Pivots : **pidgin → anglais** (modèles ajustés sur le pidgin camerounais, route `wes>en` à brancher), **ghomálá' → français** (route `bbj>fr`, à valider). Le LLM ne comprend pas les langues nationales : sans traduction vers le pivot, la demande n'est pas transmise.

## 2. Principe de sécurité

Le LLM choisit **une seule valeur dans un ensemble autorisé**. Il ne peut pas :

- écrire un chiffre, un montant, un nom ou un numéro (seules les balises `{xN}` reçues sont permises) ;
- calculer, modifier ou reformater un montant ;
- cliquer, confirmer, envoyer, annuler ou remplir un champ ;
- choisir un identifiant qui ne figure pas dans les candidats transmis pour cette demande ;
- renvoyer du texte libre ailleurs que dans `answer.text`, ou conseiller une décision financière (« envoie », « n'envoie pas »).

Les montants et données personnelles restent dans l'extension. Avant l'appel au LLM, le texte doit être masqué et les candidats expurgés de leurs valeurs sensibles. Si le masquage n'est pas fiable, la requête ne doit pas être transmise au LLM.

## 3. Entrée proposée au LLM

Le LLM ne reçoit ni l'audio brut ni l'intégralité de la page. Il reçoit un texte déjà reconnu/traduit et masqué, plus une liste limitée de candidats si la tâche en a besoin.

```json
{
  "contract_version": "0.1",
  "task": "intent",
  "input_language": "en",
  "text": "How much will the bank charge?",
  "candidates": []
}
```

Valeurs possibles proposées pour `task` :

- `intent` : comprendre la demande de l'utilisateur ;
- `select_element` : choisir parmi des éléments de page détectés par Kama ;
- `map_bank_message` : rattacher un message bancaire inédit à une explication validée ;
- `answer` : répondre à une question sur la page quand aucune intention ni phrase validée ne suffit.

Pour `answer`, l'entrée porte aussi `context` : l'identifiant de l'écran (`screen`) et les éléments visibles, avec leur libellé et leur valeur masquée (`{"id": "frais", "label": "Frais", "value": "{x1}"}`). Les valeurs réelles restent dans l'extension.

Pour `select_element` et `map_bank_message`, `candidates` contient seulement des identifiants opaques et de courtes descriptions assainies. Il ne contient ni sélecteurs DOM, ni montants, ni numéros de compte, ni noms de bénéficiaires.

Les champs exacts de l'entrée, la taille maximale et les règles de masquage doivent être alignés avec le service worker et le backend avant toute implémentation.

## 4. Sortie proposée

La réponse est un objet JSON unique, sans Markdown, sans commentaire ni propriété supplémentaire. Le type normal de réponse doit correspondre à la tâche. `unknown` est permis en repli pour chaque tâche.

| `task` reçu | `result.kind` attendu |
|---|---|
| `intent` | `intent` |
| `select_element` | `element` |
| `map_bank_message` | `bank_message` |
| `answer` | `answer` (ou `intent` si une intention suffit) |
| Toute tâche sans résultat sûr | `unknown` |

### Comprendre une demande

```json
{
  "result": {
    "kind": "intent",
    "intent": "ask_fees"
  }
}
```

Liste initiale proposée, à valider :

- `ask_balance`
- `ask_fees`
- `ask_total`
- `what_to_do`
- `explain_error`
- `repeat`

`summarize_transactions` n'est pas proposé pour la v1, car cette fonction a été retirée de l'interface le 13 novembre 2026. La grammaire et le schéma actifs contiennent encore cette valeur ; ce brouillon ne les modifie pas.
`unknown` est un type de résultat de repli, pas une intention fonctionnelle.

### Choisir un élément de page

```json
{
  "result": {
    "kind": "element",
    "candidate_id": "pageBalance"
  }
}
```

`candidate_id` doit être exactement l'un des identifiants fournis dans l'entrée. L'extension retrouve localement l'élément à expliquer. Ce choix ne déclenche aucune action sur la page.

### Rattacher un message bancaire inédit

```json
{
  "result": {
    "kind": "bank_message",
    "explanation_id": "insufficientFunds"
  }
}
```

`explanation_id` doit désigner une explication déjà validée et présente parmi les candidats. L'extension garde le message original et affiche l'explication du catalogue.

### Répondre

```json
{
  "result": {
    "kind": "answer",
    "text": "The fee is {x1}. In total, {x2} will leave your account.",
    "critical": true
  }
}
```

`text` : 1 à 3 phrases simples, en langue pivot, 300 caractères au plus, uniquement des balises reçues dans `context`. `critical` est indicatif : le backend recalcule lui-même la criticité (`guards.is_critical`).

### Ne pas deviner

```json
{
  "result": {
    "kind": "unknown"
  }
}
```

Utiliser `unknown` si la demande sort du périmètre, si la correspondance est absente ou ambiguë, ou si aucune option sûre ne ressort.

## 5. Contrôles de la réponse

Le backend valide la réponse avant de la transmettre à l'extension :

- JSON valide, type de résultat conforme à la tâche, champs requis présents et aucun champ supplémentaire ;
- enum `intent` reconnu ;
- `candidate_id` ou `explanation_id` présent exactement dans la liste de candidats de cette requête ;
- aucun texte libre, montant, nom, numéro ou balise ajouté ; les identifiants et enums sont acceptés uniquement dans leurs champs et s'ils sont autorisés ;
- résultat du bon type pour la tâche demandée, ou `unknown`.

- pour `answer` : aucun chiffre hors balises, chaque balise présente dans `context`, longueur maximale, aucune balise inventée (contrôles de `guards.output_problem`), aucun verbe d'action à la place de l'utilisateur.

Une sortie invalide, une panne, un délai dépassé ou une ambiguïté produit `unknown` (ou l'erreur technique appropriée si l'interface doit proposer « Réessayer »). Le backend ne répare pas une sortie invalide en devinant.

Ce contrat ne fixe pas de seuil numérique de confiance. Pour un modèle qui expose des probabilités, le seuil doit être calibré sur les questions Kama et faire partie des critères d'évaluation. Une confiance écrite par un LLM génératif dans son propre JSON ne sera pas considérée comme une probabilité fiable.

## 6. Retour vers la langue de l'utilisateur (décidé le 2026-11-13)

1. Intention, élément ou message rattaché : Kama sert sa phrase validée (badge « Vérifié »), montants insérés localement.
2. `answer` non critique : traduction automatique vers la langue choisie, badge « Traduction automatique ».
3. `answer` critique (argent, alerte, condition, négation) : **reste en anglais** (ou en français pour le pivot français), badge « Pas encore traduit ». Règle d'or n° 4 ; réglage serveur `KAMA_MT_ALLOW_CRITICAL=false`.

## 7. Périmètre et droits

- Ce fichier reste une proposition documentaire. Il ne change ni `schemas.py`, ni `openapi.json`, ni `intents.json`, ni le comportement du backend.
- Aucun modèle Liquid AI n'est sélectionné, téléchargé ou utilisé par ce contrat.
- Si un modèle Liquid AI est retenu, son fichier de licence exact devra être archivé avec les poids et ses conditions d'usage et d'attribution vérifiées avant distribution. La page Liquid AI indique pour la LFM Open License v1.0 une limite de revenus pour l'usage commercial gratuit ; voir [la licence officielle](https://www.liquid.ai/lfm-license) et [les conditions tarifaires](https://www.liquid.ai/pricing).
