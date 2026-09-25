import { useState } from 'react'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'
import Notification from './Notification.js'

/**
 * Carte « Notifications » de la page Mon compte (F-12) : recevoir ou non, par email, l'ouverture et
 * la clôture d'une assemblée, l'avancement de ses incidents et les nouvelles charges de son lot.
 * L'état affiché est toujours celui confirmé par le serveur.
 */
export default function PreferencesNotifications() {
  const { utilisateur, definirNotificationsEmail } = useAuth()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const actives = utilisateur?.notificationsEmail !== false // actif par défaut

  async function changer(nouvelle: boolean) {
    setErreur(null)
    setEnvoi(true)
    try {
      await definirNotificationsEmail(nouvelle)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer ce réglage.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <section
      aria-labelledby="titre-notifications"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 8,
        padding: 24,
        marginTop: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <h2 id="titre-notifications" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>
        Notifications
      </h2>
      {erreur && <Notification variant="error">{erreur}</Notification>}
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: envoi ? 'wait' : 'pointer' }}>
        <input
          type="checkbox"
          checked={actives}
          disabled={envoi}
          onChange={(e) => void changer(e.target.checked)}
          style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--color-primary)' }}
        />
        <span style={{ fontSize: 14, color: 'var(--color-neutral-900)' }}>
          Recevoir les notifications par email
          <span style={{ display: 'block', fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 2 }}>
            Ouverture et clôture d’une assemblée, avancement de vos incidents, nouvelle charge sur votre lot. Les courriels ne
            contiennent jamais de vote ni de montant.
          </span>
        </span>
      </label>
    </section>
  )
}
