import { useMemo, type ReactNode } from 'react'
import { cheminBlob, parametresAvatar, type ParametresAvatar } from '../utils/avatar.js'

const CX = 32
const CY = 35

const TRAIT = 'var(--color-primary-foreground)'
const CORPS = 'var(--color-primary)'

function Yeux({ p }: { p: ParametresAvatar }): ReactNode {
  const y = CY - 3
  const gauche = CX - p.ecartYeux
  const droite = CX + p.ecartYeux
  switch (p.yeux) {
    case 'points':
      return (
        <>
          <circle cx={gauche} cy={y} r={2.3} fill={TRAIT} />
          <circle cx={droite} cy={y} r={2.3} fill={TRAIT} />
        </>
      )
    case 'grands':
      return (
        <>
          {[gauche, droite].map((x) => (
            <g key={x}>
              <circle cx={x} cy={y} r={4} fill={TRAIT} />
              <circle cx={x + 0.8} cy={y + 0.6} r={1.8} fill={CORPS} />
            </g>
          ))}
        </>
      )
    case 'contents':
      return (
        <>
          {[gauche, droite].map((x) => (
            <path key={x} d={`M${x - 3} ${y + 1.5}Q${x} ${y - 4} ${x + 3} ${y + 1.5}`} fill="none" stroke={TRAIT} strokeWidth={2} strokeLinecap="round" />
          ))}
        </>
      )
    case 'endormis':
      return (
        <>
          {[gauche, droite].map((x) => (
            <path key={x} d={`M${x - 3} ${y - 0.5}Q${x} ${y + 3} ${x + 3} ${y - 0.5}`} fill="none" stroke={TRAIT} strokeWidth={2} strokeLinecap="round" />
          ))}
        </>
      )
    case 'cyclope':
      return (
        <>
          <circle cx={CX} cy={y} r={5.5} fill={TRAIT} />
          <circle cx={CX + 0.8} cy={y + 0.6} r={2.6} fill={CORPS} />
        </>
      )
  }
}

function Bouche({ p }: { p: ParametresAvatar }): ReactNode {
  const y = CY + 7
  switch (p.bouche) {
    case 'sourire':
      return <path d={`M${CX - 5} ${y}Q${CX} ${y + 5.5} ${CX + 5} ${y}`} fill="none" stroke={TRAIT} strokeWidth={2} strokeLinecap="round" />
    case 'ouverte':
      return <path d={`M${CX - 5} ${y - 0.5}Q${CX} ${y + 10} ${CX + 5} ${y - 0.5}Z`} fill={TRAIT} />
    case 'plate':
      return <path d={`M${CX - 3.5} ${y + 1}L${CX + 3.5} ${y + 1}`} fill="none" stroke={TRAIT} strokeWidth={2} strokeLinecap="round" />
    case 'o':
      return <circle cx={CX} cy={y + 1.5} r={2.6} fill="none" stroke={TRAIT} strokeWidth={2} />
  }
}

/** Détail posé sur la tête, dessiné derrière la créature (la forme molle le recouvre à la base). */
function Accessoire({ p }: { p: ParametresAvatar }): ReactNode {
  const haut = CY - Math.min(...p.rayons) + 2
  switch (p.accessoire) {
    case 'aucun':
      return null
    case 'pousse':
      return (
        <g>
          <path d={`M${CX} ${haut + 6}L${CX} ${haut - 2}`} stroke={CORPS} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <path d={`M${CX} ${haut - 2}C${CX - 6} ${haut - 8} ${CX - 11} ${haut - 6} ${CX - 11} ${haut - 2}C${CX - 6} ${haut - 1} ${CX - 3} ${haut - 1} ${CX} ${haut - 2}Z`} fill={CORPS} />
          <path d={`M${CX} ${haut - 2}C${CX + 6} ${haut - 8} ${CX + 11} ${haut - 6} ${CX + 11} ${haut - 2}C${CX + 6} ${haut - 1} ${CX + 3} ${haut - 1} ${CX} ${haut - 2}Z`} fill={CORPS} />
        </g>
      )
    case 'antenne':
      return (
        <g>
          <path d={`M${CX} ${haut + 6}L${CX} ${haut - 3}`} stroke={CORPS} strokeWidth={2} strokeLinecap="round" fill="none" />
          <circle cx={CX} cy={haut - 4.5} r={3.2} fill={CORPS} />
        </g>
      )
    case 'meche':
      return (
        <g fill="none" stroke={CORPS} strokeWidth={2.4} strokeLinecap="round">
          <path d={`M${CX - 3} ${haut + 5}Q${CX - 6} ${haut - 3} ${CX} ${haut - 4}`} />
          <path d={`M${CX + 2} ${haut + 5}Q${CX + 1} ${haut - 2} ${CX + 7} ${haut - 3}`} />
        </g>
      )
  }
}

/**
 * Avatar de profil : une petite créature-bulle propre à chaque utilisateur (cf. `utils/avatar.ts`).
 * Les couleurs sont celles du thème (variables CSS) : l'avatar suit la couleur choisie par
 * l'utilisateur, y compris dans l'aperçu de l'éditeur d'apparence. Purement décoratif : le nom
 * de la personne est toujours affiché ou fourni à côté (`aria-hidden`).
 */
export default function AvatarProfil({ graine, taille = 36 }: { graine: string; taille?: number }) {
  const p = useMemo(() => parametresAvatar(graine), [graine])
  const contour = useMemo(() => cheminBlob(p.rayons, CX, CY), [p.rayons])
  return (
    <span
      aria-hidden="true"
      data-avatar=""
      style={{
        display: 'inline-flex',
        width: taille,
        height: taille,
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        backgroundColor: 'var(--color-primary-light)',
        boxShadow: 'inset 0 0 0 1px var(--color-primary-border)',
      }}
    >
      <svg viewBox="0 0 64 64" width={taille} height={taille} focusable="false">
        <g transform={`rotate(${p.inclinaison.toFixed(1)} ${CX} ${CY})`}>
          <Accessoire p={p} />
          <path d={contour} fill={CORPS} data-corps="" />
          {p.joues && (
            <>
              <ellipse cx={CX - 11.5} cy={CY + 4} rx={3.2} ry={2} fill={TRAIT} opacity={0.28} />
              <ellipse cx={CX + 11.5} cy={CY + 4} rx={3.2} ry={2} fill={TRAIT} opacity={0.28} />
            </>
          )}
          <Yeux p={p} />
          <Bouche p={p} />
        </g>
      </svg>
    </span>
  )
}
