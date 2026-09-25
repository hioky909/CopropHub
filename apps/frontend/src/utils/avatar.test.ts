import { describe, expect, it } from 'vitest'
import { NOMBRE_POINTS, RAYON_MAX, RAYON_MIN, cheminBlob, generateur, hash32, parametresAvatar } from './avatar.js'

const uuid = (i: number) => `${i.toString(16).padStart(8, '0')}-1234-4abc-8def-${(i * 7919).toString(16).padStart(12, '0')}`

describe('hash32 et générateur', () => {
  it('sont déterministes et sensibles à la graine', () => {
    expect(hash32('abc')).toBe(hash32('abc'))
    expect(hash32('abc')).not.toBe(hash32('abd'))
    const a = generateur(42)
    const b = generateur(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('le générateur reste dans [0, 1)', () => {
    const alea = generateur(hash32('x'))
    for (let i = 0; i < 1000; i++) {
      const v = alea()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('parametresAvatar', () => {
  it('est déterministe : même identifiant, même avatar', () => {
    expect(parametresAvatar(uuid(1))).toEqual(parametresAvatar(uuid(1)))
  })

  it('reste dans des bornes qui garantissent un visage lisible', () => {
    for (let i = 0; i < 500; i++) {
      const p = parametresAvatar(uuid(i))
      expect(p.rayons).toHaveLength(NOMBRE_POINTS)
      p.rayons.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(RAYON_MIN)
        expect(r).toBeLessThanOrEqual(RAYON_MAX)
      })
      expect(p.ecartYeux).toBeGreaterThanOrEqual(5)
      expect(p.ecartYeux).toBeLessThanOrEqual(7.5)
      expect(Math.abs(p.inclinaison)).toBeLessThanOrEqual(8)
    }
  })

  it('offre une vraie variété : 1 000 identifiants donnent au moins 100 combinaisons de visage', () => {
    const signatures = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const p = parametresAvatar(uuid(i))
      signatures.add(`${p.yeux}|${p.bouche}|${p.accessoire}|${p.joues}`)
    }
    expect(signatures.size).toBeGreaterThanOrEqual(100)
  })

  it('utilise chaque style au moins une fois sur un large échantillon', () => {
    const vus = { yeux: new Set<string>(), bouche: new Set<string>(), accessoire: new Set<string>() }
    for (let i = 0; i < 300; i++) {
      const p = parametresAvatar(uuid(i))
      vus.yeux.add(p.yeux)
      vus.bouche.add(p.bouche)
      vus.accessoire.add(p.accessoire)
    }
    expect(vus.yeux.size).toBe(5)
    expect(vus.bouche.size).toBe(4)
    expect(vus.accessoire.size).toBe(4)
  })

  it('accepte une graine vide sans erreur', () => {
    expect(() => parametresAvatar('')).not.toThrow()
  })
})

describe('cheminBlob', () => {
  it('produit un contour fermé de 8 courbes, sans valeur invalide', () => {
    const d = cheminBlob(parametresAvatar(uuid(3)).rayons, 32, 35)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect((d.match(/C/g) ?? []).length).toBe(NOMBRE_POINTS)
    expect(d).not.toMatch(/NaN|Infinity|undefined/)
  })

  it('reste dans le canevas de 64 pour tous les avatars (créature entière visible)', () => {
    for (let i = 0; i < 300; i++) {
      const d = cheminBlob(parametresAvatar(uuid(i)).rayons, 32, 35)
      const nombres = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
      nombres.forEach((n) => {
        expect(n).toBeGreaterThan(0)
        expect(n).toBeLessThan(64)
      })
    }
  })

  it('deux graines différentes donnent deux contours différents', () => {
    expect(cheminBlob(parametresAvatar(uuid(1)).rayons, 32, 35)).not.toBe(cheminBlob(parametresAvatar(uuid(2)).rayons, 32, 35))
  })
})
