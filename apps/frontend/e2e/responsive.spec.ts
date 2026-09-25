import { expect, test, type Page } from '@playwright/test'
import { COPRO, SYNDIC, login } from './fixtures.js'

/**
 * Responsive mobile (docs/04-ux-ui : mobile-first pour le vote et le
 * signalement d'incident, desktop-first toléré pour l'administration syndic —
 * mais aucun écran ne doit obliger à défiler horizontalement sur un téléphone).
 * Le critère est mesuré : la largeur du document ne doit jamais dépasser celle
 * de la fenêtre (375 px, un iPhone standard).
 */
test.use({ viewport: { width: 375, height: 812 } })

async function attendreSansDebordement(page: Page, chemin: string) {
  await page.goto(chemin)
  await page.waitForLoadState('networkidle')
  const { defilement, fenetre } = await page.evaluate(() => ({
    defilement: document.documentElement.scrollWidth,
    fenetre: document.documentElement.clientWidth,
  }))
  expect(defilement, `${chemin} : le contenu dépasse la largeur de l'écran (${defilement}px > ${fenetre}px)`).toBeLessThanOrEqual(
    fenetre,
  )
}

test('la page de connexion tient dans un écran de téléphone', async ({ page }) => {
  await attendreSansDebordement(page, '/connexion')
})

test('les écrans du syndic tiennent dans un écran de téléphone', async ({ page }) => {
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  for (const chemin of ['/', '/coproprietaires', '/assemblees', '/incidents', '/charges', '/compte']) {
    await attendreSansDebordement(page, chemin)
  }
})

test('les écrans du copropriétaire tiennent dans un écran de téléphone', async ({ page }) => {
  await login(page, COPRO.email, COPRO.motDePasse)
  for (const chemin of ['/charges', '/incidents', '/assemblees', '/compte']) {
    await attendreSansDebordement(page, chemin)
  }
})
