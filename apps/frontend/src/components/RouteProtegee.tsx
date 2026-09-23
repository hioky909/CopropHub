import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import type { TypeCompte } from '../api/types.js'

export function RouteProtegee({ children, roles }: { children: ReactNode; roles?: TypeCompte[] }) {
  const { utilisateur, chargement } = useAuth()
  const location = useLocation()

  if (chargement) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5C5C5C' }}>
        Chargement…
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
