import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Garde-fous du design system tokenisé (personnalisation des couleurs) :
 * - les valeurs par défaut de `:root` sont exactement celles du design system d'origine (Doc 4) ;
 * - plus aucun littéral hexadécimal dans le code applicatif : toute couleur passe par un token,
 *   sans quoi la personnalisation ne changerait qu'une partie de l'interface.
 */
const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const DEFAUTS: Record<string, string> = {
  '--color-primary': '#1e4b8f',
  '--color-primary-hover': '#163970',
  '--color-primary-light': '#ebf0f9',
  '--color-primary-border': '#b3c8e8',
  '--color-primary-foreground': '#ffffff',
  '--color-info': '#1e4b8f',
  '--color-info-light': '#ebf0f9',
  '--color-info-border': '#b3c8e8',
  '--color-success': '#1e7a4c',
  '--color-success-light': '#e8f5ee',
  '--color-success-border': '#a8d8bc',
  '--color-warning': '#a15c00',
  '--color-warning-light': '#fef3e2',
  '--color-warning-border': '#f5cfa0',
  '--color-danger': '#b3261e',
  '--color-danger-light': '#fdecea',
  '--color-danger-border': '#f5c6c4',
  '--color-neutral-900': '#1a1a1a',
  '--color-neutral-700': '#3d3d3d',
  '--color-neutral-500': '#5c5c5c',
  '--color-neutral-400': '#9e9e9e',
  '--color-neutral-300': '#bdbdbd',
  '--color-neutral-200': '#e0e0e0',
  '--color-neutral-100': '#f2f2f2',
  '--color-surface': '#ffffff',
  '--color-background': '#f5f6f8',
}

describe('design tokens', () => {
  it('les valeurs par défaut de :root sont celles du design system d’origine', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8') // le plugin CSS de Vitest vide les imports .css
    const racine = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')))
    const lues = Object.fromEntries(
      [...racine.matchAll(/(--color-[a-z0-9-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]!.toLowerCase()]),
    )
    expect(lues).toEqual(DEFAUTS)
  })

  it('aucun littéral hexadécimal hors index.css, src/theme/ et fichiers de test', () => {
    const fautifs = Object.entries(sources)
      .filter(([chemin]) => !chemin.includes('/src/theme/') && !/\.test\./.test(chemin))
      .filter(([, contenu]) => /#[0-9a-fA-F]{3,8}\b/.test(contenu.replace(/&#\d+;/g, '')))
      .map(([chemin]) => chemin)
    expect(fautifs).toEqual([])
  })
})
