import { readFileSync } from 'node:fs'
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

test('un copropriétaire exporte son relevé de charges en PDF (F-13)', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Email').fill(COPRO.email)
  await page.getByLabel('Mot de passe').fill(COPRO.motDePasse)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Charges' })).toBeVisible()

  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter en PDF' }).click(),
  ])
  expect(telechargement.suggestedFilename()).toMatch(/^releve-charges-\d{4}-\d{2}-\d{2}\.pdf$/)
  const pdf = readFileSync((await telechargement.path())!)
  expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true)
})
