import { expect, test } from '@playwright/test'
import { COPRO, SYNDIC, libelleUnique } from './fixtures.js'

test.describe('Connexion et inscription (F-01)', () => {
  test('identifiants invalides : message générique, pas de redirection', async ({ page }) => {
    await page.goto('/connexion')
    await page.getByLabel('Email').fill(SYNDIC.email)
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe')
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible()
    await expect(page).toHaveURL(/\/connexion/)
  })

  test('le syndic se connecte, voit le tableau de bord, puis se déconnecte', async ({ page }) => {
    await page.goto('/connexion')
    await page.getByLabel('Email').fill(SYNDIC.email)
    await page.getByLabel('Mot de passe').fill(SYNDIC.motDePasse)
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
    await expect(page.getByText(SYNDIC.email)).toBeVisible()

    await page.getByRole('button', { name: 'Déconnexion' }).click()
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  })

  test('un copropriétaire se connecte et atterrit sur son propre tableau de bord (pas celui du syndic)', async ({
    page,
  }) => {
    await page.goto('/connexion')
    await page.getByLabel('Email').fill(COPRO.email)
    await page.getByLabel('Mot de passe').fill(COPRO.motDePasse)
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page).toHaveURL('http://localhost:5173/')
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
    // Distingue du tableau de bord syndic : bouton de création d'AG réservé au syndic (RM-14).
    await expect(page.getByRole('button', { name: 'Créer une AG' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Charges' }).click()
    await expect(page.getByRole('heading', { name: 'Charges' })).toBeVisible()
  })

  test('un nouveau copropriétaire peut créer son compte par auto-inscription', async ({ page }) => {
    const email = `${libelleUnique('e2e-inscription').replace(/\s+/g, '-').toLowerCase()}@coprophub.local`

    await page.goto('/connexion')
    await page.getByRole('button', { name: 'Créer un compte' }).click()
    await page.getByLabel('Nom').fill('Nouveau Copropriétaire E2E')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Mot de passe').fill('un-mot-de-passe-suffisamment-long')
    await page.getByRole('button', { name: 'Créer mon compte' }).click()

    await expect(page).toHaveURL('http://localhost:5173/')
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
  })
})
