import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoHorizontal } from './Logo.js'

/** Cadre commun des écrans publics d'authentification (logo, titre, carte centrée), même habillage que la connexion. */
export default function PageAuth({ titre, children }: { titre: string; children: ReactNode }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 32 }}>
          <LogoHorizontal taille={40} />
        </div>
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 10, padding: 32 }}>
          <h1 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: 'var(--color-neutral-900)' }}>{titre}</h1>
          {children}
        </div>
        <p style={{ textAlign: 'center', marginTop: 24 }}>
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
