import { expect, test, type Page } from '@playwright/test'
import { COPRO, SYNDIC, libelleUnique, login, logout } from './fixtures.js'

/**
 * Plusieurs assemblées ouvertes en même temps : après le dernier « Valider mon vote » d'une
 * assemblée, le copropriétaire revient sur la liste (/assemblees) et n'y est pas renvoyé aussitôt
 * vers l'autre assemblée qu'il lui reste à voter.
 */
async function creerEtOuvrirAg(page: Page, libelle: string): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'Créer une AG' }).click()
  await page.locator('input[type="date"]').fill('2026-12-01')
  await page.getByPlaceholder('Résolution 1').fill(libelle)
  const [reponse] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/ags')),
    page.getByRole('button', { name: 'Créer l’AG' }).click(),
  ])
  const { ag } = (await reponse.json()) as { ag: { id: string } }
  await page.goto(`/assemblees/${ag.id}`)
  await page.getByRole('button', { name: 'Ouvrir le vote' }).click()
  await expect(page.getByText('Vote ouvert')).toBeVisible()
  return ag.id
}

test('après le dernier vote d’une assemblée, retour sur la liste même s’il en reste une autre à voter', async ({ page }) => {
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await creerEtOuvrirAg(page, libelleUnique('Première assemblée'))
  await creerEtOuvrirAg(page, libelleUnique('Seconde assemblée'))
  await logout(page)

  await login(page, COPRO.email, COPRO.motDePasse)
  await page.goto('/assemblees') // arrivée : envoyé vers une assemblée ouverte à voter
  await expect(page).toHaveURL(/\/assemblees\/[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: 'Pour' }).click()
  await page.getByRole('button', { name: /Valider mon vote/ }).click()

  // Retour direct à la liste, et on y reste (pas de rebond vers l'assemblée restante).
  await expect(page).toHaveURL(/\/assemblees$/)
  await expect(page.getByRole('heading', { name: 'Assemblées générales' })).toBeVisible()
  await page.waitForTimeout(1500)
  await expect(page).toHaveURL(/\/assemblees$/)
  await expect(page.getByText('Voté', { exact: true }).first()).toBeVisible()
})
