import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BoutonTelechargement from './BoutonTelechargement.js'
import { ApiError } from '../api/client.js'

describe('BoutonTelechargement', () => {
  it('lance le téléchargement au clic', async () => {
    const telecharger = vi.fn().mockResolvedValue(undefined)
    render(<BoutonTelechargement libelle="Télécharger le PV (PDF)" onTelecharger={telecharger} />)
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger le PV (PDF)' }))
    expect(telecharger).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('indique la génération en cours et interdit le double clic', async () => {
    let terminer!: () => void
    const telecharger = vi.fn(() => new Promise<void>((resolve) => (terminer = resolve)))
    render(<BoutonTelechargement libelle="Exporter en PDF" onTelecharger={telecharger} />)
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en PDF' }))

    const bouton = await screen.findByRole('button', { name: 'Génération…' })
    expect(bouton).toBeDisabled()
    expect(bouton).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(bouton) // le bouton désactivé ignore un second clic
    expect(telecharger).toHaveBeenCalledTimes(1)

    terminer()
    expect(await screen.findByRole('button', { name: 'Exporter en PDF' })).toBeEnabled()
  })

  it('affiche le message de l’API quand la génération échoue (ex. AG non clôturée)', async () => {
    const telecharger = vi.fn().mockRejectedValue(new ApiError(409, 'Les résultats ne sont pas encore disponibles.'))
    render(<BoutonTelechargement libelle="Exporter en PDF" onTelecharger={telecharger} />)
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en PDF' }))
    expect(await screen.findByText('Les résultats ne sont pas encore disponibles.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exporter en PDF' })).toBeEnabled() // on peut réessayer
  })

  it('message générique pour une erreur inattendue, effacé au nouvel essai', async () => {
    const telecharger = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce(undefined)
    render(<BoutonTelechargement libelle="Exporter en PDF" onTelecharger={telecharger} />)
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en PDF' }))
    expect(await screen.findByText('Impossible de générer le document.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en PDF' }))
    expect(screen.queryByText('Impossible de générer le document.')).not.toBeInTheDocument()
  })
})
