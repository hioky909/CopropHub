import { expect, test, type Page } from '@playwright/test'
import { COPRO, SYNDIC, login, logout } from './fixtures.js'

/**
 * En-tête de l'application : navigation à icônes, identité (avatar généré + email + rôle), bouton
 * « Mon compte » distinct de l'identité, bouton « Déconnexion ».
 */
const MOT_DE_PASSE = 'un-mot-de-passe-suffisamment-long'

async function creerCompte(page: Page): Promise<void> {
  const email = `entete-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@coprophub.local`
  await page.goto('/connexion')
  await page.getByRole('button', { name: 'Créer un compte' }).click()
  await page.getByLabel('Nom').fill('Entete E2E')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE)
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeVisible()
}

const contourAvatar = (page: Page) => page.locator('header [data-avatar] [data-corps]').getAttribute('d')

test('l’en-tête affiche l’identité et un bouton « Mon compte » dédié qui ouvre la page', async ({ page }) => {
  await login(page, COPRO.email, COPRO.motDePasse)
  await page.goto('/charges')
  const entete = page.getByRole('banner')
  await expect(entete.getByText('CopropHub', { exact: true })).toBeVisible() // logo horizontal : nom en vrai texte
  await expect(entete.locator('[data-avatar]')).toBeVisible()
  await expect(entete.getByText(COPRO.email)).toBeVisible()
  await expect(entete.getByText('Copropriétaire')).toBeVisible()

  // Le bouton dédié (et non l'email) mène aux paramètres.
  await entete.getByRole('link', { name: 'Mon compte' }).click()
  await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
  await expect(entete.getByRole('link', { name: 'Mon compte' })).toHaveClass(/active/)
  await expect(page.getByRole('main').locator('[data-avatar]')).toBeVisible() // avatar aussi sur la page

  await entete.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible()
})

test('la navigation indique la page active et propose une icône par onglet', async ({ page }) => {
  await login(page, SYNDIC.email, SYNDIC.motDePasse)
  await page.goto('/incidents')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link')).toHaveCount(5)
  await expect(nav.locator('svg')).toHaveCount(5)
  await expect(nav.getByRole('link', { name: 'Incidents' })).toHaveClass(/active/)
  await expect(nav.getByRole('link', { name: 'Charges' })).not.toHaveClass(/active/)
  await expect(page.getByRole('banner').getByText('Syndic', { exact: true })).toBeVisible()
  await logout(page)
})

test('chaque utilisateur a son avatar, qui suit la couleur du thème choisi', async ({ page }) => {
  await creerCompte(page)
  const avatarA = await contourAvatar(page)
  expect(avatarA).toMatch(/^M/)

  // Le corps de la créature prend la couleur principale du thème (ici : classique).
  const couleurCorps = () => page.locator('header [data-avatar] [data-corps]').evaluate((el) => getComputedStyle(el).fill)
  expect(await couleurCorps()).toBe('rgb(30, 75, 143)')

  // Après le choix d'un thème vert, la même créature devient verte.
  await page.goto('/compte')
  await page.getByRole('radio', { name: /Personnalisé/ }).click()
  await page.locator('label.pastille', { hasText: 'Vert' }).click()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Apparence enregistrée.')).toBeVisible()
  await expect.poll(couleurCorps).not.toBe('rgb(30, 75, 143)')
  expect(await contourAvatar(page)).toBe(avatarA) // même forme : seule la couleur change

  // Un autre utilisateur a une autre créature.
  await logout(page)
  await creerCompte(page)
  expect(await contourAvatar(page)).not.toBe(avatarA)
})

test('sur un écran de téléphone, l’en-tête garde avatar, compte et déconnexion sans déborder', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page, COPRO.email, COPRO.motDePasse)
  await page.goto('/charges')
  const entete = page.getByRole('banner')
  await expect(entete.locator('[data-avatar]')).toBeVisible()
  const compte = entete.getByRole('link', { name: 'Mon compte' })
  const deconnexion = entete.getByRole('button', { name: 'Déconnexion' })
  await expect(compte).toBeVisible()
  await expect(deconnexion).toBeVisible()
  for (const bouton of [compte, deconnexion]) {
    const boite = (await bouton.boundingBox())!
    // 32px (.bouton-entete) : toujours au-dessus du minimum WCAG 2.2 AA (2.5.8 Target Size, 24px).
    expect(boite.width).toBeGreaterThanOrEqual(32)
    expect(boite.height).toBeGreaterThanOrEqual(32)
  }
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(debordement).toBeLessThanOrEqual(0)
})

test('le favicon est le logo (icône d’application) et il est bien servi', async ({ page, request }) => {
  await page.goto('/connexion')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg')
  const reponse = await request.get('/favicon.svg')
  expect(reponse.ok()).toBe(true)
  expect(reponse.headers()['content-type']).toContain('image/svg+xml')
  const svg = await reponse.text()
  expect(svg.match(/<circle/g)).toHaveLength(7) // le hub : centre + 6 points
  expect(svg).toContain('#1E4B8F') // bleu d'origine : un favicon ne peut pas suivre le thème
})

for (const largeur of [1280, 1920]) {
  test(`à ${largeur} px, le compte et la déconnexion restent sur la même ligne que la navigation, à droite, en icônes`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 })
    await login(page, COPRO.email, COPRO.motDePasse)
    await page.goto('/charges')
    const entete = page.getByRole('banner')
    const lien = (await entete.getByRole('navigation').getByRole('link', { name: 'Charges' }).boundingBox())!
    const compte = entete.getByRole('link', { name: 'Mon compte' })
    const deconnexion = entete.getByRole('button', { name: 'Déconnexion' })
    const boiteCompte = (await compte.boundingBox())!
    const boiteDeconnexion = (await deconnexion.boundingBox())!

    // Même ligne : les centres verticaux sont alignés et l'en-tête reste bas.
    expect(Math.abs(boiteCompte.y + boiteCompte.height / 2 - (lien.y + lien.height / 2))).toBeLessThan(6)
    expect((await entete.boundingBox())!.height).toBeLessThan(80)
    // À droite de la navigation, et la déconnexion en dernier.
    expect(boiteCompte.x).toBeGreaterThan(lien.x + lien.width)
    expect(boiteDeconnexion.x).toBeGreaterThan(boiteCompte.x)
    // Icônes seules : pas de texte visible dans les boutons (le nom accessible reste).
    await expect(compte).toHaveText('')
    await expect(deconnexion).toHaveText('')
    await expect(compte).toHaveAttribute('title', 'Mon compte')
    await expect(deconnexion).toHaveAttribute('title', 'Déconnexion')
    expect(boiteCompte.width).toBeLessThanOrEqual(40)
  })
}

test('aucune requête vers un site tiers, et la police Inter est bien chargée depuis l’application (RGPD)', async ({ page }) => {
  const origines = new Set<string>()
  page.on('request', (r) => {
    if (r.url().startsWith('http')) origines.add(new URL(r.url()).origin)
  })
  await login(page, COPRO.email, COPRO.motDePasse)
  for (const chemin of ['/charges', '/assemblees', '/incidents', '/compte']) {
    await page.goto(chemin)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
  // Seulement le frontend et l'API : ni Google Fonts, ni CDN.
  for (const origine of origines) expect(origine).toMatch(/^http:\/\/localhost:(3100|5183|3000|5173)$/)

  const policeChargee = await page.evaluate(async () => {
    await document.fonts.ready
    return document.fonts.check('600 16px "Inter Variable"')
  })
  expect(policeChargee).toBe(true)
})

test('l’application est installable : manifeste et icônes servis, aucune erreur d’installation détectée par Chromium', async ({ page, context, request }) => {
  await page.goto('/connexion')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')

  const manifeste = await request.get('/manifest.webmanifest')
  expect(manifeste.ok()).toBe(true)
  const { icons } = (await manifeste.json()) as { icons: { src: string }[] }
  for (const { src } of icons) {
    const reponse = await request.get(src)
    expect(reponse.ok(), src).toBe(true)
    expect(reponse.headers()['content-type'], src).toContain('image/png')
  }
  expect((await request.get('/icones/apple-touch-icon.png')).ok()).toBe(true)

  // Le vrai contrôle d'installabilité de Chromium (manifeste valide, icônes chargeables, page sécurisée).
  const cdp = await context.newCDPSession(page)
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] }
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([])
})
