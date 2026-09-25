import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/Button.js'
import { TextField } from '../components/FormField.js'
import Notification from '../components/Notification.js'
import PageAuth from '../components/PageAuth.js'
import { authApi } from '../api/auth.js'
import { ApiError } from '../api/client.js'

/** Choix d'un nouveau mot de passe grâce au lien reçu par email (`?jeton=…`, à usage unique). */
export default function Reinitialisation() {
  const [parametres] = useSearchParams()
  const jeton = parametres.get('jeton')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [termine, setTermine] = useState(false)
  const [envoi, setEnvoi] = useState(false)

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    if (nouveau !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.')
      return
    }
    setEnvoi(true)
    try {
      await authApi.reinitialiserMotDePasse(jeton!, nouveau)
      setTermine(true)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de réinitialiser le mot de passe.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <PageAuth titre="Nouveau mot de passe">
      {!jeton ? (
        <Notification variant="error">Ce lien est incomplet. Demandez-en un nouveau depuis la page « Mot de passe oublié ».</Notification>
      ) : termine ? (
        <Notification variant="success">Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.</Notification>
      ) : (
        <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {erreur && <Notification variant="error">{erreur}</Notification>}
          <TextField
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            required
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            help="12 caractères minimum."
          />
          <TextField
            label="Confirmer le nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <Button type="submit" variant="primary" fullWidth disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </Button>
        </form>
      )}
      <p style={{ margin: '16px 0 0', fontSize: 13, textAlign: 'center' }}>
        {termine ? (
          <Link to="/connexion" style={{ color: '#1E4B8F' }}>
            Aller à la connexion
          </Link>
        ) : (
          <Link to="/mot-de-passe-oublie" style={{ color: '#1E4B8F' }}>
            Demander un nouveau lien
          </Link>
        )}
      </p>
    </PageAuth>
  )
}
