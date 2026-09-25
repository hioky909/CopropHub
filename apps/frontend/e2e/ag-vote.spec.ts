import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { COPRO, SYNDIC, auditer, libelleUnique, login, logout } from './fixtures.js'

test('parcours complet : création AG → ouverture → vote → clôture → résultats (F-04 à F-07)', async ({
  page,
}) => {
  const libelle = libelleUnique('Approbation des comptes')

  // Le syndic crée l'AG avec une résolution.
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()
  await page.getByRole('button', { name: 'Créer une AG' }).click()
  await page.locator('input[type="date"]').fill('2026-12-01')
  await page.getByPlaceholder('Résolution 1').fill(libelle)

  const [creationResponse] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/ags')),
    page.getByRole('button', { name: 'Créer l’AG' }).click(),
  ])
  const { ag } = (await creationResponse.json()) as { ag: { id: string; statut: string } }
  expect(ag.statut).toBe('PLANIFIEE')

  // Le syndic ouvre le vote.
  await page.goto(`/assemblees/${ag.id}`)
  await expect(page.getByText(libelle)).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir le vote' }).click()
  await expect(page.getByText('Vote ouvert')).toBeVisible()

  await logout(page)

  // Le copropriétaire vote « Pour ».
  await login(page, COPRO.email, COPRO.motDePasse)
  await page.goto(`/assemblees/${ag.id}`)
  await expect(page.getByText(libelle)).toBeVisible()
  await auditer(page, 'écran de vote')
  await page.getByRole('button', { name: 'Pour' }).click()
  await page.getByRole('button', { name: /Valider mon vote/ }).click()

  // Dernier (ici unique) vote : retour direct à la liste, où « Voté » confirme — pas d'écran intermédiaire.
  await expect(page).toHaveURL(/\/assemblees$/)
  await expect(page.getByText('Voté', { exact: true }).first()).toBeVisible() // .first() : d'autres assemblées votées par d'autres tests peuvent figurer dans la liste

  // Le vote est retrouvé en rouvrant l'AG, puis modifié (Pour → Contre) tant qu'elle est ouverte.
  await page.goto(`/assemblees/${ag.id}`)
  await expect(page.getByRole('button', { name: 'Modifier mon vote' })).toBeVisible()
  await page.getByRole('button', { name: 'Modifier mon vote' }).click()
  await page.getByRole('button', { name: 'Contre' }).click()
  await page.getByRole('button', { name: /Valider mon vote/ }).click()
  await expect(page.getByRole('button', { name: 'Modifier mon vote' })).toBeVisible()

  await logout(page)

  // Le syndic clôture l'AG : le résultat réel (calculé côté serveur) s'affiche.
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.goto(`/assemblees/${ag.id}`)
  await page.getByRole('button', { name: 'Clôturer l’AG' }).click()

  await expect(page.getByText('Clôturée')).toBeVisible()
  await expect(page.getByText(libelle)).toBeVisible()
  await expect(page.getByText('Rejetée')).toBeVisible()
  await expect(page.getByText('Oui : 0')).toBeVisible()
  await expect(page.getByText('Non : 1')).toBeVisible()
  await auditer(page, 'résultats de l’AG')

  // F-13 : le procès-verbal se télécharge en PDF, sous un nom daté.
  const [telechargement] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Télécharger le PV (PDF)' }).click(),
  ])
  expect(telechargement.suggestedFilename()).toBe('proces-verbal-ag-2026-12-01.pdf')
  const pdf = readFileSync((await telechargement.path())!)
  expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true)
  expect(pdf.length).toBeGreaterThan(1000)
})
