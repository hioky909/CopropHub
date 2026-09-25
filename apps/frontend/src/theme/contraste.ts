import { hexVersRgb, srgbVersLineaire } from './oklch.js'

/** Luminance relative WCAG 2.x d'une couleur `#rrggbb`. */
export function luminanceRelative(hex: string): number {
  const [r, g, b] = hexVersRgb(hex).map((c) => srgbVersLineaire(c / 255)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Ratio de contraste WCAG 2.x, de 1 (identiques) à 21 (noir sur blanc). */
export function ratioContraste(hexA: string, hexB: string): number {
  const a = luminanceRelative(hexA)
  const b = luminanceRelative(hexB)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export const BLANC = '#FFFFFF'
export const TEXTE_FONCE = '#1A1A1A'

/** Blanc ou quasi-noir : celui qui se lit le mieux sur `fondHex`. */
export function meilleurPremierPlan(fondHex: string): string {
  return ratioContraste(BLANC, fondHex) >= ratioContraste(TEXTE_FONCE, fondHex) ? BLANC : TEXTE_FONCE
}
