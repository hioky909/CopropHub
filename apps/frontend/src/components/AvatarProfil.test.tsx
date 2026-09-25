import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import AvatarProfil from './AvatarProfil.js'
import Icone, { type NomIcone } from './Icones.js'

const UUID_A = '3f2a9c1e-5b7d-4e08-9a11-0c2d4f6a8b10'
const UUID_B = '9d4e1b72-0a3c-4f55-8e2b-7c1a5d9f3e64'

describe('AvatarProfil', () => {
  it('est décoratif (masqué aux lecteurs d’écran) et à la taille demandée', () => {
    const { container } = render(<AvatarProfil graine={UUID_A} taille={56} />)
    const conteneur = container.querySelector('[data-avatar]') as HTMLElement
    expect(conteneur).toHaveAttribute('aria-hidden', 'true')
    expect(conteneur.style.width).toBe('56px')
    expect(container.querySelector('svg')).toHaveAttribute('width', '56')
  })

  it('n’utilise que les variables du thème : aucune couleur en dur, donc il suit le thème choisi', () => {
    const { container } = render(<AvatarProfil graine={UUID_A} />)
    const html = container.innerHTML
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(html).toContain('var(--color-primary)')
    expect(html).toContain('var(--color-primary-foreground)')
    expect(html).toContain('var(--color-primary-light)')
  })

  it('même graine, même avatar ; graines différentes, avatars différents', () => {
    const rendu = (g: string) => render(<AvatarProfil graine={g} />).container.innerHTML
    expect(rendu(UUID_A)).toBe(rendu(UUID_A))
    expect(rendu(UUID_A)).not.toBe(rendu(UUID_B))
  })

  it('dessine toujours un contour (path) et un visage, sans valeur invalide, pour 200 identifiants', () => {
    for (let i = 0; i < 200; i++) {
      const { container, unmount } = render(<AvatarProfil graine={`utilisateur-${i}`} />)
      expect(container.querySelectorAll('path').length).toBeGreaterThanOrEqual(1)
      expect(container.querySelectorAll('circle, path').length).toBeGreaterThanOrEqual(3) // contour + yeux + bouche
      expect(container.innerHTML).not.toMatch(/NaN|undefined|Infinity/)
      unmount()
    }
  })
})

describe('Icone', () => {
  const NOMS: NomIcone[] = ['tableau-de-bord', 'coproprietaires', 'assemblees', 'incidents', 'charges', 'compte', 'deconnexion']

  it.each(NOMS)('l’icône « %s » est décorative, prend la couleur du texte et a un tracé', (nom) => {
    const { container } = render(<Icone nom={nom} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg.children.length).toBeGreaterThan(0)
  })
})
