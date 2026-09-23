import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#F5F6F8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 32,
              height: 32,
              backgroundColor: '#1E4B8F',
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="4" width="12" height="9" rx="1" fill="white" opacity="0.9" />
              <rect x="4" y="1" width="6" height="4" rx="1" fill="white" opacity="0.7" />
              <rect x="3" y="7" width="2" height="2" rx="0.5" fill="#1E4B8F" />
              <rect x="6" y="7" width="2" height="2" rx="0.5" fill="#1E4B8F" />
              <rect x="9" y="7" width="2" height="2" rx="0.5" fill="#1E4B8F" />
            </svg>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
            CopropHub
          </span>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E0E0E0',
            borderRadius: 10,
            padding: 32,
          }}
        >
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, backgroundColor: '#F2F2F2', borderRadius: 8, padding: 3 }}>
            {(['connexion', 'inscription'] as const).map((m) => (
              <button
                key={m}
                type="button"
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
                  backgroundColor: mode === m ? '#FFFFFF' : 'transparent',
                  color: mode === m ? '#1A1A1A' : '#5C5C5C',
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
        </div>

        {mode === 'inscription' && (
          <p style={{ marginTop: 16, fontSize: 12, color: '#5C5C5C', textAlign: 'center' }}>
            La création de compte crée un compte copropriétaire ; le syndic rattache ensuite votre lot.
          </p>
        )}
      </div>
    </div>
  )
}
