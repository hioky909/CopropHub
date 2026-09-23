import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import type { TypeCompte } from '../api/types.js'

export function RouteProtegee({ children, roles }: { children: ReactNode; roles?: TypeCompte[] }) {
  const { utilisateur, chargement, erreurServeur } = useAuth()
  const location = useLocation()

  if (chargement) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C5C5C' }}>
        Chargement…
      </div>
    )
  }

  if (erreurServeur && !utilisateur) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: '#B3261E' }}>Serveur injoignable</p>
          <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>
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
