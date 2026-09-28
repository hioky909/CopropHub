import { LogoHorizontal } from '../components/Logo.js'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Button from '../components/Button.js'
import { TextField } from '../components/FormField.js'
import Notification from '../components/Notification.js'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'

export default function Connexion() {
  const { utilisateur, connecter, inscrire } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  if (utilisateur) {
    const destination = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={destination} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      if (mode === 'connexion') {
        await connecter(email, motDePasse)
      } else {
        await inscrire(nom, email, motDePasse)
      }
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-background)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <h1 className="sr-only">{mode === 'connexion' ? 'Connexion' : 'Créer un compte'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
          <LogoHorizontal taille={40} />
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-neutral-200)',
            borderRadius: 10,
            padding: 32,
          }}
        >
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, backgroundColor: 'var(--color-neutral-100)', borderRadius: 8, padding: 3 }}>
            {(['connexion', 'inscription'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m)
                  setErreur(null)
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  backgroundColor: mode === m ? 'var(--color-surface)' : 'transparent',
                  color: mode === m ? 'var(--color-neutral-900)' : 'var(--color-neutral-500)',
                  boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {m === 'connexion' ? 'Connexion' : 'Créer un compte'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'inscription' && (
              <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required autoComplete="name" />
            )}
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <TextField
              label="Mot de passe"
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
            />

            {erreur && <Notification variant="error">{erreur}</Notification>}

            <Button type="submit" variant="primary" fullWidth disabled={envoi} style={{ padding: '10px 16px', fontSize: 15 }}>
              {envoi ? 'Veuillez patienter…' : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
            </Button>
          </form>
          {mode === 'connexion' && (
            <p style={{ margin: '16px 0 0', fontSize: 13, textAlign: 'center' }}>
              <Link to="/mot-de-passe-oublie" style={{ color: 'var(--color-primary)' }}>
                Mot de passe oublié ?
              </Link>
            </p>
          )}
        </div>

        {mode === 'inscription' && (
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--color-neutral-500)', textAlign: 'center' }}>
            La création de compte crée un compte copropriétaire ; le syndic rattache ensuite votre lot.
          </p>
        )}
        <p style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            to="/mentions-legales"
            style={{ fontSize: 12, color: 'var(--color-neutral-500)', textDecoration: 'underline' }}
          >
            Mentions légales et confidentialité
          </Link>
        </p>
      </div>
    </main>
  )
}
