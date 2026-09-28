import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Installation sur téléphone : le manifeste et les icônes doivent exister, être cohérents entre eux
 * (tailles annoncées = tailles réelles) et être référencés par la page. Ces fichiers sont lus tels
 * que le navigateur les recevra (dossier `public/`).
 */
const racine = process.cwd()
const lire = (chemin: string) => readFileSync(resolve(racine, chemin))

interface IconeManifeste {
  src: string
  sizes: string
  type: string
  purpose?: string
}
const manifeste = JSON.parse(lire('public/manifest.webmanifest').toString('utf-8')) as {
  name: string
  short_name: string
  lang: string
  start_url: string
  scope: string
  display: string
  theme_color: string
  background_color: string
  icons: IconeManifeste[]
}

/** Largeur et hauteur d'un PNG, lues dans son en-tête IHDR (octets 16 à 23). */
function dimensionsPng(fichier: Buffer): { largeur: number; hauteur: number } {
  expect(fichier.subarray(0, 8).toString('hex'), 'signature PNG').toBe('89504e470d0a1a0a')
  return { largeur: fichier.readUInt32BE(16), hauteur: fichier.readUInt32BE(20) }
}

describe('manifeste de l’application', () => {
  it('décrit une application installable : nom, langue, démarrage, affichage autonome', () => {
    expect(manifeste.name).toBe('CopropHub')
    expect(manifeste.short_name).toBe('CopropHub')
    expect(manifeste.lang).toBe('fr')
    expect(manifeste.start_url).toBe('/')
    expect(manifeste.scope).toBe('/')
    expect(manifeste.display).toBe('standalone')
  })

  it('reprend les couleurs du design system (primaire et fond de page)', () => {
    expect(manifeste.theme_color.toLowerCase()).toBe('#1e4b8f')
    expect(manifeste.background_color.toLowerCase()).toBe('#f5f6f8')
  })

  it('propose les icônes exigées par les navigateurs : 192 et 512 « any », et 512 « maskable »', () => {
    const cles = manifeste.icons.map((i) => `${i.sizes}/${i.purpose}`)
    expect(cles).toEqual(expect.arrayContaining(['192x192/any', '512x512/any', '512x512/maskable']))
  })

  it.each(manifeste.icons)('l’icône $src existe, est un PNG de la taille annoncée ($sizes)', (icone) => {
    const chemin = `public${icone.src}`
    expect(existsSync(resolve(racine, chemin)), chemin).toBe(true)
    expect(icone.type).toBe('image/png')
    const { largeur, hauteur } = dimensionsPng(lire(chemin))
    expect(`${largeur}x${hauteur}`).toBe(icone.sizes)
  })
})

describe('page d’accueil (index.html)', () => {
  const html = lire('index.html').toString('utf-8')

  it('référence le manifeste, l’icône iOS, le favicon et la couleur de thème', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(html).toContain('<link rel="apple-touch-icon" href="/icones/apple-touch-icon.png" />')
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    expect(html).toContain('<meta name="theme-color" content="#1E4B8F" />')
  })

  it('l’icône iOS existe et fait 180×180 (plein cadre : iOS arrondit lui-même)', () => {
    expect(dimensionsPng(lire('public/icones/apple-touch-icon.png'))).toEqual({ largeur: 180, hauteur: 180 })
  })

  it('le favicon SVG existe', () => {
    expect(existsSync(resolve(racine, 'public/favicon.svg'))).toBe(true)
  })
})
