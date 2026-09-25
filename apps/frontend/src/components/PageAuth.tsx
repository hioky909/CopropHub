import type { ReactNode } from 'react'

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
          <div
            style={{
              width: 32,
              height: 32,
              backgroundColor: 'var(--color-primary)',
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="4" width="12" height="9" rx="1" fill="white" opacity="0.9" />
              <rect x="4" y="1" width="6" height="4" rx="1" fill="white" opacity="0.7" />
            </svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.01em' }}>CopropHub</span>
        </div>
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 10, padding: 32 }}>
          <h1 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: 'var(--color-neutral-900)' }}>{titre}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}
