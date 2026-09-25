import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IconeApplication, LogoHorizontal, Symbole } from './Logo.js'

describe('Symbole', () => {
  it('dessine le toit et les 7 nœuds du hub (1 centre + 6 points), décoratif et à la bonne hauteur', () => {
    const { container } = render(<Symbole hauteur={46} />)
    const svg = container.querySelector('svg')!
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('height', '46')
    expect(svg).toHaveAttribute('width', '50') // proportions 100 × 92
    expect(container.querySelectorAll('path')).toHaveLength(1) // le toit
    expect(container.querySelectorAll('circle')).toHaveLength(7)
    expect(container.querySelectorAll('line')).toHaveLength(6)
  })

  it('est en un seul aplat de la couleur du texte : aucune couleur en dur, il suit donc le thème', () => {
    const { container } = render(<Symbole />)
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(container.innerHTML).toContain('currentColor')
  })
})

describe('LogoHorizontal', () => {
  it('affiche le nom « CopropHub » en vrai texte, dans la couleur principale du thème', () => {
    render(<LogoHorizontal />)
    const nom = screen.getByText('CopropHub')
    expect(nom).toBeInTheDocument()
    expect((nom.parentElement as HTMLElement).style.color).toBe('var(--color-primary)')
  })
})

describe('IconeApplication', () => {
  it('est un carré aux coins arrondis dans la couleur du thème, symbole en couleur de premier plan', () => {
    const { container } = render(<IconeApplication taille={48} />)
    const carre = container.firstElementChild as HTMLElement
    expect(carre).toHaveAttribute('aria-hidden', 'true')
    expect(carre.style.width).toBe('48px')
    expect(carre.style.backgroundColor).toBe('var(--color-primary)')
    expect(carre.style.color).toBe('var(--color-primary-foreground)')
    expect(container.querySelectorAll('circle')).toHaveLength(7)
  })
})
