import { afterEach, describe, expect, it } from 'vitest'
import { appliquerTheme } from './appliquerTheme.js'
import { genererTheme } from './genererTheme.js'
import { ecrireThemeCache, effacerThemeCache, lireThemeCache } from './themeStorage.js'

afterEach(() => localStorage.clear())

describe('appliquerTheme', () => {
  it('pose puis retire exactement les 6 variables du thème sur l’élément ciblé', () => {
    const el = document.createElement('div')
    const palette = genererTheme({ teinte: 145, intensite: 60 })
    appliquerTheme(el, palette)
    expect(el.style.getPropertyValue('--color-primary')).toBe(palette.primaire)
    expect(el.style.getPropertyValue('--color-background')).toBe(palette.fond)
    expect(el.style.length).toBe(6)
    appliquerTheme(el, null)
    expect(el.style.length).toBe(0)
  })
})

describe('themeStorage', () => {
  it('écrit, relit et efface', () => {
    expect(lireThemeCache()).toBeNull()
    ecrireThemeCache({ teinte: 145, intensite: 60 })
    expect(lireThemeCache()).toEqual({ teinte: 145, intensite: 60 })
    effacerThemeCache()
    expect(lireThemeCache()).toBeNull()
  })

  it('une valeur corrompue ou hors plage vaut « pas de thème »', () => {
    for (const brut of ['pas du json', '{"teinte":999,"intensite":1}', '{"teinte":"red","intensite":5}', 'null', '[]']) {
      localStorage.setItem('coprophub.theme', brut)
      expect(lireThemeCache()).toBeNull()
    }
  })
})
