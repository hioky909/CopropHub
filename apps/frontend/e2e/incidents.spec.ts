import { expect, test } from '@playwright/test'
import { COPRO, LOT_NUMERO, SYNDIC, libelleUnique, login, logout } from './fixtures.js'

test('parcours complet : déclaration sur son propre lot → progression du statut par le syndic (F-08, US-03, US-09)', async ({
  page,
}) => {
  const titre = libelleUnique('Fuite d’eau sous l’évier')

  // Le copropriétaire déclare l'incident sur son vrai lot rattaché.
  await login(page, COPRO.email, COPRO.motDePasse)
  await page.goto('/incidents')
  await page.getByRole('button', { name: 'Déclarer un incident' }).click()
  await page.getByLabel("Titre de l'incident").fill(titre)
  await page.getByLabel('Lieu concerné').selectOption({ label: `Mon lot ${LOT_NUMERO} (appartement)` })
  await page.getByLabel('Description').fill('Description E2E du problème signalé, au moins vingt caractères.')

  const [declarationResponse] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/incidents')),
    page.getByRole('button', { name: 'Envoyer le signalement' }).click(),
  ])
  const { incident } = (await declarationResponse.json()) as { incident: { id: string; idLot: string | null } }
  expect(incident.idLot).not.toBeNull()

  await expect(page.getByText('Incident déclaré')).toBeVisible()
  const row = page.getByTestId(`incident-${incident.id}`)
  await expect(row).toContainText(titre)
  await expect(row).toContainText('Déclaré')

  await logout(page)

  // Le syndic fait progresser le statut (déclaré → en cours).
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.goto('/incidents')
  const syndicRow = page.getByTestId(`incident-${incident.id}`)
  await expect(syndicRow).toContainText(titre)
  await syndicRow.getByRole('button', { name: 'Passer à « En cours »' }).click()
  await expect(syndicRow).toContainText('En cours')
})
