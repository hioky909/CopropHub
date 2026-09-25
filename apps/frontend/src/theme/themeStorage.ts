import { entreesValides, type EntreesTheme } from './genererTheme.js'

/**
 * Cache local du thème (uniquement teinte et intensité, aucune donnée personnelle) pour éviter un
 * flash de la couleur d'origine avant la réponse de `/auth/moi`. La source de vérité reste le
 * serveur. Tout accès est protégé : le stockage peut être absent ou bloqué.
 */
const CLE = 'coprophub.theme'

export function lireThemeCache(): EntreesTheme | null {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return null
    const valeur = JSON.parse(brut) as Partial<EntreesTheme> | null
    if (!valeur || typeof valeur !== 'object') return null
    const entrees = { teinte: valeur.teinte as number, intensite: valeur.intensite as number }
    return entreesValides(entrees) ? entrees : null
  } catch {
    return null
  }
}

export function ecrireThemeCache(entrees: EntreesTheme): void {
  try {
    localStorage.setItem(CLE, JSON.stringify({ teinte: entrees.teinte, intensite: entrees.intensite }))
  } catch {
    /* stockage indisponible : le cache n'est qu'une optimisation */
  }
}

export function effacerThemeCache(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    /* idem */
  }
}
