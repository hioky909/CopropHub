import { useMemo, useState } from 'react'
import { ApiError } from '../api/client.js'
import { useTheme } from '../context/ThemeContext.js'
import { genererTheme } from '../theme/genererTheme.js'
import ApercuTheme from './ApercuTheme.js'
import Button from './Button.js'
import Notification from './Notification.js'
import SelecteurTeinte from './SelecteurTeinte.js'

type Mode = 'classique' | 'personnalise'

/** Couleurs suggérées : la plupart des utilisateurs cliquent une pastille ; l'anneau sert à affiner. */
const PASTILLES = [
  { nom: 'Vert', teinte: 145, intensite: 55 },
  { nom: 'Sarcelle', teinte: 190, intensite: 55 },
  { nom: 'Violet', teinte: 300, intensite: 55 },
  { nom: 'Rose', teinte: 350, intensite: 55 },
  { nom: 'Bordeaux', teinte: 15, intensite: 60 },
  { nom: 'Orange', teinte: 55, intensite: 60 },
  { nom: 'Ardoise', teinte: 255, intensite: 12 },
] as const

/** Point de départ quand on passe de Classique à Personnalisé : proche du bleu d'origine. */
const DEPART = { teinte: 255, intensite: 55 }

const carte = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-neutral-200)',
  borderRadius: 8,
  padding: 24,
  marginTop: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
} as const

const legende = { fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-900)', padding: 0, marginBottom: 8 } as const
const groupe = { border: 'none', margin: 0, padding: 0, minWidth: 0 } as const

/**
 * Carte « Apparence » de la page Mon compte : « Classique » (couleurs d'origine, rien n'est
 * stocké) ou « Personnalisé » (une teinte et une intensité ; tout le reste est calculé pour rester
 * lisible). L'état d'édition est local : l'application ne change qu'à l'enregistrement.
 */
export default function EditeurApparence() {
  const { theme, enregistrer, reinitialiser } = useTheme()
  const [mode, setMode] = useState<Mode>(theme ? 'personnalise' : 'classique')
  const [teinte, setTeinte] = useState(theme?.teinte ?? DEPART.teinte)
  const [intensite, setIntensite] = useState(theme?.intensite ?? DEPART.intensite)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)

  const palette = useMemo(() => (mode === 'personnalise' ? genererTheme({ teinte, intensite }) : null), [mode, teinte, intensite])
  // Au centre de l'anneau : le primaire généré, ou celui du départ tant qu'on est en Classique.
  const couleurCentre = palette?.primaire ?? genererTheme(DEPART).primaire
  const modifie = theme ? mode === 'classique' || theme.teinte !== teinte || theme.intensite !== intensite : mode === 'personnalise'

  function revenirAuTheme(enregistre: typeof theme) {
    setMode(enregistre ? 'personnalise' : 'classique')
    setTeinte(enregistre?.teinte ?? DEPART.teinte)
    setIntensite(enregistre?.intensite ?? DEPART.intensite)
  }

  function modifier(action: () => void) {
    setErreur(null)
    setSucces(null)
    action()
  }

  async function executer(travail: () => Promise<void>, message: string) {
    setErreur(null)
    setSucces(null)
    setEnvoi(true)
    try {
      await travail()
      setSucces(message)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer l’apparence.')
    } finally {
      setEnvoi(false)
    }
  }

  const enregistrerChoix = () =>
    mode === 'classique'
      ? executer(reinitialiser, 'Couleurs d’origine rétablies.')
      : executer(() => enregistrer(teinte, intensite), 'Apparence enregistrée.')

  const retablirOrigine = () =>
    executer(async () => {
      await reinitialiser()
      revenirAuTheme(null)
    }, 'Couleurs d’origine rétablies.')

  return (
    <section aria-labelledby="titre-apparence" style={carte}>
      <div>
        <h2 id="titre-apparence" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>
          Apparence
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-neutral-500)' }}>
          Choisissez la couleur principale de CopropHub ; les contrastes restent toujours lisibles. Ce réglage est personnel.
        </p>
      </div>

      {erreur && <Notification variant="error">{erreur}</Notification>}
      {succes && <Notification variant="success">{succes}</Notification>}

      <div className="grille-deux-colonnes">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <fieldset style={groupe}>
            <legend style={legende}>Style des couleurs</legend>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(
                [
                  ['classique', 'Classique', 'Les couleurs d’origine de CopropHub.'],
                  ['personnalise', 'Personnalisé', 'Votre couleur principale.'],
                ] as const
              ).map(([valeur, titre, aide]) => (
                <label key={valeur} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, color: 'var(--color-neutral-900)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="mode-theme"
                    value={valeur}
                    checked={mode === valeur}
                    onChange={() => modifier(() => setMode(valeur))}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    {titre}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-500)' }}>{aide}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode === 'personnalise' && (
            <>
              <fieldset style={groupe}>
                <legend style={legende}>Couleurs suggérées</legend>
                <div className="pastilles">
                  {PASTILLES.map((p) => (
                    <label key={p.nom} className="pastille">
                      <input
                        type="radio"
                        name="pastille-theme"
                        className="sr-only"
                        checked={teinte === p.teinte && intensite === p.intensite}
                        onChange={() =>
                          modifier(() => {
                            setTeinte(p.teinte)
                            setIntensite(p.intensite)
                          })
                        }
                      />
                      <span className="pastille-couleur" style={{ backgroundColor: genererTheme(p).primaire }} />
                      <span className="sr-only">{p.nom}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <SelecteurTeinte teinte={teinte} onChange={(t) => modifier(() => setTeinte(t))} couleurCentre={couleurCentre} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label htmlFor="intensite-theme" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-900)' }}>
                  Intensité : {intensite}
                </label>
                <input
                  id="intensite-theme"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={intensite}
                  aria-valuetext={`${intensite} sur 100`}
                  onChange={(e) => modifier(() => setIntensite(Number(e.target.value)))}
                  style={{ width: '100%', accentColor: 'var(--color-primary)' }}
                />
              </div>

              <p role="status" data-testid="ajustement" style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-500)', minHeight: 16 }}>
                {palette?.ajuste ? 'Couleur ajustée pour rester lisible.' : ''}
              </p>
            </>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <p style={{ ...legende, margin: '0 0 8px' }}>Aperçu</p>
          <ApercuTheme palette={palette} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" disabled={!modifie || envoi} onClick={() => void enregistrerChoix()}>
          Enregistrer
        </Button>
        <Button variant="secondary" disabled={!modifie || envoi} onClick={() => modifier(() => revenirAuTheme(theme))}>
          Annuler
        </Button>
        {theme && (
          <Button variant="ghost" disabled={envoi} onClick={() => void retablirOrigine()}>
            Réinitialiser le thème CopropHub
          </Button>
        )}
      </div>
    </section>
  )
}
