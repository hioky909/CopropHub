import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Assemblees from './Assemblees.js'
import { agsApi } from '../api/ags.js'
import { useAuth } from '../context/AuthContext.js'

vi.mock('../api/ags.js', () => ({
  agsApi: { lister: vi.fn(), ordreDuJour: vi.fn(), mesVotes: vi.fn() },
}))
vi.mock('../context/AuthContext.js', () => ({ useAuth: vi.fn() }))

const AG_A = { id: 'ag-a', dateAg: '2026-11-14T00:00:00.000Z', statut: 'OUVERTE' as const, nombreResolutions: 1 }
const AG_B = { id: 'ag-b', dateAg: '2026-12-01T00:00:00.000Z', statut: 'OUVERTE' as const, nombreResolutions: 1 }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    utilisateur: { id: 'u-1', email: 'c@test.local', typeCompte: 'COPROPRIETAIRE', estMembreConseilSyndical: false },
    chargement: false,
    erreurServeur: false,
  } as unknown as ReturnType<typeof useAuth>)
  vi.mocked(agsApi.lister).mockResolvedValue({ ags: [AG_A, AG_B] } as never)
  vi.mocked(agsApi.ordreDuJour).mockImplementation(
    async (id: string) =>
      ({
        ag: id === 'ag-a' ? AG_A : AG_B,
        resolutions: [{ id: `res-${id}`, libelle: 'Résolution', typeMajorite: 'SIMPLE' }],
      }) as never,
  )
  // AG A entièrement votée, AG B pas encore.
  vi.mocked(agsApi.mesVotes).mockImplementation(
    async (id: string) => ({ votes: id === 'ag-a' ? [{ idResolution: 'res-ag-a', valeur: 'OUI' }] : [] }) as never,
  )
})

function rendre(entree: string | { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entree]}>
      <Routes>
        <Route path="/assemblees" element={<Assemblees />} />
        <Route path="/assemblees/:idAg" element={<p>Écran de vote</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Assemblees — redirection vers une assemblée à voter', () => {
  it('à l’arrivée (connexion, menu), envoie le copropriétaire vers l’assemblée ouverte qu’il lui reste à voter', async () => {
    rendre('/assemblees')
    expect(await screen.findByText('Écran de vote')).toBeInTheDocument()
  })

  it('après un retour volontaire à la liste (fin des votes, bouton retour), reste sur la liste malgré une autre assemblée à voter', async () => {
    rendre({ pathname: '/assemblees', state: { sansRedirection: true } })
    expect(await screen.findByRole('heading', { name: 'Assemblées générales' })).toBeInTheDocument()
    expect(screen.queryByText('Écran de vote')).not.toBeInTheDocument()
    // La liste montre bien les deux assemblées, dont celle déjà entièrement votée.
    expect(screen.getByText(/Vous avez voté sur toutes les résolutions/)).toBeInTheDocument()
    expect(screen.getByText(/Le vote est ouvert/)).toBeInTheDocument()
  })
})
