# Sécurité de Kama : ce qui est lu, où ça va, comment on le prouve

Principe : **ne rien stocker, ne rien envoyer** de ce qui est bancaire. Ce document suit `Kama_Synthese_Developpement_Securite.pdf` et le règlement du défi (article 9 : ne pas collecter, transmettre ou exposer de données financières personnelles).

## 1. Les flux de données (chaque donnée a une seule destination)

| Donnée | Où elle va | Comment c'est garanti |
|---|---|---|
| Solde, montants, frais, total, numéros, bénéficiaires, transactions | **L'écran seulement.** Lus dans la page, affichés, oubliés. | Les montants sont recopiés tels quels dans les gabarits. Avant tout envoi, `lib/masquage.ts` les remplace par `{x1}`, `{x2}`…. Test `npm test` : aucun chiffre ni « FCFA » dans le texte envoyé. |
| Phrases fixes de Kama (explications, boutons, erreurs) | **Glossaire embarqué** (`config/glossaire.json`) si une version validée existe. Sinon le serveur, **texte masqué seulement**. | `lib/traduction.ts` : glossaire d'abord, puis `POST /v1/translate`. Le serveur refuse tout texte non masqué (`unmasked_content`). |
| Texte sélectionné par la personne | Serveur, masqué, **seulement si elle clique sur « Expliquer »**. Un texte presque entièrement masqué n'est pas envoyé. | `traduireTexteLibre`. Les noms sont détectés par indices (majuscules, prépositions) : limite connue. |
| Voix (micro) | Serveur, **seulement entre deux appuis sur le bouton micro**, pour comprendre la demande. Rien n'est gardé. | `lib/micro.ts` coupe le flux (le voyant du micro s'éteint) dès l'arrêt. Le serveur ne renvoie que l'intention. Consentement séparé avant le premier usage. |
| Montants à lire à voix haute | **Jamais envoyés.** Le serveur renvoie une balise ; Kama lit le montant de la page lui-même. | `lib/audio.ts`, `lib/nombres.ts` (comparé au serveur par `numbers_vectors.json`). |
| Réglages (langue, mode, activé, consentements) | `storage.local` du navigateur, jamais envoyés. | `lib/reglages.ts` |

## 2. Ce que le code fait pour se protéger

- **Aucune clé dans l'extension.** Le serveur détient les modèles ; l'extension ne contient que son adresse (`config/serveur.ts`).
- **Seul le service worker parle au serveur** (`entrypoints/background.ts`). Il ne répond qu'à notre extension (`sender.id`), depuis une page bancaire autorisée, et ne connaît que 4 routes. Il n'écrit rien dans la console.
- **Permissions minimales** : `storage` et l'adresse du serveur. Ni `<all_urls>`, ni `tabs`, ni cookies, ni historique, ni `webRequest`. Hors des pages listées dans `config/sites.ts`, Kama n'existe pas (« page non reconnue »).
- **Identifiant d'extension fixe** (`key` dans `wxt.config.ts`) : sans lui l'identifiant change selon le dossier du jury et le serveur répond `forbidden_origin`. À mettre dans `KAMA_ALLOWED_ORIGINS`.
- **Aucune fonction ne démarre avant l'accord** : l'écran de consentement s'ouvre avant toute explication ; le micro a son propre consentement.
- **La fenêtre est vidée** à la fermeture et à chaque changement d'étape de la page. Aucun historique des questions.
- **Texte de la page affiché par React (`textContent`)**, jamais `innerHTML` ; Shadow DOM.
- **Un montant ne peut pas être modifié par la traduction** : si une traduction change une balise `{xN}`, elle est refusée et le français reste affiché.
- **Éléments critiques** (solde, montant, frais, total, confirmer, erreur, alerte) : le serveur ne les traduit jamais avec un modèle ; seule une phrase validée par un locuteur sort, avec le badge « Vérifié ».

## 3. Ce qui est prouvé par des tests automatiques

- `npm test` (extension) : masquage identique au serveur sur 24 exemples ; lecture des montants identique ; WAV 16 kHz mono ; toutes les phrases de la fenêtre sont dans le catalogue de validation et déjà masquées ; aucun chiffre ne part sur le réseau.
- `pytest` (serveur) : un brouillon non validé n'est jamais servi « Vérifié » ; un élément critique n'appelle jamais le modèle ; un montant non masqué est refusé ; le glossaire embarqué est identique à la mémoire du serveur.

## 4. Ce qui n'est PAS encore vérifié (à faire avec un navigateur)

- Le chargement réel de l'extension dans Chrome et Edge, et le parcours des deux scénarios sur la page de test.
- **L'autorisation du micro est demandée au nom du site bancaire**, pas au nom de Kama (le micro est ouvert depuis la page injectée). Pour la demander au nom de Kama il faut un document hors-écran, à tester dans le navigateur.
- Le test de fuite dans l'onglet Réseau du service worker avec les vrais scénarios, et le test d'injection (`<img onerror>` dans un libellé).
- La règle ESLint contre `innerHTML`, `npm audit` à chaque build, 2FA GitHub sur tous les comptes.
- La lecture des montants se fait avec la voix du navigateur tant que les audios de chiffres enregistrés par un locuteur ne sont pas embarqués.
- La loi n° 2024/017 sur les données personnelles : validation par un juriste avant tout déploiement avec une banque.
