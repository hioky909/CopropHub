import { expect, test } from '@playwright/test'
import { COPRO, SYNDIC, auditer, login, logout } from './fixtures.js'

/**
 * Audit d'accessibilité automatisé (axe-core, WCAG 2.1 A et AA) sur chaque écran, en navigateur
 * réel. Il ne remplace pas un test avec lecteur d'écran, mais il attrape ce qui se mesure :
 * contrastes, libellés manquants, rôles ARIA invalides, structure des tableaux, etc.
 */
test('écrans publics sans violation WCAG AA', async ({ page }) => {
  for (const chemin of ['/connexion', '/mot-de-passe-oublie', '/reinitialisation?jeton=x']) {
    await page.goto(chemin)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await auditer(page, chemin)
  }
})

test('écrans du syndic sans violation WCAG AA', async ({ page }) => {
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  for (const chemin of ['/', '/coproprietaires', '/assemblees', '/incidents', '/charges', '/compte']) {
    await page.goto(chemin)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await auditer(page, chemin)
  }
  await page.goto('/')
  await page.getByRole('button', { name: /Créer une AG|Nouvelle AG|Créer une assemblée/ }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await auditer(page, 'modale de création d’AG')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await logout(page)
})

test('écrans du copropriétaire sans violation WCAG AA', async ({ page }) => {
  await login(page, COPRO.email, COPRO.motDePasse)
  for (const chemin of ['/charges', '/assemblees', '/incidents']) {
    await page.goto(chemin)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await auditer(page, chemin)
  }
})

test('le lien d’évitement amène au contenu et chaque page a son titre', async ({ page }) => {
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.goto('/charges')
  await expect(page).toHaveTitle(/Charges.* — CopropHub/)
  await page.keyboard.press('Tab')
  const lien = page.getByRole('link', { name: 'Aller au contenu' })
  await expect(lien).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
})

test('les onglets ont le même gabarit : le titre est à la même place, sans barre intermédiaire', async ({ page }) => {
  await login(page, COPRO.email, COPRO.motDePasse)
  const positions: { chemin: string; x: number; y: number }[] = []
  for (const chemin of ['/assemblees', '/incidents', '/charges']) {
    await page.goto(chemin)
    const titre = page.getByRole('heading', { level: 1 })
    await expect(titre).toBeVisible()
    const boite = (await titre.boundingBox())!
    positions.push({ chemin, x: Math.round(boite.x), y: Math.round(boite.y) })
  }
  // Passer d'un onglet à l'autre ne doit pas faire « sauter » le contenu vers le bas (pas de bandeau
  // propre à un seul écran). La position horizontale peut différer : Charges est plus large (tableau).
  expect(new Set(positions.map((p) => p.y)).size, JSON.stringify(positions)).toBe(1)
})
