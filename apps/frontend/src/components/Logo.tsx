/**
 * Logo de CopropHub : un toit en chevron qui abrite un « hub » (nœud central relié à six points) —
 * l'immeuble et la communauté qui se réunit. Redessiné en SVG à partir du logo retenu (option 2).
 *
 * Un seul aplat de couleur : le symbole prend la couleur du texte courant (`currentColor`) et les
 * composants ci-dessous le règlent sur `--color-primary`, donc le logo suit le thème choisi par
 * l'utilisateur. Le nom est du vrai texte (police de l'application), pas une image.
 */

/** Coordonnées dans un canevas de 100 × 92. */
const NOEUDS = [
  [49.9, 33.1],
  [66.7, 46.3],
  [76.9, 67.8],
  [49.9, 86.5],
  [31.1, 77.4],
  [22.9, 54.0],
] as const
const CENTRE = [49.9, 60.6] as const

/** Symbole seul, à la hauteur demandée (largeur proportionnelle). Décoratif. */
export function Symbole({ hauteur = 28 }: { hauteur?: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 92"
      width={(hauteur * 100) / 92}
      height={hauteur}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <path d="M5.8 43.8 49.9 7.4 93.9 43.8" fill="none" stroke="currentColor" strokeWidth={11.3} strokeLinecap="round" strokeLinejoin="round" />
      <g stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
        {NOEUDS.map(([x, y]) => (
          <line key={`${x}-${y}`} x1={CENTRE[0]} y1={CENTRE[1]} x2={x} y2={y} />
        ))}
      </g>
      <circle cx={CENTRE[0]} cy={CENTRE[1]} r={9.4} fill="currentColor" />
      {NOEUDS.map(([x, y]) => (
        <circle key={`n-${x}-${y}`} cx={x} cy={y} r={5} fill="currentColor" />
      ))}
    </svg>
  )
}

/** Logo horizontal : symbole + « CopropHub », dans la couleur principale du thème. */
export function LogoHorizontal({ taille = 30 }: { taille?: number }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(taille * 0.33),
        color: 'var(--color-primary)',
        fontSize: Math.round(taille * 0.62),
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
    >
      <Symbole hauteur={taille} />
      <span>CopropHub</span>
    </span>
  )
}

/** « Icône d'application » : symbole blanc sur un carré aux coins arrondis, dans la couleur du thème. */
export function IconeApplication({ taille = 40 }: { taille?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: taille,
        height: taille,
        borderRadius: Math.round(taille * 0.24),
        backgroundColor: 'var(--color-primary)',
        color: 'var(--color-primary-foreground)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Symbole hauteur={Math.round(taille * 0.56)} />
    </span>
  )
}
