import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/Badge.js'
import Notification from '../components/Notification.js'
import { agsApi } from '../api/ags.js'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'
import type { Ag } from '../api/types.js'
import { STATUT_AG as STATUT_BADGE } from '../constants/statuts.js'
import { formaterDateLongue, partiesDate } from '../utils/format.js'

const FILTRES: { cle: 'tous' | Ag['statut']; libelle: string }[] = [
  { cle: 'tous', libelle: 'Toutes' },
  { cle: 'PLANIFIEE', libelle: 'À venir' },
  { cle: 'OUVERTE', libelle: 'Vote ouvert' },
  { cle: 'CLOTUREE', libelle: 'Clôturées' },
]

export default function Assemblees() {
  const navigate = useNavigate()
  const { utilisateur } = useAuth()
  const estSyndic = utilisateur?.typeCompte === 'SYNDIC'
  const [ags, setAgs] = useState<Ag[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [dejaVotees, setDejaVotees] = useState<Set<string>>(new Set())
  const [filtre, setFiltre] = useState<'tous' | Ag['statut']>('tous')
  const [survol, setSurvol] = useState<string | null>(null)

  useEffect(() => {
    async function charger() {
      try {
        const r = await agsApi.lister()
        if (utilisateur?.typeCompte === 'COPROPRIETAIRE') {
          // Comme dans le proto (VoteResolution.tsx) : un copropriétaire est
          // envoyé directement sur l'AG en cours de vote — mais seulement
          // tant qu'il lui reste des résolutions à voter. Une AG déjà
          // entièrement votée n'y est plus poussée : elle reste accessible
          // depuis la liste (consultation, et modification tant qu'elle est ouverte).
          const etats = await Promise.all(
            r.ags
              .filter((ag) => ag.statut === 'OUVERTE')
              .map(async (ag) => {
                const [detail, mes] = await Promise.all([agsApi.ordreDuJour(ag.id), agsApi.mesVotes(ag.id)])
                const votees = new Set(mes.votes.map((v) => v.idResolution))
                return { id: ag.id, toutVote: detail.resolutions.every((res) => votees.has(res.id)) }
              }),
          )
          const aVoter = etats.find((e) => !e.toutVote)
          if (aVoter) {
            navigate(`/assemblees/${aVoter.id}`, { replace: true })
            return
          }
          setDejaVotees(new Set(etats.map((e) => e.id)))
        }
        setAgs(r.ags)
      } catch (err) {
        setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les assemblées.')
      } finally {
        setChargement(false)
      }
    }
    void charger()
  }, [navigate, utilisateur])

  const visibles = filtre === 'tous' ? ags : ags.filter((ag) => ag.statut === filtre)
  const compte = (cle: 'tous' | Ag['statut']) => (cle === 'tous' ? ags.length : ags.filter((ag) => ag.statut === cle).length)

  function description(ag: Ag): string {
    if (ag.statut === 'PLANIFIEE') return 'Le vote n’est pas encore ouvert'
    if (ag.statut === 'CLOTUREE') return 'Résultats disponibles'
    if (estSyndic) return 'Vote en cours parmi les copropriétaires'
    return dejaVotees.has(ag.id)
      ? 'Vous avez voté sur toutes les résolutions — modifiable tant que le vote est ouvert'
      : 'Le vote est ouvert'
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
        Assemblées générales
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#5C5C5C' }}>
        {estSyndic
          ? 'Ouvrez le vote, suivez-le et clôturez chaque assemblée pour figer ses résultats.'
          : 'Consultez ou modifiez votre vote tant qu’une assemblée est ouverte, et retrouvez les résultats des assemblées clôturées.'}
      </p>

      {erreur && (
        <div style={{ marginBottom: 16 }}>
          <Notification variant="error">{erreur}</Notification>
        </div>
      )}

      {!chargement && ags.length > 0 && (
        <div role="group" aria-label="Filtrer par statut" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {FILTRES.map((f) => {
            const actif = filtre === f.cle
            return (
              <button
                key={f.cle}
                onClick={() => setFiltre(f.cle)}
                aria-pressed={actif}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: actif ? 600 : 400,
                  color: actif ? '#1E4B8F' : '#5C5C5C',
                  backgroundColor: actif ? '#EBF0F9' : '#FFFFFF',
                  border: `1px solid ${actif ? '#B3C8E8' : '#E0E0E0'}`,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.1s',
                }}
              >
                {f.libelle}
                <span
                  style={{
                    fontSize: 11,
                    backgroundColor: actif ? '#1E4B8F' : '#F2F2F2',
                    color: actif ? '#FFFFFF' : '#5C5C5C',
                    borderRadius: 10,
                    padding: '1px 6px',
                    fontWeight: 600,
                  }}
                >
                  {compte(f.cle)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {chargement ? (
        <p style={{ fontSize: 13, color: '#5C5C5C', margin: 0 }}>Chargement…</p>
      ) : ags.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>Aucune assemblée générale.</p>
        </div>
      ) : visibles.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>Aucune assemblée dans cette catégorie.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {visibles.map((ag) => {
            const { jour, mois } = partiesDate(ag.dateAg)
            const cloturee = ag.statut === 'CLOTUREE'
            const actif = survol === ag.id
            return (
              <li key={ag.id}>
                <button
                  onClick={() => navigate(`/assemblees/${ag.id}`)}
                  onMouseEnter={() => setSurvol(ag.id)}
                  onMouseLeave={() => setSurvol(null)}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    width: '100%',
                    alignItems: 'center',
                    gap: 16,
                    padding: 20,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    backgroundColor: '#FFFFFF',
                    border: `1px solid ${actif ? '#B3C8E8' : '#E0E0E0'}`,
                    borderRadius: 8,
                    boxShadow: actif ? '0 2px 8px rgba(30,75,143,0.08)' : 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      backgroundColor: cloturee ? '#F2F2F2' : '#EBF0F9',
                      color: cloturee ? '#5C5C5C' : '#1E4B8F',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1.1,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{mois}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{jour}</span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
                      Assemblée générale du {formaterDateLongue(ag.dateAg)}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>
                      {ag.nombreResolutions !== undefined &&
                        `${ag.nombreResolutions} résolution${ag.nombreResolutions > 1 ? 's' : ''} · `}
                      {description(ag)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {dejaVotees.has(ag.id) && <Badge variant="success" label="Voté" />}
                    <Badge {...STATUT_BADGE[ag.statut]} />
                    <span aria-hidden="true" style={{ fontSize: 20, color: actif ? '#1E4B8F' : '#BDBDBD', marginLeft: 4 }}>
                      ›
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
