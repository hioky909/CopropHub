import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/Badge.js'
import Notification from '../components/Notification.js'
import { agsApi } from '../api/ags.js'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'
import type { Ag } from '../api/types.js'

const STATUT_BADGE: Record<Ag['statut'], { variant: 'neutral' | 'info' | 'success'; label: string }> = {
  PLANIFIEE: { variant: 'neutral', label: 'Planifiée' },
  OUVERTE: { variant: 'info', label: 'Vote ouvert' },
  CLOTUREE: { variant: 'success', label: 'Clôturée' },
}

export default function Assemblees() {
  const navigate = useNavigate()
  const { utilisateur } = useAuth()
  const [ags, setAgs] = useState<Ag[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    agsApi
      .lister()
      .then((r) => setAgs(r.ags))
      .catch((err) => setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les assemblées.'))
      .finally(() => setChargement(false))
  }, [])

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
        Assemblées générales
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#5C5C5C' }}>
        {utilisateur?.typeCompte === 'SYNDIC'
          ? 'Cliquez sur une AG pour gérer son vote et ses résolutions.'
          : 'Cliquez sur une AG ouverte pour voter, ou une AG clôturée pour consulter les résultats.'}
      </p>

      {erreur && (
        <div style={{ marginBottom: 16 }}>
          <Notification variant="error">{erreur}</Notification>
        </div>
      )}

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
        {chargement ? (
          <p style={{ padding: 24, fontSize: 13, color: '#5C5C5C', margin: 0 }}>Chargement…</p>
        ) : ags.length === 0 ? (
          <p style={{ padding: 24, fontSize: 13, color: '#5C5C5C', margin: 0 }}>Aucune assemblée générale.</p>
        ) : (
          ags.map((ag, i) => (
            <button
              key={ag.id}
              onClick={() => navigate(`/assemblees/${ag.id}`)}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderTop: i > 0 ? '1px solid #F2F2F2' : 'none',
                border: 'none',
                borderTopStyle: 'solid',
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                Assemblée générale du {new Date(ag.dateAg).toLocaleDateString('fr-FR')}
              </span>
              <Badge {...STATUT_BADGE[ag.statut]} />
            </button>
          ))
        )}
      </div>
    </main>
  )
}
