import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import type { TypeCompte } from '../api/types.js'
import { libelleRole } from '../utils/format.js'
import AvatarProfil from './AvatarProfil.js'
import Icone, { type NomIcone } from './Icones.js'
import { LogoHorizontal } from './Logo.js'

const NAV_ITEMS: { to: string; label: string; icone: NomIcone; roles: TypeCompte[] }[] = [
  { to: '/', label: 'Tableau de bord', icone: 'tableau-de-bord', roles: ['SYNDIC'] },
  { to: '/coproprietaires', label: 'Copropriétaires', icone: 'coproprietaires', roles: ['SYNDIC'] },
  { to: '/assemblees', label: 'Assemblées', icone: 'assemblees', roles: ['SYNDIC', 'COPROPRIETAIRE'] },
  { to: '/incidents', label: 'Incidents', icone: 'incidents', roles: ['SYNDIC', 'COPROPRIETAIRE'] },
  { to: '/charges', label: 'Charges', icone: 'charges', roles: ['SYNDIC', 'COPROPRIETAIRE'] },
]

export default function Shell({ children }: { children: ReactNode }) {
  const { utilisateur, deconnecter } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Sur mobile la navigation défile : on amène l'onglet actif dans la vue.
  useEffect(() => {
    document.querySelector('.entete-nav a.active')?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [location.pathname])

  // Changement de page : un lecteur d'écran ne l'annonce pas de lui-même. On donne à l'onglet un
  // titre propre à la page et on place le focus sur le contenu (sauf au tout premier affichage).
  const premierAffichage = useRef(true)
  useEffect(() => {
    // Les écrans chargent leurs données après le premier rendu : le titre suit donc le contenu.
    const majTitre = () => {
      const titre = document.querySelector('h1')?.textContent
      document.title = titre ? `${titre} — CopropHub` : 'CopropHub'
    }
    majTitre()
    const observateur = new MutationObserver(majTitre)
    observateur.observe(document.body, { childList: true, subtree: true, characterData: true })
    const main = document.querySelector('main')
    if (premierAffichage.current) {
      premierAffichage.current = false
      return () => observateur.disconnect()
    }
    main?.setAttribute('tabindex', '-1')
    main?.focus({ preventScroll: true })
    return () => observateur.disconnect()
  }, [location.pathname])

  if (!utilisateur) return <>{children}</>

  const items = NAV_ITEMS.filter((item) => item.roles.includes(utilisateur.typeCompte))

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      <a
        href="#contenu"
        className="lien-evitement"
        onClick={(e) => {
          e.preventDefault()
          const main = document.querySelector('main')
          main?.setAttribute('tabindex', '-1')
          main?.focus()
        }}
      >
        Aller au contenu
      </a>
      <header className="entete">
        <div className="entete-contenu">
          <div className="entete-rangee">
            <div className="entete-gauche">
              <div className="entete-marque">
                <LogoHorizontal taille={28} />
              </div>
              <span className="entete-separateur" aria-hidden="true" />

              <nav aria-label="Navigation principale" className="entete-nav">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-lien">
                    <Icone nom={item.icone} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="entete-utilisateur">
              <div className="identite">
                <AvatarProfil graine={utilisateur.id} taille={34} />
                <div className="identite-texte">
                  <span className="identite-email">{utilisateur.email}</span>
                  <span className="identite-role">{libelleRole(utilisateur)}</span>
                </div>
              </div>
              <NavLink to="/compte" className="bouton-entete" aria-label="Mon compte" title="Mon compte">
                <Icone nom="compte" />
              </NavLink>
              <button
                type="button"
                className="bouton-entete"
                aria-label="Déconnexion"
                title="Déconnexion"
                onClick={() => {
                  void deconnecter().then(() => navigate('/connexion'))
                }}
              >
                <Icone nom="deconnexion" />
              </button>
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
