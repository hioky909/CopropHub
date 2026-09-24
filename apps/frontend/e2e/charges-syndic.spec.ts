import { expect, test } from '@playwright/test'
import { LOT_NUMERO, SYNDIC, login } from './fixtures.js'

test('le syndic ajoute une charge échue (en retard) puis la marque payée (RM-08, RM-09)', async ({ page }) => {
  const periode = `E2E-${Date.now()}`.slice(0, 20)

  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.goto('/charges')

  const choixLot = page.getByLabel(/^Lot/)
  const valeurLot = await choixLot.locator('option', { hasText: `Lot ${LOT_NUMERO}` }).getAttribute('value')
  await choixLot.selectOption(valeurLot!)
  await page.getByLabel(/^Montant/).fill('75.50')
  await page.getByLabel(/^Période/).fill(periode)
  await page.getByLabel('Échéance').fill('2020-01-31')
  await page.getByRole('button', { name: 'Ajouter la charge' }).click()
  await expect(page.getByText('Charge créée.')).toBeVisible()

  const ligne = page.getByRole('row', { name: new RegExp(periode) })
  await expect(ligne).toContainText('En retard') // échéance dépassée, sans intervention du syndic
  await expect(ligne).toContainText('31/01/2020')

  await ligne.getByRole('button', { name: 'Marquer payée' }).click()
  await expect(page.getByText('Charge marquée payée.')).toBeVisible()
  await expect(ligne).toContainText('Payée')
  await expect(ligne.getByRole('button', { name: 'Marquer payée' })).toHaveCount(0)
})
