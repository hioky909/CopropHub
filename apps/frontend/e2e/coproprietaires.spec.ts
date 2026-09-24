import { expect, test } from '@playwright/test'
import { SYNDIC, login, logout } from './fixtures.js'

test('le syndic crée un copropriétaire et un lot, les rattache, et le copropriétaire retrouve son lot (F-02, F-03, US-10)', async ({
  page,
}) => {
  const suffixe = Date.now()
  const nom = `Copro E2E ${suffixe}`
  const email = `copro-e2e-${suffixe}@coprophub.local`
  const motDePasse = 'un-mot-de-passe-provisoire-1'
  const numeroLot = `G${String(suffixe).slice(-6)}`

  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.getByRole('link', { name: 'Copropriétaires' }).click()
  await expect(page.getByRole('heading', { name: 'Copropriétaires', level: 1 })).toBeVisible()

  await page.getByLabel('Nom complet').fill(nom)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe provisoire').fill(motDePasse)
  await page.getByRole('button', { name: 'Créer le copropriétaire' }).click()
  await expect(page.getByText(`Copropriétaire ${nom} créé.`)).toBeVisible()

  await page.getByLabel('Numéro du lot').fill(numeroLot)
  await page.getByRole('button', { name: 'Créer le lot' }).click()
  await expect(page.getByText(`Lot ${numeroLot} créé.`)).toBeVisible()

  await page.getByLabel(`Copropriétaire à rattacher au lot ${numeroLot}`).selectOption({ label: nom })
  await page
    .getByRole('row', { name: new RegExp(numeroLot) })
    .getByRole('button', { name: 'Rattacher' })
    .click()
  await expect(page.getByText(`Lot ${numeroLot} rattaché.`)).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(`${numeroLot}.*${nom}`) })).toBeVisible()

  await logout(page)

  // Le nouveau copropriétaire se connecte et retrouve réellement son lot.
  await login(page, email, motDePasse)
  await page.goto('/incidents')
  await page.getByRole('button', { name: 'Déclarer un incident' }).click()
  await expect(
    page.getByLabel('Lieu concerné').locator('option', { hasText: `Mon lot ${numeroLot}` }),
  ).toHaveCount(1)
})
