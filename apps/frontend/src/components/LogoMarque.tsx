/**
 * Marque (symbole) de CopropHub : une seule source pour l'en-tête, la connexion et les écrans
 * d'authentification. Elle prend la couleur du thème (`--color-primary`). Quand le logo définitif
 * sera prêt, il suffit de remplacer le dessin de ce composant.
 */
export default function LogoMarque({ taille = 28 }: { taille?: number }) {
  const dessin = Math.round(taille * 0.5)
  return (
    <span
      aria-hidden="true"
      style={{
        width: taille,
        height: taille,
        backgroundColor: 'var(--color-primary)',
        borderRadius: Math.round(taille * 0.24),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={dessin} height={dessin} viewBox="0 0 14 14" fill="none" focusable="false">
        <rect x="1" y="4" width="12" height="9" rx="1" fill="white" opacity="0.9" />
        <rect x="4" y="1" width="6" height="4" rx="1" fill="white" opacity="0.7" />
        <rect x="3" y="7" width="2" height="2" rx="0.5" style={{ fill: 'var(--color-primary)' }} />
        <rect x="6" y="7" width="2" height="2" rx="0.5" style={{ fill: 'var(--color-primary)' }} />
        <rect x="9" y="7" width="2" height="2" rx="0.5" style={{ fill: 'var(--color-primary)' }} />
      </svg>
    </span>
  )
}
