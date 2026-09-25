import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SelecteurTeinte from './SelecteurTeinte.js'

function rendre(teinte: number) {
  const onChange = vi.fn()
  render(<SelecteurTeinte teinte={teinte} onChange={onChange} couleurCentre="#336699" />)
  return { onChange, curseur: screen.getByRole('slider', { name: 'Teinte' }) }
}

const RECTANGLE = { left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) }

describe('SelecteurTeinte — accessibilité', () => {
  it('expose un curseur nommé avec ses bornes, sa valeur et le nom de la couleur', () => {
    const { curseur } = rendre(255)
    expect(curseur).toHaveAttribute('aria-valuemin', '0')
    expect(curseur).toHaveAttribute('aria-valuemax', '359')
    expect(curseur).toHaveAttribute('aria-valuenow', '255')
    expect(curseur).toHaveAttribute('aria-valuetext', 'bleu, 255 degrés')
    expect(curseur).toHaveAttribute('tabindex', '0')
  })
})

describe('SelecteurTeinte — clavier', () => {
  it.each([
    ['{ArrowRight}', 101],
    ['{ArrowUp}', 101],
    ['{ArrowLeft}', 99],
    ['{ArrowDown}', 99],
    ['{PageUp}', 110],
    ['{PageDown}', 90],
    ['{Home}', 0],
    ['{End}', 359],
  ])('%s depuis 100° donne %s°', async (touche, attendu) => {
    const { onChange, curseur } = rendre(100)
    curseur.focus()
    await userEvent.keyboard(touche)
    expect(onChange).toHaveBeenCalledWith(attendu)
  })

  it('boucle autour du cercle : 359° → 0°', async () => {
    const { onChange, curseur } = rendre(359)
    curseur.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('boucle autour du cercle : 0° → 359°, et PageDown depuis 5° reste dans [0, 359]', async () => {
    const bas = rendre(0)
    bas.curseur.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(bas.onChange).toHaveBeenCalledWith(359)
  })

  it('PageDown depuis 5° donne 355°', async () => {
    const { onChange, curseur } = rendre(5)
    curseur.focus()
    await userEvent.keyboard('{PageDown}')
    expect(onChange).toHaveBeenCalledWith(355)
  })

  it('ignore les autres touches', async () => {
    const { onChange, curseur } = rendre(100)
    curseur.focus()
    await userEvent.keyboard('a')
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('SelecteurTeinte — pointeur', () => {
  function appuyer(x: number, y: number) {
    const { onChange, curseur } = rendre(0)
    curseur.getBoundingClientRect = () => RECTANGLE
    fireEvent.pointerDown(curseur, { clientX: x, clientY: y, pointerId: 1 })
    return onChange
  }

  it.each([
    ['haut', 100, 0, 0],
    ['droite', 200, 100, 90],
    ['bas', 100, 200, 180],
    ['gauche', 0, 100, 270],
  ])('un appui en %s de l’anneau donne %s°', (_nom, x, y, attendu) => {
    expect(appuyer(x, y)).toHaveBeenCalledWith(attendu)
  })

  it('un appui exactement au centre ne change rien (angle indéfini)', () => {
    expect(appuyer(100, 100)).not.toHaveBeenCalled()
  })

  it('le glissement (bouton enfoncé) met à jour la teinte, le survol simple non', () => {
    const { onChange, curseur } = rendre(0)
    curseur.getBoundingClientRect = () => RECTANGLE
    fireEvent.pointerMove(curseur, { clientX: 200, clientY: 100, buttons: 0 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.pointerMove(curseur, { clientX: 200, clientY: 100, buttons: 1 })
    expect(onChange).toHaveBeenCalledWith(90)
  })
})
