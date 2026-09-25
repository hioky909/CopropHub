import { describe, expect, it } from 'vitest'
import { CONTRASTE_PRIMAIRE_MIN, CONTRASTE_TEXTE_AA, entreesValides, genererTheme } from './genererTheme.js'
import { ratioContraste } from './contraste.js'
import { hexVersOklch } from './oklch.js'
import { nomTeinte } from './noms-teintes.js'

const HEX = /^#[0-9A-F]{6}$/

describe('genererTheme — garantie de lisibilité sur toutes les teintes', () => {
  it('respecte les seuils de contraste pour 360 teintes × 5 intensités', () => {
    const echecs: string[] = []
    for (let teinte = 0; teinte < 360; teinte++) {
      for (const intensite of [0, 25, 50, 75, 100]) {
        const p = genererTheme({ teinte, intensite })
        const id = `h${teinte}/i${intensite}`
        for (const couleur of Object.values(p).filter((v): v is string => typeof v === 'string')) {
          if (!HEX.test(couleur)) echecs.push(`${id} hex invalide ${couleur}`)
        }
        const verifs: [string, number, number][] = [
          ['primaire/blanc', ratioContraste(p.primaire, '#FFFFFF'), CONTRASTE_PRIMAIRE_MIN],
          ['primaire/fond', ratioContraste(p.primaire, p.fond), CONTRASTE_PRIMAIRE_MIN],
          ['primaire/clair', ratioContraste(p.primaire, p.primaireClair), CONTRASTE_PRIMAIRE_MIN],
          ['premier plan/primaire', ratioContraste(p.primairePremierPlan, p.primaire), CONTRASTE_TEXTE_AA],
          ['premier plan/survol', ratioContraste(p.primairePremierPlan, p.primaireSurvol), CONTRASTE_TEXTE_AA],
          ['texte secondaire/fond', ratioContraste('#5C5C5C', p.fond), CONTRASTE_TEXTE_AA],
          ['texte principal/fond', ratioContraste('#1A1A1A', p.fond), 7],
          ['texte principal/clair', ratioContraste('#1A1A1A', p.primaireClair), 7],
        ]
        for (const [nom, ratio, min] of verifs) {
          if (ratio < min) echecs.push(`${id} ${nom} = ${ratio.toFixed(2)} < ${min}`)
        }
      }
    }
    expect(echecs).toEqual([])
  })

  it('est déterministe', () => {
    expect(genererTheme({ teinte: 145, intensite: 60 })).toEqual(genererTheme({ teinte: 145, intensite: 60 }))
  })

  it('le survol est plus foncé que le primaire', () => {
    for (const teinte of [0, 100, 145, 255, 330]) {
      const p = genererTheme({ teinte, intensite: 60 })
      expect(hexVersOklch(p.primaireSurvol).L).toBeLessThan(hexVersOklch(p.primaire).L)
    }
  })

  it('la teinte demandée est respectée (bleu, vert)', () => {
    expect(Math.abs(hexVersOklch(genererTheme({ teinte: 255, intensite: 70 }).primaire).h - 255)).toBeLessThan(5)
    expect(Math.abs(hexVersOklch(genererTheme({ teinte: 145, intensite: 70 }).primaire).h - 145)).toBeLessThan(5)
  })

  it('l’intensité 0 donne un gris valide, l’intensité 100 une couleur vive', () => {
    expect(hexVersOklch(genererTheme({ teinte: 255, intensite: 0 }).primaire).C).toBeLessThan(0.05)
    expect(hexVersOklch(genererTheme({ teinte: 255, intensite: 100 }).primaire).C).toBeGreaterThan(0.1)
  })

  it('les teintes difficiles (jaune, cyan) sont ajustées sans erreur ; le bleu n’est pas ajusté', () => {
    expect(genererTheme({ teinte: 100, intensite: 100 }).ajuste).toBe(true)
    expect(() => genererTheme({ teinte: 200, intensite: 100 })).not.toThrow()
    expect(genererTheme({ teinte: 255, intensite: 60 }).ajuste).toBe(false)
  })

  it('rejette les entrées invalides', () => {
    for (const e of [
      { teinte: 360, intensite: 50 },
      { teinte: -1, intensite: 50 },
      { teinte: 1.5, intensite: 50 },
      { teinte: 10, intensite: 101 },
      { teinte: 10, intensite: -1 },
      { teinte: NaN, intensite: 50 },
      { teinte: '10' as unknown as number, intensite: 50 },
    ]) {
      expect(entreesValides(e)).toBe(false)
      expect(() => genererTheme(e)).toThrow()
    }
  })
})

describe('nomTeinte', () => {
  it('donne un nom de couleur français, y compris autour du zéro', () => {
    expect(nomTeinte(255)).toBe('bleu')
    expect(nomTeinte(145)).toBe('vert')
    expect(nomTeinte(29)).toBe('rouge')
    expect(nomTeinte(355)).toBe('rose')
    expect(nomTeinte(0)).toBe('rose')
  })
})
