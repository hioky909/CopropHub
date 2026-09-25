import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button.js'
import { TextField } from '../components/FormField.js'
import Notification from '../components/Notification.js'
import PageAuth from '../components/PageAuth.js'
import { authApi } from '../api/auth.js'
import { ApiError } from '../api/client.js'

/**
 * Mot de passe oublié : l'utilisateur saisit son adresse ; la réponse est la
 * même que le compte existe ou non (le serveur ne révèle rien), donc l'écran
 * ne dit jamais « adresse inconnue ».
 */
export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function soumettre(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      const reponse = await authApi.demanderReinitialisation(email)
      setMessage(reponse.message)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’envoyer la demande.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <PageAuth titre="Mot de passe oublié">
      {message ? (
        <Notification variant="success">{message}</Notification>
      ) : (
        <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-500)' }}>
            Saisissez l’adresse de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.
          </p>
          {erreur && <Notification variant="error">{erreur}</Notification>}
          <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="primary" fullWidth disabled={envoi}>
            {envoi ? 'Envoi…' : 'Envoyer le lien'}
          </Button>
        </form>
      )}
      <p style={{ margin: '16px 0 0', fontSize: 13, textAlign: 'center' }}>
        <Link to="/connexion" style={{ color: 'var(--color-primary)' }}>
          Retour à la connexion
        </Link>
      </p>
    </PageAuth>
  )
}
