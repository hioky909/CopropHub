/**
 * Avatar de profil généré : une petite « créature-bulle » organique (forme molle au contour
 * irrégulier, un visage, parfois une pousse ou une antenne), propre à chaque utilisateur.
 * Tout est dérivé de l'identifiant (aucune donnée stockée, aucun serveur) : même graine, même
 * avatar, toujours. Les couleurs ne sont pas ici : le composant les prend dans le thème.
 */

export type StyleYeux = 'points' | 'grands' | 'contents' | 'endormis' | 'cyclope'
export type StyleBouche = 'sourire' | 'ouverte' | 'plate' | 'o'
export type Accessoire = 'aucun' | 'pousse' | 'antenne' | 'meche'

export interface ParametresAvatar {
  /** Rayons (en unités d'un canevas de 64) des 8 points du contour, dans le sens horaire. */
  rayons: number[]
  yeux: StyleYeux
  bouche: StyleBouche
  accessoire: Accessoire
  joues: boolean
  /** Demi-écart entre les yeux. */
  ecartYeux: number
  /** Inclinaison de la créature, en degrés. */
  inclinaison: number
}

/** FNV-1a 32 bits : rapide, sans dépendance, bien réparti sur des identifiants. */
export function hash32(texte: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : renvoie des nombres dans [0, 1). */
export function generateur(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function choisir<T>(alea: () => number, options: readonly T[]): T {
  return options[Math.floor(alea() * options.length)]!
}

export const NOMBRE_POINTS = 8
export const RAYON_MIN = 18
export const RAYON_MAX = 23

export function parametresAvatar(graine: string): ParametresAvatar {
  const alea = generateur(hash32(graine))
  const rayons = Array.from({ length: NOMBRE_POINTS }, () => RAYON_MIN + alea() * (RAYON_MAX - RAYON_MIN))
  return {
    rayons,
    yeux: choisir(alea, ['points', 'grands', 'contents', 'endormis', 'cyclope'] as const),
    bouche: choisir(alea, ['sourire', 'ouverte', 'plate', 'o'] as const),
    accessoire: choisir(alea, ['aucun', 'pousse', 'antenne', 'meche'] as const),
    joues: alea() < 0.5,
    ecartYeux: 5 + alea() * 2.5,
    inclinaison: -8 + alea() * 16,
  }
}

const arrondi = (n: number) => Math.round(n * 100) / 100

/**
 * Contour lisse et fermé passant par les points (un par rayon, répartis autour de (cx, cy)) :
 * spline de Catmull-Rom convertie en courbes de Bézier cubiques.
 */
export function cheminBlob(rayons: number[], cx: number, cy: number): string {
  const n = rayons.length
  const points = rayons.map((r, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
  const p = (i: number) => points[((i % n) + n) % n]!
  let d = `M${arrondi(p(0).x)} ${arrondi(p(0).y)}`
  for (let i = 0; i < n; i++) {
    const c1x = p(i).x + (p(i + 1).x - p(i - 1).x) / 6
    const c1y = p(i).y + (p(i + 1).y - p(i - 1).y) / 6
    const c2x = p(i + 1).x - (p(i + 2).x - p(i).x) / 6
    const c2y = p(i + 1).y - (p(i + 2).y - p(i).y) / 6
    d += `C${arrondi(c1x)} ${arrondi(c1y)} ${arrondi(c2x)} ${arrondi(c2y)} ${arrondi(p(i + 1).x)} ${arrondi(p(i + 1).y)}`
  }
  return d + 'Z'
}
