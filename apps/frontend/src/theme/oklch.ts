/**
 * Conversions sRGB ⇄ OKLab/OKLCH (Björn Ottosson, domaine public), sans dépendance.
 *
 * OKLCH est perceptuel : deux couleurs de même L ont la même clarté apparente, et la teinte h
 * ne dérive pas quand on change L ou C — contrairement à HSL. C'est ce qui permet de fixer la
 * luminosité par un calcul de contraste tout en laissant l'utilisateur choisir la teinte.
 */

export interface Oklch {
  L: number
  C: number
  /** Teinte en degrés, [0, 360). */
  h: number
}

type Trio = [number, number, number]

const EPSILON_GAMUT = 1e-6

export function srgbVersLineaire(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function lineaireVersSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}

/** `#rrggbb` (insensible à la casse) → canaux 0–255. */
export function hexVersRgb(hex: string): Trio {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) throw new Error(`Couleur hexadécimale invalide : ${hex}`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbVersHex([r, g, b]: Trio): string {
  return (
    '#' +
    [r, g, b]
      .map((c) =>
        Math.round(Math.min(255, Math.max(0, c)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  )
}

function lineaireVersOklab([r, g, b]: Trio): Trio {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** Canaux sRGB *linéaires*, non bornés (peuvent sortir de [0, 1] hors gamut). */
export function oklchVersLineaire(L: number, C: number, h: number): Trio {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function hexVersOklch(hex: string): Oklch {
  const lineaire = hexVersRgb(hex).map((c) => srgbVersLineaire(c / 255)) as Trio
  const [L, a, b] = lineaireVersOklab(lineaire)
  const C = Math.hypot(a, b)
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  return { L, C, h }
}

export function dansLeGamut(L: number, C: number, h: number): boolean {
  return oklchVersLineaire(L, C, h).every((c) => c >= -EPSILON_GAMUT && c <= 1 + EPSILON_GAMUT)
}

/**
 * Plus grande chroma ≤ C qui tient dans le gamut sRGB, à L et h constants (bisection).
 * Réduire la chroma plutôt que couper les canaux préserve la teinte et la clarté.
 */
export function reduireChromaAuGamut(L: number, C: number, h: number): number {
  if (dansLeGamut(L, C, h)) return C
  let bas = 0
  let haut = C
  for (let i = 0; i < 24; i++) {
    const milieu = (bas + haut) / 2
    if (dansLeGamut(L, milieu, h)) bas = milieu
    else haut = milieu
  }
  return bas
}

function borne01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/** OKLCH → `#RRGGBB`, en réduisant d'abord la chroma pour rester dans le gamut sRGB. */
export function oklchVersHex(L: number, C: number, h: number): string {
  const chroma = reduireChromaAuGamut(L, C, h)
  const [r, g, b] = oklchVersLineaire(L, chroma, h)
  return rgbVersHex([
    lineaireVersSrgb(borne01(r)) * 255,
    lineaireVersSrgb(borne01(g)) * 255,
    lineaireVersSrgb(borne01(b)) * 255,
  ])
}
