/* Génère les icônes PNG de l'application (installation sur téléphone) à partir du logo.
 *
 *   npm run icones --workspace=apps/frontend
 *
 * Utilise le Chromium de Playwright pour rasteriser le SVG : aucune dépendance de plus. Le logo est
 * le même symbole que `public/favicon.svg` et `src/components/Logo.tsx` (toit + hub à six points).
 * Les fichiers générés sont committés : ce script ne sert que si le logo change. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const BLEU = '#1E4B8F'
const dossier = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icones')
mkdirSync(dossier, { recursive: true })

const symbole = `
  <path d="M5.8 43.8 49.9 7.4 93.9 43.8" fill="none" stroke-width="11.3"/>
  <g stroke-width="3.6">
    <line x1="49.9" y1="60.6" x2="49.9" y2="33.1"/><line x1="49.9" y1="60.6" x2="66.7" y2="46.3"/>
    <line x1="49.9" y1="60.6" x2="76.9" y2="67.8"/><line x1="49.9" y1="60.6" x2="49.9" y2="86.5"/>
    <line x1="49.9" y1="60.6" x2="31.1" y2="77.4"/><line x1="49.9" y1="60.6" x2="22.9" y2="54"/>
  </g>
  <circle cx="49.9" cy="60.6" r="10.6" stroke="none"/>
  <circle cx="49.9" cy="33.1" r="6.4" stroke="none"/><circle cx="66.7" cy="46.3" r="6.4" stroke="none"/>
  <circle cx="76.9" cy="67.8" r="6.4" stroke="none"/><circle cx="49.9" cy="86.5" r="6.4" stroke="none"/>
  <circle cx="31.1" cy="77.4" r="6.4" stroke="none"/><circle cx="22.9" cy="54" r="6.4" stroke="none"/>`

/** `rayon` : coins arrondis du carré (0 = plein cadre, pour les icônes « maskable » et iOS). `echelle` : taille du symbole. */
function svg(taille, rayon, echelle) {
  const c = 64 * echelle // symbole de 100×92 ramené à 64 × échelle
  const k = c / 100
  const x = (64 - 100 * k) / 2
  const y = (64 - 92 * k) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="${rayon}" fill="${BLEU}"/>
    <g transform="translate(${x} ${y}) scale(${k})" fill="#FFFFFF" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round">${symbole}</g>
  </svg>`
}

const icones = [
  // Icônes « any » : coins arrondis, fond transparent aux angles.
  { fichier: 'icone-192.png', taille: 192, rayon: 15, echelle: 0.56 },
  { fichier: 'icone-512.png', taille: 512, rayon: 15, echelle: 0.56 },
  // « maskable » : plein cadre, symbole dans la zone de sécurité (80 % centraux) — Android le découpe lui-même.
  { fichier: 'icone-maskable-512.png', taille: 512, rayon: 0, echelle: 0.5 },
  // iOS arrondit lui-même : plein cadre.
  { fichier: 'apple-touch-icon.png', taille: 180, rayon: 0, echelle: 0.56 },
]

const navigateur = await chromium.launch()
try {
  const page = await navigateur.newPage()
  for (const { fichier, taille, rayon, echelle } of icones) {
    await page.setViewportSize({ width: taille, height: taille })
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(taille, rayon, echelle)}</body></html>`)
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: taille, height: taille } })
    writeFileSync(resolve(dossier, fichier), png)
    console.log(`${fichier} (${taille}×${taille}, ${png.length} octets)`)
  }
} finally {
  await navigateur.close()
}
