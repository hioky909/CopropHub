import { useState } from 'react'
import { ApiError } from '../api/client.js'
import Button from './Button.js'
import Notification from './Notification.js'

/**
 * Bouton de téléchargement d'un document généré par le serveur (F-13) : indique la génération en
 * cours, empêche le double clic et affiche l'erreur (AG non clôturée, session expirée…) au lieu de
 * la perdre.
 */
export default function BoutonTelechargement({
  libelle,
  onTelecharger,
}: {
  libelle: string
  onTelecharger: () => Promise<void>
}) {
  const [encours, setEncours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function lancer() {
    setErreur(null)
    setEncours(true)
    try {
      await onTelecharger()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de générer le document.')
    } finally {
      setEncours(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      <Button variant="secondary" onClick={() => void lancer()} disabled={encours} aria-busy={encours}>
        {encours ? 'Génération…' : libelle}
      </Button>
      {erreur && <Notification variant="error">{erreur}</Notification>}
    </div>
  )
}
