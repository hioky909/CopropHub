import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client.js'

const blobDuPdf = new Blob(['%PDF-1.3'], { type: 'application/pdf' })

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('api.telecharger', () => {
  it('récupère le fichier avec le cookie de session puis le propose au téléchargement sous le nom donné', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blobDuPdf) })
    vi.stubGlobal('fetch', fetchMock)
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await api.telecharger('/ags/ag-1/proces-verbal.pdf', 'proces-verbal-ag-2026-11-14.pdf')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/ags\/ag-1\/proces-verbal\.pdf$/)
    expect(options).toMatchObject({ credentials: 'include' })
    expect(URL.createObjectURL).toHaveBeenCalledWith(blobDuPdf)
    const lien = clic.mock.contexts[0] as HTMLAnchorElement // le lien sur lequel `click()` a été appelé
    expect(lien.download).toBe('proces-verbal-ag-2026-11-14.pdf')
    expect(lien.href).toBe('blob:test')
    expect(document.querySelector('a[download]')).toBeNull() // le lien temporaire est retiré du document
  })

  it('remonte le message de l’API en cas de refus (ex. 409, AG non clôturée) sans rien télécharger', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: () => Promise.resolve({ erreur: 'Résultats indisponibles.' }) }),
    )
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    const echec = api.telecharger('/x.pdf', 'x.pdf')
    await expect(echec).rejects.toBeInstanceOf(ApiError)
    await expect(echec).rejects.toMatchObject({ status: 409, message: 'Résultats indisponibles.' })
    expect(clic).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('message générique quand la réponse d’erreur n’est pas du JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: () => Promise.reject(new Error('pas du json')) }))
    await expect(api.telecharger('/x.pdf', 'x.pdf')).rejects.toMatchObject({ status: 502, message: 'Une erreur est survenue.' })
  })

  it('une panne réseau remonte telle quelle', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.telecharger('/x.pdf', 'x.pdf')).rejects.toBeInstanceOf(TypeError)
  })
})
