/**
 * Textes des écrans de consentement (français, source). Ils passent par la traduction comme toute phrase de Kama :
 * ils s'affichent dans la langue choisie dès qu'une version validée existe (content-data/kama_fenetre.json), sinon en français
 * avec le badge « Pas encore traduit ».
 *
 * Loi n° 2024/017 sur les données personnelles : consentement explicite, libre et éclairé (à faire valider par un juriste).
 */
export const CONSENTEMENT = {
  titre: 'Avant de commencer',
  points: [
    "Kama lit la page de ta banque sur ton écran, puis l'oublie. Il ne garde rien.",
    'Tes montants, ton solde et les noms ne sont jamais envoyés.',
    'Pour traduire, Kama envoie seulement des phrases sans chiffres ni noms.',
    'Tu peux arrêter Kama quand tu veux, dans le menu de l\u2019extension.',
  ],
  accepter: "J'accepte",
  refuser: 'Pas maintenant',
} as const;

export const CONSENTEMENT_MICRO = {
  titre: 'Parler à Kama',
  points: [
    "Le micro est ouvert seulement entre deux appuis sur le bouton. Kama ne garde aucun enregistrement.",
    'Ta voix est envoyée au serveur de Kama pour comprendre ta demande, puis oubliée.',
    'Ne dis pas ton solde, ton numéro ni un nom : parle seulement de la page.',
  ],
  accepter: "J'accepte",
  refuser: 'Pas maintenant',
} as const;
