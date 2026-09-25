import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditeurApparence from './EditeurApparence.js'
import { useTheme } from '../context/ThemeContext.js'
import { ApiError } from '../api/client.js'
import { genererTheme } from '../theme/genererTheme.js'

vi.mock('../context/ThemeContext.js', () => ({ useTheme: vi.fn() }))

const enregistrer = vi.fn()
const reinitialiser = vi.fn()

function avecTheme(theme: { teinte: number; intensite: number } | null) {
  vi.mocked(useTheme).mockReturnValue({ theme, enregistrer, reinitialiser })
}

const apercu = () => screen.getByTestId('apercu-theme')
const primaireApercu = () => apercu().style.getPropertyValue('--color-primary')

beforeEach(() => {
  vi.resetAllMocks()
  enregistrer.mockResolvedValue(undefined)
  reinitialiser.mockResolvedValue(undefined)
  document.documentElement.removeAttribute('style')
})

describe('EditeurApparence — sans thème enregistré (Classique)', () => {
  it('propose Classique, sans anneau, et rien à enregistrer ni à réinitialiser', () => {
    avecTheme(null)
    render(<EditeurApparence />)
    expect(screen.getByRole('radio', { name: /Classique/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Personnalisé/ })).not.toBeChecked()
    expect(screen.queryByRole('slider', { name: 'Teinte' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Réinitialiser le thème CopropHub/ })).not.toBeInTheDocument()
    expect(primaireApercu()).toBe('') // l'aperçu montre les couleurs d'origine
  })

  it('« Personnalisé » affiche l’anneau, l’intensité et les couleurs suggérées ; l’aperçu suit, pas l’application', async () => {
    avecTheme(null)
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))

    expect(screen.getByRole('slider', { name: 'Teinte' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Intensité/)).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: /^(Vert|Sarcelle|Violet|Rose|Bordeaux|Orange|Ardoise)$/ })).toHaveLength(7)
    expect(primaireApercu()).toBe(genererTheme({ teinte: 255, intensite: 55 }).primaire)
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('') // l'application n'a pas bougé
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })

  it('une pastille met l’aperçu à jour, et « Enregistrer » envoie teinte et intensité', async () => {
    avecTheme(null)
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Vert' }))
    expect(primaireApercu()).toBe(genererTheme({ teinte: 145, intensite: 55 }).primaire)
    expect(enregistrer).not.toHaveBeenCalled() // aperçu seulement, rien d'enregistré

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(enregistrer).toHaveBeenCalledWith(145, 55)
    expect(await screen.findByText('Apparence enregistrée.')).toBeInTheDocument()
  })

  it('le clavier de l’anneau et le curseur d’intensité mettent l’aperçu à jour instantanément', async () => {
    avecTheme(null)
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))
    screen.getByRole('slider', { name: 'Teinte' }).focus()
    await userEvent.keyboard('{PageUp}')
    expect(screen.getByRole('slider', { name: 'Teinte' })).toHaveAttribute('aria-valuenow', '265')
    expect(primaireApercu()).toBe(genererTheme({ teinte: 265, intensite: 55 }).primaire)

    fireEvent.change(screen.getByLabelText(/Intensité/), { target: { value: '56' } })
    expect(primaireApercu()).toBe(genererTheme({ teinte: 265, intensite: 56 }).primaire)
  })

  it('« Annuler » revient au Classique enregistré', async () => {
    avecTheme(null)
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Violet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('radio', { name: /Classique/ })).toBeChecked()
    expect(screen.queryByRole('slider', { name: 'Teinte' })).not.toBeInTheDocument()
    expect(primaireApercu()).toBe('')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('signale une couleur ajustée pour rester lisible (jaune vif), pas pour un bleu', () => {
    avecTheme({ teinte: 100, intensite: 100 })
    const { unmount } = render(<EditeurApparence />)
    expect(screen.getByTestId('ajustement')).toHaveTextContent('Couleur ajustée pour rester lisible.')
    unmount()
    avecTheme({ teinte: 255, intensite: 55 })
    render(<EditeurApparence />)
    expect(screen.getByTestId('ajustement')).toBeEmptyDOMElement()
  })
})

describe('EditeurApparence — avec un thème enregistré', () => {
  it('affiche Personnalisé et les valeurs enregistrées, sans rien à enregistrer', () => {
    avecTheme({ teinte: 145, intensite: 60 })
    render(<EditeurApparence />)
    expect(screen.getByRole('radio', { name: /Personnalisé/ })).toBeChecked()
    expect(screen.getByRole('slider', { name: 'Teinte' })).toHaveAttribute('aria-valuenow', '145')
    expect(screen.getByLabelText(/Intensité/)).toHaveValue('60')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Réinitialiser le thème CopropHub/ })).toBeEnabled()
  })

  it('« Réinitialiser le thème CopropHub » appelle l’API puis revient au Classique', async () => {
    avecTheme({ teinte: 145, intensite: 60 })
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser le thème CopropHub/ }))
    expect(reinitialiser).toHaveBeenCalled()
    expect(await screen.findByText('Couleurs d’origine rétablies.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Classique/ })).toBeChecked()
  })

  it('choisir Classique puis « Enregistrer » réinitialise côté serveur', async () => {
    avecTheme({ teinte: 145, intensite: 60 })
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('radio', { name: /Classique/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(reinitialiser).toHaveBeenCalled()
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('« Annuler » restaure les valeurs enregistrées', async () => {
    avecTheme({ teinte: 145, intensite: 60 })
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('radio', { name: 'Violet' }))
    expect(screen.getByRole('slider', { name: 'Teinte' })).toHaveAttribute('aria-valuenow', '300')
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('slider', { name: 'Teinte' })).toHaveAttribute('aria-valuenow', '145')
    expect(screen.getByLabelText(/Intensité/)).toHaveValue('60')
  })
})

describe('EditeurApparence — erreurs', () => {
  it('affiche le message de l’API quand l’enregistrement échoue, et garde l’état d’édition', async () => {
    avecTheme(null)
    enregistrer.mockRejectedValue(new ApiError(429, 'Trop de requêtes, réessayez plus tard.'))
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))
    await userEvent.click(screen.getByRole('radio', { name: 'Rose' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Trop de requêtes, réessayez plus tard.')).toBeInTheDocument()
    expect(screen.queryByText('Apparence enregistrée.')).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Teinte' })).toHaveAttribute('aria-valuenow', '350')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })

  it('message générique pour une erreur inattendue', async () => {
    avecTheme({ teinte: 145, intensite: 60 })
    reinitialiser.mockRejectedValue(new Error('réseau'))
    render(<EditeurApparence />)
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser le thème CopropHub/ }))
    expect(await screen.findByText('Impossible d’enregistrer l’apparence.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Personnalisé/ })).toBeChecked()
  })
})

describe('EditeurApparence — accessibilité', () => {
  it('a une région nommée, des groupes étiquetés et un aperçu inerte (ni focus ni lecture)', async () => {
    avecTheme(null)
    render(<EditeurApparence />)
    expect(screen.getByRole('region', { name: 'Apparence' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Style des couleurs' })).toBeInTheDocument()
    expect(apercu()).toHaveAttribute('inert')
    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))
    expect(screen.getByRole('group', { name: 'Couleurs suggérées' })).toBeInTheDocument()
  })
})
