import { expect, test } from '@playwright/test'
import { RESET, login } from './fixtures.js'

test('mot de passe oublié : la demande ne révèle rien, puis le lien reçu permet de choisir un nouveau mot de passe', async ({
  page,
}) => {
  // Demande depuis la page de connexion : même message pour une adresse inconnue.
  await page.goto('/connexion')
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
  // La page de connexion a aussi un champ « Email » : on attend la nouvelle page avant de saisir.
  await expect(page.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible()
  const adresse = 'personne-ne-connait-cette-adresse@coprophub.local'
  await page.getByLabel('Email').fill(adresse)
  await expect(page.getByLabel('Email')).toHaveValue(adresse)
  await page.getByRole('button', { name: 'Envoyer le lien' }).click()
  await expect(page.getByText(/Si un compte existe pour cette adresse/)).toBeVisible()

  // Le lien (jeton amorcé par le seed, empreinte en base) : confirmation obligatoire identique, puis succès.
  const nouveau = 'un-tout-nouveau-mot-de-passe-e2e-2'
  await page.goto(`/reinitialisation?jeton=${RESET.jeton}`)
  await page.getByLabel(/^Nouveau mot de passe/).fill(nouveau)
  await page.getByLabel('Confirmer le nouveau mot de passe').fill('une-confirmation-differente-1')
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await expect(page.getByText('La confirmation ne correspond pas au nouveau mot de passe.')).toBeVisible()

  await page.getByLabel('Confirmer le nouveau mot de passe').fill(nouveau)
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await expect(page.getByText(/Votre mot de passe a été modifié/)).toBeVisible()

  // Le lien est à usage unique.
  await page.goto(`/reinitialisation?jeton=${RESET.jeton}`)
  await page.getByLabel(/^Nouveau mot de passe/).fill('encore-un-autre-mot-de-passe-3')
  await page.getByLabel('Confirmer le nouveau mot de passe').fill('encore-un-autre-mot-de-passe-3')
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await expect(page.getByText('Ce lien de réinitialisation est invalide ou a expiré.')).toBeVisible()

  // Connexion réelle avec le nouveau mot de passe.
  await login(page, RESET.email, nouveau)
  await expect(page.getByText(RESET.email).first()).toBeVisible()
})
