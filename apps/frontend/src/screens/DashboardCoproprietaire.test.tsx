import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardCoproprietaire from './DashboardCoproprietaire.js'
import { agsApi } from '../api/ags.js'
import { incidentsApi } from '../api/incidents.js'
import { chargesApi } from '../api/charges.js'
import { useAuth } from '../context/AuthContext.js'

/**
 * Tableau de bord copropriétaire : vue d'ensemble équivalente à
 * celle du syndic mais scellée à SES données. N'ajoute aucune règle d'autorisation (les trois
 * endpoints appelés sont déjà scellés côté serveur), donc ce test couvre l'affichage, pas la
 * sécurité — déjà couverte par les tests d'intégration de charges/incidents/AG existants.
 */
vi.mock('../api/ags.js', () => ({ agsApi: { lister: vi.fn() } }))
vi.mock('../api/incidents.js', () => ({ incidentsApi: { lister: vi.fn() } }))
vi.mock('../api/charges.js', () => ({ chargesApi: { lister: vi.fn() } }))
vi.mock('../context/AuthContext.js', () => ({ useAuth: vi.fn() }))

function rendre() {
  return render(
    <MemoryRouter>
      <DashboardCoproprietaire />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    utilisateur: { id: 'u-1', email: 'c@test.local', typeCompte: 'COPROPRIETAIRE', estMembreConseilSyndical: false },
    chargement: false,
    erreurServeur: false,
  } as unknown as ReturnType<typeof useAuth>)
})

describe('DashboardCoproprietaire', () => {
  it('affiche le décompte et « Aucune AG à venir » sans assemblée', async () => {
    vi.mocked(agsApi.lister).mockResolvedValue({ ags: [] } as never)
    vi.mocked(incidentsApi.lister).mockResolvedValue({ incidents: [] } as never)
    vi.mocked(chargesApi.lister).mockResolvedValue({ charges: [] } as never)
    rendre()
    expect(await screen.findByText('Aucune AG à venir.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tableau de bord')
  })

  it('propose « Voter » quand une AG est ouverte, et affiche l’alerte de retard', async () => {
    vi.mocked(agsApi.lister).mockResolvedValue({
      ags: [{ id: 'ag-1', dateAg: '2026-11-14T00:00:00.000Z', statut: 'OUVERTE', nombreResolutions: 1 }],
    } as never)
    vi.mocked(incidentsApi.lister).mockResolvedValue({
      incidents: [
        { id: 'i-1', idLot: null, idUtilisateurDeclarant: 'u-1', titre: 'Ascenseur bloqué', statut: 'DECLARE', dateCreation: '2026-09-01T00:00:00.000Z' },
      ],
    } as never)
    vi.mocked(chargesApi.lister).mockResolvedValue({
      charges: [
        { id: 'c-1', idLot: 'lot-1', montant: '150.00', periode: '2026-T3', statut: 'EN_RETARD', dateEcheance: '2026-08-01' },
      ],
    } as never)
    rendre()
    expect(await screen.findByRole('button', { name: 'Voter' })).toBeInTheDocument()
    expect(screen.getByText('1 charge en retard')).toBeInTheDocument()
    expect(screen.getByText('Ascenseur bloqué')).toBeInTheDocument()
  })

  it('affiche un message d’erreur si le chargement échoue', async () => {
    vi.mocked(agsApi.lister).mockRejectedValue(new Error('panne'))
    vi.mocked(incidentsApi.lister).mockResolvedValue({ incidents: [] } as never)
    vi.mocked(chargesApi.lister).mockResolvedValue({ charges: [] } as never)
    rendre()
    expect(await screen.findByText('Impossible de charger le tableau de bord.')).toBeInTheDocument()
  })
})
