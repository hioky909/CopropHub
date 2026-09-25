import { useMemo, type KeyboardEvent, type PointerEvent } from 'react'
import { nomTeinte } from '../theme/noms-teintes.js'
import { oklchVersHex } from '../theme/oklch.js'

const TAILLE = 200
const EPAISSEUR_ANNEAU = 30
const TAILLE_POIGNEE = 44

interface SelecteurTeinteProps {
  /** Teinte OKLCH en degrés, entier 0–359. */
  teinte: number
  onChange: (teinte: number) => void
  /** Couleur affichée au centre de l'anneau (le primaire généré, pour visualiser le résultat). */
  couleurCentre: string
}

/**
 * Anneau de teinte : un seul curseur circulaire (`role="slider"`). Souris et tactile (glisser),
 * clavier : ←/→/↑/↓ ±1°, PageUp/PageDown ±10°, Home 0°, End 359°. La teinte 0 est en haut, croissant
 * dans le sens horaire (comme `conic-gradient`).
 */
export default function SelecteurTeinte({ teinte, onChange, couleurCentre }: SelecteurTeinteProps) {
  const degrade = useMemo(() => {
    const arrets = Array.from({ length: 25 }, (_, i) => `${oklchVersHex(0.72, 0.14, i * 15)} ${(i / 24) * 360}deg`)
    return `conic-gradient(from 0deg, ${arrets.join(', ')})`
  }, [])

  function depuisPointeur(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    if (dx === 0 && dy === 0) return
    const angle = (Math.atan2(dx, -dy) * 180) / Math.PI // 0° en haut, sens horaire
    onChange(Math.round((angle + 360) % 360) % 360)
  }

  function surTouche(e: KeyboardEvent<HTMLDivElement>) {
    const pas: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }
    if (e.key in pas) {
      e.preventDefault()
      onChange((((teinte + pas[e.key]!) % 360) + 360) % 360)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(359)
    }
  }

  const rayon = TAILLE / 2 - EPAISSEUR_ANNEAU / 2
  const rad = (teinte * Math.PI) / 180
  const x = TAILLE / 2 + rayon * Math.sin(rad) - TAILLE_POIGNEE / 2
  const y = TAILLE / 2 - rayon * Math.cos(rad) - TAILLE_POIGNEE / 2

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Teinte"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={teinte}
      aria-valuetext={`${nomTeinte(teinte)}, ${teinte} degrés`}
      onKeyDown={surTouche}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        depuisPointeur(e)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) depuisPointeur(e)
      }}
      className="selecteur-teinte"
      style={{
        position: 'relative',
        width: TAILLE,
        height: TAILLE,
        borderRadius: '50%',
        background: degrade,
        touchAction: 'none',
        cursor: 'pointer',
        margin: '0 auto',
        flexShrink: 0,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: EPAISSEUR_ANNEAU,
          borderRadius: '50%',
          backgroundColor: 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '60%', height: '60%', borderRadius: '50%', backgroundColor: couleurCentre, border: '1px solid var(--color-neutral-200)' }} />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: TAILLE_POIGNEE,
          height: TAILLE_POIGNEE,
          borderRadius: '50%',
          border: '4px solid var(--color-surface)',
          boxShadow: '0 1px 4px var(--color-overlay)',
          backgroundColor: oklchVersHex(0.72, 0.14, teinte),
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
