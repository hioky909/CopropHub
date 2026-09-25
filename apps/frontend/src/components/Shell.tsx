import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import type { TypeCompte } from '../api/types.js'

const NAV_ITEMS: { to: string; label: string; roles: TypeCompte[] }[] = [
  { to: '/', label: 'Tableau de bord', roles: ['SYNDIC'] },
  { to: '/coproprietaires', label: 'Copropriétaires', roles: ['SYNDIC'] },
  { to: '/assemblees', label: 'Assemblées', roles: ['SYNDIC', 'COPROPRIETAIRE'] },
  { to: '/incidents', label: 'Incidents', roles: ['SYNDIC', 'COPROPRIETAIRE'] },
  { to: '/charges', label: 'Charges', roles: ['SYNDIC', 'COPROPRIETAIRE'] },
]

export default function Shell({ children }: { children: ReactNode }) {
  const { utilisateur, deconnecter } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Sur mobile la navigation défile : on amène l'onglet actif dans la vue.
  useEffect(() => {
    document.querySelector('.entete-nav a.active')?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [location.pathname])

  if (!utilisateur) return <>{children}</>

  const items = NAV_ITEMS.filter((item) => item.roles.includes(utilisateur.typeCompte))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F6F8' }}>
      <header
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E0E0E0',
          position: 'sticky',
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, minHeight: 56, padding: '6px 0' }}>
            <div className="entete-gauche" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="entete-marque" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    backgroundColor: '#1E4B8F',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="4" width="12" height="9" rx="1" fill="white" opacity="0.9" />
                    <rect x="4" y="1" width="6" height="4" rx="1" fill="white" opacity="0.7" />
                    <rect x="3" y="7" width="2" height="2" rx="0.5" fill="#1E4B8F" />
                    <rect x="6" y="7" width="2" height="2" rx="0.5" fill="#1E4B8F" />
                    <rect x="9" y="7" width="2" height="2" rx="0.5" fill="#1E4B8F" />
                  </svg>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
                  CopropHub
                </span>
              </div>

              <nav className="entete-nav" style={{ display: 'flex', gap: 4 }}>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    style={({ isActive }) => ({
                      padding: '6px 12px',
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#1E4B8F' : '#5C5C5C',
                      backgroundColor: isActive ? '#EBF0F9' : 'transparent',
                      borderRadius: 6,
                      textDecoration: 'none',
                      flexShrink: 0,
                    })}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="entete-utilisateur" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right' }}>
                <NavLink
                  to="/compte"
                  title="Mon compte"
                  style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', textDecoration: 'none' }}
                >
                  <span className="libelle-long">{utilisateur.email}</span>
                  <span className="libelle-court">Mon compte</span>
                </NavLink>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#1E4B8F' }}>
                  {utilisateur.typeCompte === 'SYNDIC'
                    ? 'Syndic'
                    : utilisateur.estMembreConseilSyndical
                      ? 'Conseil syndical'
                      : 'Copropriétaire'}
                </p>
              </div>
              <button
                onClick={() => {
                  void deconnecter().then(() => navigate('/connexion'))
                }}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#5C5C5C',
                  background: 'none',
                  border: '1px solid #E0E0E0',
                  borderRadius: 6,
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
