import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PreferencesNotifications from './PreferencesNotifications.js'
import { useAuth } from '../context/AuthContext.js'
import { ApiError } from '../api/client.js'

vi.mock('../context/AuthContext.js', () => ({ useAuth: vi.fn() }))

const definir = vi.fn()

function auth(notificationsEmail?: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    utilisateur: { id: 'u-1', email: 'a@test.local', typeCompte: 'COPROPRIETAIRE', estMembreConseilSyndical: false, notificationsEmail },
    definirNotificationsEmail: definir,
  } as unknown as ReturnType<typeof useAuth>)
}

beforeEach(() => {
  vi.resetAllMocks()
  definir.mockResolvedValue(undefined)
})

describe('PreferencesNotifications', () => {
  it('est cochée par défaut (préférence absente ou vraie), décochée si désactivée', () => {
    auth(undefined)
    const premier = render(<PreferencesNotifications />)
    expect(screen.getByRole('checkbox', { name: /Recevoir les notifications par email/ })).toBeChecked()
    premier.unmount()
    auth(true)
    const deuxieme = render(<PreferencesNotifications />)
    expect(screen.getByRole('checkbox')).toBeChecked()
    deuxieme.unmount()
    auth(false)
    render(<PreferencesNotifications />)
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('décocher envoie false au serveur', async () => {
    auth(true)
    render(<PreferencesNotifications />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(definir).toHaveBeenCalledWith(false)
  })

  it('cocher quand c’est désactivé envoie true', async () => {
    auth(false)
    render(<PreferencesNotifications />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(definir).toHaveBeenCalledWith(true)
  })

  it('affiche le message de l’API en cas d’échec, et l’état reste celui du serveur', async () => {
    auth(true)
    definir.mockRejectedValue(new ApiError(429, 'Trop de requêtes.'))
    render(<PreferencesNotifications />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(await screen.findByText('Trop de requêtes.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).toBeChecked() // rien n'a changé côté serveur
  })

  it('message générique pour une erreur inattendue', async () => {
    auth(true)
    definir.mockRejectedValue(new Error('réseau'))
    render(<PreferencesNotifications />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(await screen.findByText('Impossible d’enregistrer ce réglage.')).toBeInTheDocument()
  })

  it('a une région nommée et précise que les courriels ne contiennent ni vote ni montant', () => {
    auth(true)
    render(<PreferencesNotifications />)
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText(/jamais de vote ni de montant/)).toBeInTheDocument()
  })
})
