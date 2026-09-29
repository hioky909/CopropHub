import { expect, test } from '@playwright/test'
import { login, logout } from './fixtures.js'

test('un utilisateur change son mot de passe, puis se reconnecte avec le nouveau', async ({ page }) => {
  const email = `compte-e2e-${Date.now()}@coprophub.local`
  const ancien = 'un-mot-de-passe-suffisamment-long'
  const nouveau = 'un-tout-nouveau-mot-de-passe-2'

  await page.goto('/connexion')
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  await page.getByLabel('Nom').fill('Compte E2E')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(ancien)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()

  await page.getByRole('link', { name: 'Mon compte' }).click() // bouton dédié de l'en-tête
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()

  // Mauvais mot de passe actuel : refusé, message clair.
  await page.getByLabel('Mot de passe actuel').fill('ce-nest-pas-le-bon-mot-de-passe')
  await page.getByLabel(/^Nouveau mot de passe/).fill(nouveau)
  await page.getByLabel('Confirmer le nouveau mot de passe').fill(nouveau)
  await page.getByRole('button', { name: 'Modifier le mot de passe' }).click()
  await expect(page.getByText('Le mot de passe actuel est incorrect.')).toBeVisible()

  // Bon mot de passe actuel : modifié.
  await page.getByLabel('Mot de passe actuel').fill(ancien)
  await page.getByRole('button', { name: 'Modifier le mot de passe' }).click()
  await expect(page.getByText('Mot de passe modifié.')).toBeVisible()

  await logout(page)
  await login(page, email, nouveau)
  await expect(page.getByText(email).first()).toBeVisible() // connecté avec le nouveau mot de passe
})

test('les notifications par email se désactivent et se réactivent, et le réglage survit au rechargement (F-12)', async ({ page }) => {
  const email = `notif-e2e-${Date.now()}@coprophub.local`
  await page.goto('/connexion')
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  await page.getByLabel('Nom').fill('Notif E2E')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill('un-mot-de-passe-suffisamment-long')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeVisible()

  await page.goto('/compte')
  const case_ = page.getByRole('checkbox', { name: /Recevoir les notifications par email/ })
  await expect(case_).toBeChecked() // actif par défaut

  await case_.click()
  await expect(case_).not.toBeChecked()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /Recevoir les notifications par email/ })).not.toBeChecked()

  await page.getByRole('checkbox', { name: /Recevoir les notifications par email/ }).click()
  await expect(page.getByRole('checkbox', { name: /Recevoir les notifications par email/ })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('checkbox', { name: /Recevoir les notifications par email/ })).toBeChecked()
})
