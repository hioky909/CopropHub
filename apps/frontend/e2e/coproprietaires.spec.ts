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
  await expect(page.getByRole('row', { name: new RegExp(`^${numeroLot}.*${nom}`) })).toBeVisible()

  await logout(page)

  // Le nouveau copropriétaire se connecte et retrouve réellement son lot.
  await login(page, email, motDePasse)
  await page.goto('/incidents')
  await page.getByRole('button', { name: 'Déclarer un incident' }).click()
  await expect(
    page.getByLabel('Lieu concerné').locator('option', { hasText: `Mon lot ${numeroLot}` }),
  ).toHaveCount(1)
})

test('le syndic désigne un membre du conseil syndical et crée un second syndic, qui peut se connecter (B, C)', async ({
  page,
}) => {
  const suffixe = Date.now()
  const nomCopro = `Conseil E2E ${suffixe}`
  const nomSyndic = `Syndic E2E ${suffixe}`
  const emailSyndic = `syndic-e2e-${suffixe}@coprophub.local`
  const motDePasse = 'un-mot-de-passe-provisoire-1'

  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.goto('/coproprietaires')

  await page.getByLabel('Nom complet').fill(nomCopro)
  await page.getByLabel('Email').fill(`conseil-e2e-${suffixe}@coprophub.local`)
  await page.getByLabel('Mot de passe provisoire').fill(motDePasse)
  await page.getByRole('button', { name: 'Créer le copropriétaire' }).click()
  await expect(page.getByText(`Copropriétaire ${nomCopro} créé.`)).toBeVisible()

  const caseConseil = page.getByLabel(`Membre du conseil syndical : ${nomCopro}`)
  await expect(caseConseil).not.toBeChecked()
  await caseConseil.click() // case pilotée par la réponse du serveur : on attend l'état, pas un changement immédiat
  await expect(page.getByText(`${nomCopro} est désigné(e) membre du conseil syndical.`)).toBeVisible()
  await expect(caseConseil).toBeChecked()

  await page.getByLabel('Nom du nouveau syndic').fill(nomSyndic)
  await page.getByLabel('Courriel du nouveau syndic').fill(emailSyndic)
  await page.getByLabel('Mot de passe du nouveau syndic').fill(motDePasse)
  await page.getByRole('button', { name: 'Créer le syndic' }).click()
  await expect(page.getByText(`Syndic ${nomSyndic} créé.`)).toBeVisible()
  await expect(page.getByRole('row', { name: new RegExp(nomSyndic) })).toBeVisible()

  await logout(page)
  await login(page, emailSyndic, motDePasse)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
})
