# Voie 3 — Explications pidgin par catégorie (à valider par un locuteur)

Contexte : le jury introduit un message jamais vu (alerte, arnaque, erreur). Kama reconnaît le TYPE du message avec le
classeur déterministe `kama_frontend/lib/categories.ts` (mots-clés français + anglais, aucun réseau, aucun modèle), puis
affiche l'explication pidgin préparée pour cette catégorie. La traduction automatique du message original, si le serveur
l'accorde, vient EN PLUS avec son propre badge « Traduction automatique ».

Les pidgin ci-dessous sont des BROUILLONS proposés : ils doivent être corrigés puis validés par un locuteur. Aucun montant
n'est inventé ni modifié. Un brouillon s'affiche avec le badge « Traduction automatique », jamais « Vérifié ».

Statut : `pidgin proposé` = écrit par l'équipe (brouillon, non locuteur). `pidgin corrigé par le locuteur` = à remplir.
`validé par` = nom du locuteur + date.

| Catégorie | Français | Anglais | Pidgin proposé (brouillon) | Pidgin corrigé par le locuteur | Validé par |
|-----------|----------|---------|----------------------------|--------------------------------|------------|
| faux_agent_demande_code | Quelqu'un te demande ton code secret ou ton code de retrait. Une banque ne demande jamais un code : ne le donne pas, c'est toi qui décides. | Someone asks you for your secret code or your withdrawal code. A bank never asks for a code: do not give it, it's your decision. | Somebody dey ask you for your secret code or withdrawal code. Bank no go ever ask you for code - no give am, na you go decide. | | |
| lien_piege | Ce lien te demande de payer ou de mettre à jour tes infos avant d'obtenir quoi que ce soit. Ne clique pas et n'envoie rien, c'est toi qui décides. | This link asks you to pay or update your info before getting anything. Don't click and don't send anything, it's your decision. | Dis link dey ask you pay or update your info before you get anything. No click am, no send anything, na you go decide. | | |
| faux_gain | On te dit que tu as gagné un prix et te demande de payer des frais d'abord. C'est une arnaque : n'envoie pas d'argent, c'est toi qui décides. | They tell you that you won a prize and ask you to pay fees first. It's a scam: don't send money, it's your decision. | Dem talk say you win prize and ask you pay fee first. Na scam - no send money, na you go decide. | | |
| faux_remboursement_erreur | On te dit qu'on t'a envoyé de l'argent par erreur et te demande de le renvoyer. Ne renvoie rien sans vérifier avec ta banque, c'est toi qui décides. | They tell you money was sent to you by mistake and ask you to send it back. Don't send anything back without checking with your bank, it's your decision. | Dem talk say dem send you money by mistake and ask you send am back. No send anything until you check with your bank, na you go decide. | | |
| faux_emploi | On te propose un travail et te demande de payer des frais de dossier ou d'admission. Ne paye rien, c'est toi qui décides. | They offer you a job and ask you to pay application or admission fees. Don't pay anything, it's your decision. | Dem offer you work and ask you pay form fee or admission fee. No pay anything, na you go decide. | | |
| investissement_douteux | On te promet de gagner beaucoup d'argent vite si tu déposes ou investis. Ne dépose pas d'argent, c'est toi qui décides. | They promise you will make a lot of money fast if you deposit or invest. Don't deposit any money, it's your decision. | Dem promise say you go make plenty money quick if you deposit or invest. No deposit money, na you go decide. | | |
| urgence_menace | On te dit qu'un proche est en danger et te presse de payer vite. Ne paye pas sous la pression : vérifie d'abord, c'est toi qui décides. | They tell you a loved one is in danger and pressure you to pay fast. Don't pay under pressure: check first, it's your decision. | Dem talk say your relation dey danger and pressure you pay quick. No pay under pressure - check first, na you go decide. | | |
| panne_maintenance | Le service bancaire est en maintenance ou en panne pour le moment. Réessaie plus tard, c'est toi qui décides quand refaire l'opération. | The banking service is under maintenance or down right now. Try again later, it's your decision when to redo the operation. | Banking service for maintenance or e dey down for now. Try again later, na you go decide when you go redo am. | | |
| operation_refusee | Ton opération a été refusée : aucun argent n'a quitté ton compte. Vérifie les informations et réessaie si tu veux, c'est toi qui décides. | Your operation was declined: no money left your account. Check the details and try again if you want, it's your decision. | Your operation don refuse - no money leave your account. Check your details and try again if you want, na you go decide. | | |
| operation_reussie | Ton opération est partie. Vérifie le total qui a quitté ton compte, c'est toi qui décides de garder le reçu ou non. | Your operation went through. Check the total that left your account, it's your decision whether to keep the receipt or not. | Your operation don go through. Check the total wey leave your account, na you go decide if you go keep the receipt or not. | | |
| frais_tarif | Des frais s'appliquent à cette opération. Vérifie le montant avant de continuer, c'est toi qui décides. | Fees apply to this operation. Check the amount before continuing, it's your decision. | Fee dey apply for this operation. Check the amount before you continue, na you go decide. | | |
| plafond | Tu as atteint un plafond ou une limite sur ton compte. Vérifie ton plafond avant d'envoyer, c'est toi qui décides. | You reached a limit on your account. Check your limit before sending, it's your decision. | You reach limit for your account. Check your limit before you send, na you go decide. | | |
| compte_bloque_suspendu | Ton compte est bloqué ou suspendu pour le moment. Contacte ta banque avant de faire quoi que ce soit, c'est toi qui décides. | Your account is blocked or suspended right now. Contact your bank before doing anything, it's your decision. | Your account block or suspend for now. Contact your bank before you do anything, na you go decide. | | |
| mise_a_jour_informations | On te demande de mettre à jour tes informations avant une date limite. Fais-le seulement par le site officiel de ta banque, c'est toi qui décides. | You are asked to update your information before a deadline. Do it only through your bank's official website, it's your decision. | Dem ask you update your information before deadline. Do am only for your bank official website, na you go decide. | | |
| information_generale | C'est un message d'information générale de ta banque. Lis-le, mais aucune opération urgente n'est demandée, c'est toi qui décides. | It's a general information message from your bank. Read it, but no urgent operation is requested, it's your decision. | Na general information message from your bank. Read am, but no urgent operation you need do, na you go decide. | | |
| inconnu | Kama ne reconnaît pas ce message. Lis-le bien ou demande à ta banque avant de faire quoi que ce soit, c'est toi qui décides. | Kama does not recognize this message. Read it well or ask your bank before doing anything, it's your decision. | Kama never sabi dis message. Read am well or ask your bank before you do anything. | | |

Badges de catégorie en pidgin (brouillons, affichés dans la fenêtre) : Fake agent, Trap link, Fake prize, Fake refund,
Fake job, Shady investment, Urgent / threat, Service down, Operation no go, Operation done, Charge, Limit, Account block,
Update your info, General info, Kama no sabi.

Règles d'or respectées :
- Aucune arnaque n'est classée dans information_generale ni operation_reussie (garantie du classeur + test).
- Aucun montant n'est inventé ni modifié dans les explications (test : aucun chiffre, aucun FCFA).
- Les explications sont en brouillon (aucun `validated_by`) : badge « Traduction automatique », jamais « Vérifié ».
- Rien n'est stocké ; le message est relu dans la page à chaque affichage, l'explication est lue par la voie pidgin du serveur.

Vérifications (branche score-B) :
- Précision voie 3 : 100 % sur les 60 cas de la vérité de terrain (30 fidèles + 30 arnaques), en français et en anglais.
- `npm test`, `npx tsc --noEmit`, `npm run build:local` : verts.

Prochaines étapes :
1. Un locuteur corrige la colonne « Pidgin corrigé » et signe « Validé par ».
2. Reporter les pidgins validés (champ `wes`, avec `validated_by`) dans `content-data/kama_fenetre.json` (entrées `b_`).
3. Relancer `cd backend && .venv\Scripts\python.exe -m app.export_glossary` pour régénérer `config/interface.json`.
4. Relancer `npm test` (dont le futur `pidgin-complet.test.mjs`), `npx tsc --noEmit`, `npm run build:local`.
