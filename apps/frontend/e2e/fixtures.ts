import type { Page } from '@playwright/test'

/**
 * Identifiants amorcés par `apps/backend/scripts/e2e-seed.ts` : mêmes
 * valeurs des deux côtés, tenues manuellement en synchronisation (script
 * unique, faible risque de dérive).
 */
export const SYNDIC = { email: 'e2e-syndic@coprophub.local', motDePasse: 'un-mot-de-passe-e2e-syndic-1' }
export const COPRO = { email: 'e2e-copro@coprophub.local', motDePasse: 'un-mot-de-passe-e2e-copro-1' }
export const LOT_NUMERO = 'E2E-1'
export const CHARGE_PERIODE = '2026-E2E'

export function libelleUnique(prefixe: string): string {
  return `${prefixe} ${Date.now()}`
}

/**
 * Attend la réponse réelle de `POST /auth/connexion` avant de continuer :
 * un `page.goto` déclenché juste après le clic, sans attendre, peut
 * naviguer avant que le cookie de session ne soit posé et retomber sur
 * `/connexion` (course observée en pratique lors des premiers essais).
 */
export async function login(page: Page, email: string, motDePasse: string): Promise<void> {
  await page.goto('/connexion')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(motDePasse)
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/auth/connexion')),
    page.getByRole('button', { name: 'Se connecter' }).click(),
  ])
}

export async function logout(page: Page): Promise<void> {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/auth/deconnexion')),
    page.getByRole('button', { name: 'Déconnexion' }).click(),
  ])
}
