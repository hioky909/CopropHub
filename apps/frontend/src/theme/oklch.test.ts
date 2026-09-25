import { describe, expect, it } from 'vitest'
import { dansLeGamut, hexVersOklch, hexVersRgb, oklchVersHex, reduireChromaAuGamut, rgbVersHex } from './oklch.js'

describe('conversions OKLCH', () => {
  it('blanc : L = 1, chroma nulle ; noir : L = 0', () => {
    const blanc = hexVersOklch('#FFFFFF')
    expect(blanc.L).toBeCloseTo(1, 4)
    expect(blanc.C).toBeCloseTo(0, 4)
    expect(hexVersOklch('#000000').L).toBeCloseTo(0, 4)
  })

  it('valeurs de référence de la spécification OKLab (rouge, vert, bleu purs)', () => {
    const rouge = hexVersOklch('#FF0000')
    expect(rouge.L).toBeCloseTo(0.628, 3)
    expect(rouge.C).toBeCloseTo(0.2577, 3)
    expect(rouge.h).toBeCloseTo(29.23, 1)
    const vert = hexVersOklch('#00FF00')
    expect(vert.L).toBeCloseTo(0.8664, 3)
    expect(vert.h).toBeCloseTo(142.5, 0)
    const bleu = hexVersOklch('#0000FF')
    expect(bleu.L).toBeCloseTo(0.452, 3)
    expect(bleu.h).toBeCloseTo(264.05, 1)
  })

  it('aller-retour sRGB → OKLCH → sRGB à ±1/255 sur 1 000 couleurs déterministes', () => {
    for (let i = 0; i < 1000; i++) {
      const rgb: [number, number, number] = [(i * 37) % 256, (i * 91 + 13) % 256, (i * 53 + 101) % 256]
      const { L, C, h } = hexVersOklch(rgbVersHex(rgb))
      const retour = hexVersRgb(oklchVersHex(L, C, h))
      rgb.forEach((c, k) => expect(Math.abs(retour[k]! - c)).toBeLessThanOrEqual(1))
    }
  })

  it('rejette une couleur hexadécimale invalide', () => {
    expect(() => hexVersRgb('red')).toThrow()
    expect(() => hexVersRgb('#12345')).toThrow()
    expect(() => hexVersRgb('#12345g')).toThrow()
  })
})

describe('gamut sRGB', () => {
  it('une chroma démesurée est hors gamut et se réduit en gardant L et h', () => {
    expect(dansLeGamut(0.5, 0.4, 250)).toBe(false)
    const c = reduireChromaAuGamut(0.5, 0.4, 250)
    expect(c).toBeGreaterThan(0)
    expect(c).toBeLessThan(0.4)
    expect(dansLeGamut(0.5, c, 250)).toBe(true)
    const retour = hexVersOklch(oklchVersHex(0.5, 0.4, 250))
    expect(retour.L).toBeCloseTo(0.5, 1)
    expect(retour.h).toBeCloseTo(250, 0)
  })

  it('une couleur déjà dans le gamut garde sa chroma', () => {
    expect(reduireChromaAuGamut(0.5, 0.05, 250)).toBe(0.05)
  })
})
