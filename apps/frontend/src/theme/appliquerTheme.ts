import type { PaletteTheme } from './genererTheme.js'

/** Variables CSS surchargées par un thème personnalisé (les sémantiques et les neutres ne le sont jamais). */
const VARIABLES = [
  '--color-primary',
  '--color-primary-hover',
  '--color-primary-light',
  '--color-primary-border',
  '--color-primary-foreground',
  '--color-background',
] as const

/**
 * Pose la palette sur un élément (`<html>` pour l'application, un conteneur pour l'aperçu) via le
 * CSSOM — jamais de balise `<style>` ni de chaîne CSS assemblée. `null` : retour au thème
 * d'origine défini dans `index.css`.
 */
export function appliquerTheme(cible: HTMLElement, palette: PaletteTheme | null): void {
  if (!palette) {
    VARIABLES.forEach((v) => cible.style.removeProperty(v))
    return
  }
  cible.style.setProperty('--color-primary', palette.primaire)
  cible.style.setProperty('--color-primary-hover', palette.primaireSurvol)
  cible.style.setProperty('--color-primary-light', palette.primaireClair)
  cible.style.setProperty('--color-primary-border', palette.primaireBordure)
  cible.style.setProperty('--color-primary-foreground', palette.primairePremierPlan)
  cible.style.setProperty('--color-background', palette.fond)
}
