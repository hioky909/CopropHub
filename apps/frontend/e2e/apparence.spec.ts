import { expect, test, type Page } from '@playwright/test'
import { auditer, login, logout } from './fixtures.js'

/**
 * Personnalisation des couleurs, en navigateur réel contre le vrai backend : choix dans l'éditeur,
 * aperçu isolé, enregistrement, application à toute l'application, persistance à travers
 * navigation, rechargement, déconnexion et reconnexion, isolation entre utilisateurs, accessibilité.
 */
const MOT_DE_PASSE = 'un-mot-de-passe-suffisamment-long'
const PRIMAIRE_CLASSIQUE = '#1e4b8f'

async function creerCompte(page: Page): Promise<string> {
  const email = `apparence-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@coprophub.local`
  await page.goto('/connexion')
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  await page.getByLabel('Nom').fill('Apparence E2E')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  // La page d'atterrissage dépend de la page d'où l'on vient : on attend simplement d'être connecté.
  await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeVisible()
  return email
}

const primaire = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim().toLowerCase())

const primaireApercu = (page: Page) =>
  page.getByTestId('apercu-theme').evaluate((el) => (el as HTMLElement).style.getPropertyValue('--color-primary'))

function versRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

/** La pastille visible (et non l'`<input>` masqué qu'elle recouvre) : c'est ce que clique un utilisateur. */
const pastille = (page: Page, nom: string) => page.locator('label.pastille', { hasText: nom })

async function ouvrirApparence(page: Page) {
  await page.goto('/compte')
  await expect(page.getByRole('region', { name: 'Apparence' })).toBeVisible()
}

test('choisir une couleur : aperçu isolé, application partout, persistance et réinitialisation', async ({ page }) => {
  const email = await creerCompte(page)
  await ouvrirApparence(page)
  expect(await primaire(page)).toBe(PRIMAIRE_CLASSIQUE)

  // Personnalisé + pastille verte : l'aperçu change, pas encore l'application.
  await page.getByRole('radio', { name: /Personnalisé/ }).click()
  await pastille(page, 'Vert').click()
  const vert = await primaireApercu(page)
  expect(vert).toMatch(/^#[0-9a-f]{6}$/i)
  expect(vert.toLowerCase()).not.toBe(PRIMAIRE_CLASSIQUE)
  expect(await primaire(page)).toBe(PRIMAIRE_CLASSIQUE)

  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Apparence enregistrée.')).toBeVisible()
  expect(await primaire(page)).toBe(vert.toLowerCase())

  // Le vrai bouton principal de la page utilise bien la nouvelle couleur (pas seulement la variable).
  await expect(page.getByRole('button', { name: 'Modifier le mot de passe' })).toHaveCSS('background-color', versRgb(vert))

  // Navigation dans l'application : le thème est conservé.
  for (const nom of ['Assemblées', 'Incidents', 'Charges']) {
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: nom }).click()
    await expect(page.getByRole('heading', { name: nom })).toBeVisible()
    expect(await primaire(page)).toBe(vert.toLowerCase())
  }

  // Rechargement : le thème est toujours là.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Charges' })).toBeVisible()
  expect(await primaire(page)).toBe(vert.toLowerCase())

  // Déconnexion : couleurs d'origine ; reconnexion : le vert revient depuis le serveur.
  await logout(page)
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
  expect(await primaire(page)).toBe(PRIMAIRE_CLASSIQUE)
  await login(page, email, MOT_DE_PASSE)
  await expect(page.getByRole('heading', { name: 'Charges' })).toBeVisible()
  expect(await primaire(page)).toBe(vert.toLowerCase())

  // Réinitialisation : retour au Classique, y compris après rechargement.
  await ouvrirApparence(page)
  await page.getByRole('button', { name: 'Réinitialiser le thème CopropHub' }).click()
  await expect(page.getByText('Couleurs d’origine rétablies.')).toBeVisible()
  expect(await primaire(page)).toBe(PRIMAIRE_CLASSIQUE)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Apparence' })).toBeVisible()
  expect(await primaire(page)).toBe(PRIMAIRE_CLASSIQUE)
  await expect(page.getByRole('radio', { name: /Classique/ })).toBeChecked()
})

test('Annuler abandonne le choix ; le thème d’un utilisateur ne touche pas celui d’un autre', async ({ page }) => {
  await creerCompte(page)
  await ouvrirApparence(page)
  await page.getByRole('radio', { name: /Personnalisé/ }).click()
  await pastille(page, 'Violet').click()
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('radio', { name: /Classique/ })).toBeChecked()
  expect(await primaire(page)).toBe(PRIMAIRE_CLASSIQUE)

  // Utilisateur A enregistre un thème ; utilisateur B, sur le même navigateur, voit les couleurs d'origine.
  await page.getByRole('radio', { name: /Personnalisé/ }).click()
  await pastille(page, 'Rose').click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Apparence enregistrée.')).toBeVisible()
  expect(await primaire(page)).not.toBe(PRIMAIRE_CLASSIQUE)
  await logout(page)

  await creerCompte(page)
  expect(await primaire(page)).toBe(PRIMAIRE_CLASSIQUE)
})

test('clavier : l’anneau se règle aux touches et l’aperçu suit', async ({ page }) => {
  await creerCompte(page)
  await ouvrirApparence(page)
  await page.getByRole('radio', { name: /Personnalisé/ }).click()
  const anneau = page.getByRole('slider', { name: 'Teinte' })
  await anneau.focus()
  await page.keyboard.press('Home')
  await expect(anneau).toHaveAttribute('aria-valuenow', '0')
  const avant = await primaireApercu(page)
  await page.keyboard.press('PageUp')
  await expect(anneau).toHaveAttribute('aria-valuenow', '10')
  expect(await primaireApercu(page)).not.toBe(avant)
  await page.keyboard.press('End')
  await expect(anneau).toHaveAttribute('aria-valuenow', '359')
  await expect(anneau).toHaveAttribute('aria-valuetext', /rose, 359 degrés/)

  // Souris : un clic à droite de l'anneau = 90° ; un glissement vers le bas = 180°.
  const boite = (await anneau.boundingBox())!
  const centre = { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 }
  await page.mouse.click(boite.x + boite.width - 15, centre.y)
  await expect(anneau).toHaveAttribute('aria-valuenow', '90')
  await page.mouse.move(boite.x + boite.width - 15, centre.y)
  await page.mouse.down()
  await page.mouse.move(centre.x, boite.y + boite.height - 15, { steps: 5 })
  await page.mouse.up()
  await expect(anneau).toHaveAttribute('aria-valuenow', '180')
})

test('accessibilité WCAG AA avec un thème vert puis avec un jaune très vif (cas extrême)', async ({ page }) => {
  await creerCompte(page)
  const pages = ['/compte', '/charges', '/assemblees', '/incidents']

  // Vert (pastille).
  await ouvrirApparence(page)
  await page.getByRole('radio', { name: /Personnalisé/ }).click()
  await pastille(page, 'Vert').click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Apparence enregistrée.')).toBeVisible()
  for (const chemin of pages) {
    await page.goto(chemin)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await auditer(page, `${chemin} (thème vert)`)
  }

  // Jaune (teinte 100, intensité 100) : la couleur est ajustée pour rester lisible.
  await ouvrirApparence(page)
  const anneau = page.getByRole('slider', { name: 'Teinte' })
  await anneau.focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < 10; i++) await page.keyboard.press('PageUp')
  await expect(anneau).toHaveAttribute('aria-valuenow', '100')
  await page.getByLabel(/Intensité/).fill('100')
  await expect(page.getByTestId('ajustement')).toHaveText('Couleur ajustée pour rester lisible.')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Apparence enregistrée.')).toBeVisible()
  for (const chemin of pages) {
    await page.goto(chemin)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await auditer(page, `${chemin} (thème jaune)`)
  }
})

test('sur un écran de téléphone, la carte Apparence tient dans l’écran', async ({ page }) => {
  await creerCompte(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await ouvrirApparence(page)
  await page.getByRole('radio', { name: /Personnalisé/ }).click()
  await expect(page.getByRole('slider', { name: 'Teinte' })).toBeVisible()
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(debordement).toBeLessThanOrEqual(0)
  const poignee = await page.getByRole('slider', { name: 'Teinte' }).boundingBox()
  expect(poignee!.width).toBeGreaterThanOrEqual(44)
})
