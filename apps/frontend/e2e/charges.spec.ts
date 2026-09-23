import { expect, test } from '@playwright/test'
import { CHARGE_PERIODE, COPRO } from './fixtures.js'

test('un copropriétaire consulte la charge réelle de son lot (F-09, US-01)', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Email').fill(COPRO.email)
  await page.getByLabel('Mot de passe').fill(COPRO.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()

  await expect(page.getByRole('heading', { name: 'Charges' })).toBeVisible()
  const ligne = page.getByRole('row', { name: new RegExp(CHARGE_PERIODE) })
  await expect(ligne).toBeVisible()
  await expect(ligne).toContainText('150,00 €')
  await expect(ligne).toContainText('À payer')
})
