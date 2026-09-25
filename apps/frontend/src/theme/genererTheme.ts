import { BLANC, meilleurPremierPlan, ratioContraste } from './contraste.js'
import { oklchVersHex, reduireChromaAuGamut } from './oklch.js'

/**
 * Génère la palette d'un thème personnalisé à partir de deux réglages de l'utilisateur.
 * Fonction pure et déterministe. L'utilisateur ne choisit jamais la luminosité : elle est
 * calculée pour que le texte reste lisible quelle que soit la teinte (WCAG 2.1 AA, avec marge).
 */
export interface EntreesTheme {
  /** Teinte OKLCH en degrés, entier 0–359. */
  teinte: number
  /** Intensité (chroma) de 0 (grisé) à 100 (très saturé), entier. */
  intensite: number
}

export interface PaletteTheme {
  primaire: string
  primaireSurvol: string
  primaireClair: string
  primaireBordure: string
  primairePremierPlan: string
  fond: string
  /** Vrai si la chroma demandée a dû être nettement réduite (gamut sRGB ou contraste). */
  ajuste: boolean
}

/** Contraste minimal du primaire, utilisé comme texte, sur blanc, fond de page et teinte claire. */
export const CONTRASTE_PRIMAIRE_MIN = 6
/** Seuil AA du texte normal, pour le premier plan et le survol. */
export const CONTRASTE_TEXTE_AA = 4.5

const L_PRIMAIRE_MAX = 0.55
const L_PRIMAIRE_MIN = 0.25
const PAS_L = 0.005

export function entreesValides(e: EntreesTheme): boolean {
  return (
    Number.isInteger(e.teinte) &&
    e.teinte >= 0 &&
    e.teinte <= 359 &&
    Number.isInteger(e.intensite) &&
    e.intensite >= 0 &&
    e.intensite <= 100
  )
}

export function genererTheme(entrees: EntreesTheme): PaletteTheme {
  if (!entreesValides(entrees)) {
    throw new Error('Thème invalide : teinte entière 0–359 et intensité entière 0–100 attendues.')
  }
  const { teinte: h, intensite } = entrees
  const c0 = 0.03 + (0.17 * intensite) / 100

  const clair = oklchVersHex(0.955, Math.min(0.35 * c0, 0.045), h)
  const primaireBordure = oklchVersHex(0.86, Math.min(0.5 * c0, 0.08), h)
  const fond = oklchVersHex(0.975, 0.004 + (0.004 * intensite) / 100, h)

  // Luminosité la plus haute (donc la plus vive) qui garde le primaire lisible comme texte.
  let L = L_PRIMAIRE_MIN
  let primaire = oklchVersHex(L, reduireChromaAuGamut(L, c0, h), h)
  for (let l = L_PRIMAIRE_MAX; l >= L_PRIMAIRE_MIN - 1e-9; l -= PAS_L) {
    const candidat = oklchVersHex(l, reduireChromaAuGamut(l, c0, h), h)
    if (
      ratioContraste(candidat, BLANC) >= CONTRASTE_PRIMAIRE_MIN &&
      ratioContraste(candidat, fond) >= CONTRASTE_PRIMAIRE_MIN &&
      ratioContraste(candidat, clair) >= CONTRASTE_PRIMAIRE_MIN
    ) {
      L = l
      primaire = candidat
      break
    }
  }
  const chromaFinale = reduireChromaAuGamut(L, c0, h)

  const lSurvol = Math.max(0.2, L - 0.05)
  const primaireSurvol = oklchVersHex(lSurvol, reduireChromaAuGamut(lSurvol, chromaFinale, h), h)

  return {
    primaire,
    primaireSurvol,
    primaireClair: clair,
    primaireBordure,
    primairePremierPlan: meilleurPremierPlan(primaire),
    fond,
    ajuste: chromaFinale < 0.75 * c0,
  }
}
