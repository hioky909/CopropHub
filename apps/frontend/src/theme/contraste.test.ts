import { describe, expect, it } from 'vitest'
import { meilleurPremierPlan, ratioContraste } from './contraste.js'

describe('contraste WCAG', () => {
  it('noir sur blanc = 21, identiques = 1', () => {
    expect(ratioContraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(ratioContraste('#123456', '#123456')).toBeCloseTo(1, 5)
  })

  it('reproduit les ratios du design system (Doc 4)', () => {
    expect(ratioContraste('#1E4B8F', '#FFFFFF')).toBeGreaterThan(8)
    expect(ratioContraste('#5C5C5C', '#FFFFFF')).toBeGreaterThan(6.4)
    expect(ratioContraste('#1A1A1A', '#FFFFFF')).toBeGreaterThan(16)
  })

  it('est symétrique', () => {
    expect(ratioContraste('#B3261E', '#FDECEA')).toBeCloseTo(ratioContraste('#FDECEA', '#B3261E'), 10)
  })

  it('choisit blanc sur fond sombre et quasi-noir sur fond clair', () => {
    expect(meilleurPremierPlan('#1E4B8F')).toBe('#FFFFFF')
    expect(meilleurPremierPlan('#FFE066')).toBe('#1A1A1A')
  })
})
