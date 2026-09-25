import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ThemeProvider, useTheme } from './ThemeContext.js'
import { useAuth } from './AuthContext.js'
import { themeApi } from '../api/theme.js'
import { ApiError } from '../api/client.js'
import { genererTheme } from '../theme/genererTheme.js'
import { lireThemeCache, ecrireThemeCache } from '../theme/themeStorage.js'

vi.mock('./AuthContext.js', () => ({ useAuth: vi.fn() }))
vi.mock('../api/theme.js', () => ({ themeApi: { definir: vi.fn(), reinitialiser: vi.fn() } }))

type Auth = Partial<ReturnType<typeof useAuth>>

function auth(valeurs: Auth) {
  vi.mocked(useAuth).mockReturnValue({
    utilisateur: null,
    chargement: false,
    erreurServeur: false,
    ...valeurs,
  } as ReturnType<typeof useAuth>)
}

const UTILISATEUR = {
  id: 'u-1',
  email: 'a@test.local',
  typeCompte: 'COPROPRIETAIRE' as const,
  estMembreConseilSyndical: false,
}
let contexte: ReturnType<typeof useTheme>

function Sonde() {
  contexte = useTheme()
  return <p>thème : {contexte.theme ? `${contexte.theme.teinte}/${contexte.theme.intensite}` : 'classique'}</p>
}

function rendre(enfants: ReactNode = <Sonde />) {
  return render(<ThemeProvider>{enfants}</ThemeProvider>)
}

const primaire = () => document.documentElement.style.getPropertyValue('--color-primary')

beforeEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('style')
})
afterEach(() => localStorage.clear())

describe('ThemeProvider', () => {
  it('applique le thème du compte à <html> et le met en cache', () => {
    auth({ utilisateur: { ...UTILISATEUR, theme: { teinte: 145, intensite: 60 } } })
    rendre()
    expect(screen.getByText('thème : 145/60')).toBeInTheDocument()
    expect(primaire()).toBe(genererTheme({ teinte: 145, intensite: 60 }).primaire)
    expect(lireThemeCache()).toEqual({ teinte: 145, intensite: 60 })
  })

  it('un compte sans personnalisation reste sur le thème d’origine (aucune variable posée)', () => {
    auth({ utilisateur: { ...UTILISATEUR, theme: null } })
    rendre()
    expect(screen.getByText('thème : classique')).toBeInTheDocument()
    expect(primaire()).toBe('')
    expect(lireThemeCache()).toBeNull()
  })

  it('pendant le contrôle de session, garde le thème en cache sans le remplacer', () => {
    ecrireThemeCache({ teinte: 300, intensite: 40 })
    auth({ utilisateur: null, chargement: true })
    rendre()
    expect(screen.getByText('thème : 300/40')).toBeInTheDocument()
    expect(lireThemeCache()).toEqual({ teinte: 300, intensite: 40 })
  })

  it('sans session (cookie expiré, déconnexion), revient au thème d’origine et efface le cache', () => {
    ecrireThemeCache({ teinte: 300, intensite: 40 })
    auth({ utilisateur: null, chargement: false })
    rendre()
    expect(screen.getByText('thème : classique')).toBeInTheDocument()
    expect(primaire()).toBe('')
    expect(lireThemeCache()).toBeNull()
  })

  it('serveur injoignable : ne détruit pas le thème affiché', () => {
    ecrireThemeCache({ teinte: 300, intensite: 40 })
    auth({ utilisateur: null, chargement: false, erreurServeur: true })
    rendre()
    expect(screen.getByText('thème : 300/40')).toBeInTheDocument()
    expect(lireThemeCache()).toEqual({ teinte: 300, intensite: 40 })
  })

  it('le serveur a le dernier mot sur un cache périmé', () => {
    ecrireThemeCache({ teinte: 10, intensite: 10 })
    auth({ utilisateur: { ...UTILISATEUR, theme: { teinte: 200, intensite: 80 } } })
    rendre()
    expect(screen.getByText('thème : 200/80')).toBeInTheDocument()
    expect(lireThemeCache()).toEqual({ teinte: 200, intensite: 80 })
  })

  it('un cache corrompu est ignoré', () => {
    localStorage.setItem('coprophub.theme', '{"teinte":999,"intensite":1}')
    auth({ utilisateur: null, chargement: true })
    rendre()
    expect(screen.getByText('thème : classique')).toBeInTheDocument()
  })

  it('enregistrer appelle l’API puis applique et met en cache le thème', async () => {
    auth({ utilisateur: { ...UTILISATEUR, theme: null } })
    vi.mocked(themeApi.definir).mockResolvedValue({ theme: { teinte: 145, intensite: 60 } })
    rendre()
    await act(() => contexte.enregistrer(145, 60))
    expect(themeApi.definir).toHaveBeenCalledWith(145, 60)
    expect(screen.getByText('thème : 145/60')).toBeInTheDocument()
    expect(primaire()).toBe(genererTheme({ teinte: 145, intensite: 60 }).primaire)
    expect(lireThemeCache()).toEqual({ teinte: 145, intensite: 60 })
  })

  it('si l’API échoue, rien n’est appliqué et l’erreur remonte à l’appelant', async () => {
    auth({ utilisateur: { ...UTILISATEUR, theme: null } })
    vi.mocked(themeApi.definir).mockRejectedValue(new ApiError(500, 'Erreur.'))
    rendre()
    await expect(act(() => contexte.enregistrer(145, 60))).rejects.toBeInstanceOf(ApiError)
    expect(screen.getByText('thème : classique')).toBeInTheDocument()
    expect(primaire()).toBe('')
    expect(lireThemeCache()).toBeNull()
  })

  it('réinitialiser appelle l’API et retire le thème', async () => {
    auth({ utilisateur: { ...UTILISATEUR, theme: { teinte: 145, intensite: 60 } } })
    vi.mocked(themeApi.reinitialiser).mockResolvedValue()
    rendre()
    await act(() => contexte.reinitialiser())
    expect(themeApi.reinitialiser).toHaveBeenCalled()
    expect(screen.getByText('thème : classique')).toBeInTheDocument()
    expect(primaire()).toBe('')
    expect(lireThemeCache()).toBeNull()
  })

  it('si la réinitialisation échoue, le thème reste appliqué', async () => {
    auth({ utilisateur: { ...UTILISATEUR, theme: { teinte: 145, intensite: 60 } } })
    vi.mocked(themeApi.reinitialiser).mockRejectedValue(new ApiError(500, 'Erreur.'))
    rendre()
    await expect(act(() => contexte.reinitialiser())).rejects.toBeInstanceOf(ApiError)
    expect(screen.getByText('thème : 145/60')).toBeInTheDocument()
  })

  it('useTheme hors fournisseur est une erreur explicite', () => {
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Sonde />)).toThrow(/ThemeProvider/)
    erreur.mockRestore()
  })
})
