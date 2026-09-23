import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Badge from '../components/Badge.js'
import Button from '../components/Button.js'
import Notification from '../components/Notification.js'
import { agsApi } from '../api/ags.js'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'
import type { Ag, ResolutionOrdreDuJour, ResolutionResultat } from '../api/types.js'

const MAJORITE_LABEL: Record<string, string> = {
  SIMPLE: 'Majorité simple (art. 24)',
  ABSOLUE: 'Majorité absolue (art. 25)',
  DOUBLE_MAJORITE: 'Double majorité (art. 26)',
  UNANIMITE: 'Unanimité',
}

const STATUT_BADGE: Record<Ag['statut'], { variant: 'neutral' | 'info' | 'success'; label: string }> = {
  PLANIFIEE: { variant: 'neutral', label: 'Planifiée' },
  OUVERTE: { variant: 'info', label: 'Vote ouvert' },
  CLOTUREE: { variant: 'success', label: 'Clôturée' },
}

type VoteChoice = 'OUI' | 'NON' | 'ABSTENTION'

export default function AssembleeDetail() {
  const { idAg } = useParams<{ idAg: string }>()
  const navigate = useNavigate()
  const { utilisateur } = useAuth()
  const [ag, setAg] = useState<Ag | null>(null)
  const [resolutions, setResolutions] = useState<ResolutionOrdreDuJour[]>([])
  const [resultats, setResultats] = useState<ResolutionResultat[] | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [action, setAction] = useState(false)
  const [votesEnregistres, setVotesEnregistres] = useState<Record<string, VoteChoice | 'DEJA_VOTE'>>({})

  const charger = useCallback(async () => {
    if (!idAg) return
    setChargement(true)
    setErreur(null)
    try {
      const detail = await agsApi.ordreDuJour(idAg)
      setAg(detail.ag)
      setResolutions(detail.resolutions)
      if (detail.ag.statut === 'CLOTUREE') {
        const res = await agsApi.resultats(idAg)
        setResultats(res.resolutions)
      } else {
        setResultats(null)
      }
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de charger l'assemblée.")
    } finally {
      setChargement(false)
    }
  }, [idAg])

  useEffect(() => {
    void charger()
  }, [charger])

  async function handleVoter(idResolution: string, valeur: VoteChoice) {
    setErreur(null)
    setAction(true)
    try {
      await agsApi.voter(idResolution, valeur)
      setVotesEnregistres((prev) => ({ ...prev, [idResolution]: valeur }))
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setVotesEnregistres((prev) => ({ ...prev, [idResolution]: 'DEJA_VOTE' }))
      } else {
        setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer le vote.')
      }
    } finally {
      setAction(false)
    }
  }

  async function handleOuvrir() {
    if (!idAg) return
    setAction(true)
    setErreur(null)
    try {
      await agsApi.ouvrir(idAg)
      await charger()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible d'ouvrir le vote.")
    } finally {
      setAction(false)
    }
  }

  async function handleCloturer() {
    if (!idAg) return
    setAction(true)
    setErreur(null)
    try {
      await agsApi.cloturer(idAg)
      await charger()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de clôturer.')
    } finally {
      setAction(false)
    }
  }

  if (chargement) {
    return <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>Chargement…</main>
  }

  if (!ag) {
    return (
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px' }}>
        <Notification variant="error">{erreur ?? 'Assemblée introuvable.'}</Notification>
      </main>
    )
  }

  const estSyndic = utilisateur?.typeCompte === 'SYNDIC'

  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '32px 24px 48px' }}>
      <button
        onClick={() => navigate('/assemblees')}
        style={{ marginBottom: 16, fontSize: 13, color: '#5C5C5C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        ← Toutes les assemblées
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>
          AG du {new Date(ag.dateAg).toLocaleDateString('fr-FR')}
        </h1>
        <Badge {...STATUT_BADGE[ag.statut]} />
      </div>

      {estSyndic && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {ag.statut === 'PLANIFIEE' && (
            <Button variant="primary" onClick={handleOuvrir} disabled={action}>
              Ouvrir le vote
            </Button>
          )}
          {ag.statut === 'OUVERTE' && (
            <Button variant="destructive" onClick={handleCloturer} disabled={action}>
              Clôturer l’AG
            </Button>
          )}
        </div>
      )}

      {erreur && (
        <div style={{ marginBottom: 16 }}>
          <Notification variant="error">{erreur}</Notification>
        </div>
      )}

      {ag.statut === 'CLOTUREE' && resultats ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resultats.map((r) => (
            <div key={r.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{r.libelle}</h3>
                <Badge
                  variant={r.statutResultat === 'ADOPTEE' ? 'success' : 'danger'}
                  label={r.statutResultat === 'ADOPTEE' ? 'Adoptée' : 'Rejetée'}
                />
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#5C5C5C' }}>{MAJORITE_LABEL[r.typeMajorite]}</p>
              <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ color: '#1E7A4C', fontWeight: 600 }}>Oui : {r.decomptes.oui}</span>
                <span style={{ color: '#B3261E', fontWeight: 600 }}>Non : {r.decomptes.non}</span>
                <span style={{ color: '#5C5C5C', fontWeight: 600 }}>Abstention : {r.decomptes.abstention}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resolutions.length === 0 && <p style={{ fontSize: 13, color: '#5C5C5C' }}>Aucune résolution.</p>}
          {resolutions.map((r) => {
            const monVote = votesEnregistres[r.id]
            return (
              <div key={r.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 20 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{r.libelle}</h3>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#5C5C5C' }}>{MAJORITE_LABEL[r.typeMajorite]}</p>

                {!estSyndic && ag.statut === 'OUVERTE' && (
                  monVote ? (
                    <Notification variant="success">
                      {monVote === 'DEJA_VOTE'
                        ? 'Vous avez déjà voté pour cette résolution.'
                        : `Vote enregistré : ${monVote === 'OUI' ? 'Pour' : monVote === 'NON' ? 'Contre' : 'Abstention'}.`}
                    </Notification>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {(
                        [
                          { value: 'OUI' as const, label: 'Pour' },
                          { value: 'NON' as const, label: 'Contre' },
                          { value: 'ABSTENTION' as const, label: 'Abstention' },
                        ]
                      ).map((opt) => (
                        <Button key={opt.value} variant="secondary" disabled={action} onClick={() => handleVoter(r.id, opt.value)}>
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  )
                )}
                {ag.statut === 'PLANIFIEE' && (
                  <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>Le vote n’est pas encore ouvert.</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
