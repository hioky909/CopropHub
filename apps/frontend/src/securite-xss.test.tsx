import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ListeIncidents from './screens/ListeIncidents.js'
import { incidentsApi } from './api/incidents.js'
import { lotsApi } from './api/lots.js'
import { useAuth } from './context/AuthContext.js'

/**
 * NF-04 (XSS) côté interface. Deux garanties, vérifiées automatiquement :
 * 1. un texte venu de l'API est affiché tel quel, jamais interprété comme du HTML
 *    (React échappe le contenu) : aucune balise injectée n'apparaît dans le DOM ;
 * 2. aucun fichier de l'application n'utilise une API qui contournerait cet échappement.
 * Le serveur refuse déjà `<` et `>` dans les champs d'incident (422, test d'intégration) :
 * ce test couvre le cas où une telle valeur serait malgré tout en base (donnée ancienne,
 * écriture directe), pour que la défense de l'interface ne dépende pas de celle du serveur.
 */
vi.mock('./api/incidents.js', () => ({ incidentsApi: { lister: vi.fn() } }))
vi.mock('./api/lots.js', () => ({ lotsApi: { mesLots: vi.fn() } }))
vi.mock('./context/AuthContext.js', () => ({ useAuth: vi.fn() }))

const CHARGES_UTILES = [
  '<script>window.__xss = 1</script>',
  '<img src="x" onerror="window.__xss = 1">',
  '<a href="javascript:window.__xss = 1">clic</a>',
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    utilisateur: { id: 'u-1', email: 'c@test.local', typeCompte: 'COPROPRIETAIRE', estMembreConseilSyndical: false },
    chargement: false,
    erreurServeur: false,
  } as unknown as ReturnType<typeof useAuth>)
  vi.mocked(lotsApi.mesLots).mockResolvedValue({ lots: [] } as never)
})

afterEach(() => {
  delete (window as unknown as { __xss?: number }).__xss
})

describe('XSS : rendu des données venues du serveur', () => {
  it('affiche les charges utiles comme du texte, sans créer aucune balise ni exécuter de script', async () => {
    vi.mocked(incidentsApi.lister).mockResolvedValue({
      incidents: CHARGES_UTILES.map((titre, i) => ({
        id: `i-${i}`,
        idLot: null,
        idUtilisateurDeclarant: 'u-1',
        titre,
        statut: 'DECLARE',
        dateCreation: '2026-09-01T00:00:00.000Z',
      })),
    } as never)

    const { container } = render(
      <MemoryRouter>
        <ListeIncidents />
      </MemoryRouter>,
    )

    for (const charge of CHARGES_UTILES) {
      expect(await screen.findByText(charge)).toBeInTheDocument()
    }
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined()
  })
})

describe("XSS : aucune API qui contourne l'échappement", () => {
  const sources = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >
  const INTERDITS = [
    /dangerouslySetInnerHTML/,
    /\.innerHTML\s*=/,
    /\.outerHTML\s*=/,
    /insertAdjacentHTML/,
    /document\.write/,
    /\beval\(/,
    /new Function\(/,
  ]

  it('aucun fichier applicatif (hors tests) ne les utilise', () => {
    const fichiers = Object.entries(sources).filter(([chemin]) => !/\.test\.tsx?$/.test(chemin))
    expect(fichiers.length).toBeGreaterThan(20)
    const fautifs = fichiers.flatMap(([chemin, code]) =>
      INTERDITS.filter((motif) => motif.test(code)).map((motif) => `${chemin} : ${motif.source}`),
    )
    expect(fautifs).toEqual([])
  })
})
