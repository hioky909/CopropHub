/** Nom de couleur en français d'une teinte OKLCH, pour les lecteurs d'écran (`aria-valuetext`). */
const REPERES: { nom: string; teinte: number }[] = [
  { nom: 'rouge', teinte: 29 },
  { nom: 'orange', teinte: 55 },
  { nom: 'jaune', teinte: 100 },
  { nom: 'vert', teinte: 145 },
  { nom: 'sarcelle', teinte: 190 },
  { nom: 'bleu', teinte: 255 },
  { nom: 'violet', teinte: 300 },
  { nom: 'rose', teinte: 350 },
]

export function nomTeinte(teinte: number): string {
  let meilleur = REPERES[0]!
  let ecartMin = Infinity
  for (const repere of REPERES) {
    const brut = Math.abs(teinte - repere.teinte)
    const ecart = Math.min(brut, 360 - brut)
    if (ecart < ecartMin) {
      ecartMin = ecart
      meilleur = repere
    }
  }
  return meilleur.nom
}
