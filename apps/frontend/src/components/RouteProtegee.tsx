import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import type { TypeCompte } from '../api/types.js'

export function RouteProtegee({ children, roles }: { children: ReactNode; roles?: TypeCompte[] }) {
  const { utilisateur, chargement, erreurServeur } = useAuth()
  const location = useLocation()

  if (chargement) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-neutral-500)' }}>
        Chargement…
      </div>
    )
  }

  if (erreurServeur && !utilisateur) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--color-danger)' }}>Serveur injoignable</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-500)' }}>
            Impossible de contacter le serveur CopropHub. Vérifiez votre connexion, puis rechargez la page.
          </p>
        </div>
      </div>
    )
  }

  if (!utilisateur) {
    return <Navigate to="/connexion" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(utilisateur.typeCompte)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
