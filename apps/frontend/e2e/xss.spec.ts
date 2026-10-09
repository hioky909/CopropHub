import { expect, test } from '@playwright/test'
import { COPRO, SYNDIC, login, logout } from './fixtures.js'

/**
 * NF-04 (XSS) de bout en bout, dans un vrai navigateur, sur les deux chemins réels.
 * 1. Stocké, champ libre : l'intitulé d'une résolution accepte `<` et `>` (un intitulé
 *    peut légitimement en contenir). Le syndic y écrit une charge utile ; le copropriétaire
 *    l'affiche : le texte apparaît tel quel, aucune balise n'est créée, rien ne s'exécute.
 * 2. Filtré à l'entrée : un titre d'incident contenant du balisage est refusé (422)
 *    et l'interface l'indique ; rien n'est enregistré.
 */
const CHARGE = `<img src="x" onerror="window.__xss=1"><script>window.__xss=1</script> ${Date.now()}`

test('une charge utile dans l’intitulé d’une résolution s’affiche comme du texte, sans s’exécuter', async ({ page }) => {
  const dialogues: string[] = []
  page.on('dialog', (d) => {
    dialogues.push(d.message())
    void d.dismiss()
  })

  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.getByRole('button', { name: 'Créer une AG' }).click()
  await page.locator('input[type="date"]').fill('2026-12-02')
  await page.getByPlaceholder('Résolution 1').fill(CHARGE)
  const [creation] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/ags')),
    page.getByRole('button', { name: 'Créer l’AG' }).click(),
  ])
  const { ag } = (await creation.json()) as { ag: { id: string } }
  await page.goto(`/assemblees/${ag.id}`)
  await page.getByRole('button', { name: 'Ouvrir le vote' }).click()
  await expect(page.getByText('Vote ouvert')).toBeVisible()
  await logout(page)

  await login(page, COPRO.email, COPRO.motDePasse)
  await page.goto(`/assemblees/${ag.id}`)
  await expect(page.getByText(CHARGE).first()).toBeVisible()
  await expect(page.locator('img[src="x"]')).toHaveCount(0)
  await expect(page.locator('main script')).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  expect(dialogues).toEqual([])
})

test('un titre d’incident contenant du balisage est refusé et rien n’est enregistré', async ({ page }) => {
  await login(page, COPRO.email, COPRO.motDePasse)
  await page.goto('/incidents')
  await page.getByRole('button', { name: 'Déclarer un incident' }).click()
  await page.getByLabel("Titre de l'incident").fill('<script>alert(1)</script>')
  const [reponse] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/incidents')),
    page.getByRole('button', { name: 'Envoyer le signalement' }).click(),
  ])
  expect(reponse.status()).toBe(422)
  await expect(page.getByText('Requête invalide.')).toBeVisible()
  await expect(page.getByText('<script>alert(1)</script>')).toHaveCount(0)
})
