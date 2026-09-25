import { useLayoutEffect, useRef } from 'react'
import Badge from './Badge.js'
import Button from './Button.js'
import { TextField } from './FormField.js'
import Notification from './Notification.js'
import { appliquerTheme } from '../theme/appliquerTheme.js'
import type { PaletteTheme } from '../theme/genererTheme.js'

/**
 * Aperçu du thème dans un conteneur isolé : les variables CSS ne sont posées que sur ce conteneur
 * (jamais sur `<html>` avant l'enregistrement), donc l'application ne change pas pendant la
 * recherche. Construit avec les vrais composants, pour un aperçu fidèle. `null` = thème Classique.
 * Le contenu est inerte (ni focus ni lecture) : c'est une illustration, pas des contrôles.
 */
export default function ApercuTheme({ palette }: { palette: PaletteTheme | null }) {
  const racine = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (racine.current) appliquerTheme(racine.current, palette)
  }, [palette])

  return (
    <div
      ref={racine}
      data-testid="apercu-theme"
      {...({ inert: '' } as Record<string, string>)}
      style={{
        backgroundColor: 'var(--color-background)',
        border: '1px solid var(--color-neutral-200)',
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        <span style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', borderRadius: 6 }}>
          Assemblées
        </span>
        <span style={{ padding: '6px 12px', fontSize: 13, color: 'var(--color-neutral-500)' }}>Charges</span>
      </div>

      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Assemblée générale du 14 novembre</p>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-500)' }}>
          Texte secondaire et <span style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>lien</span> dans une carte.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Badge variant="info" label="Vote ouvert" />
          <Badge variant="success" label="Payée" />
          <Badge variant="warning" label="En cours" />
          <Badge variant="danger" label="En retard" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" size="sm">
            Bouton principal
          </Button>
          <Button variant="secondary" size="sm">
            Secondaire
          </Button>
        </div>
      </div>

      <TextField label="Champ de formulaire" defaultValue="Exemple" readOnly tabIndex={-1} />
      <Notification variant="success">Enregistré.</Notification>
      <Notification variant="error">Une erreur est survenue.</Notification>
    </div>
  )
}
