import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Badge from '../components/Badge.js'
import Button from '../components/Button.js'
import Notification from '../components/Notification.js'
import { agsApi } from '../api/ags.js'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'
import type { Ag, ResolutionOrdreDuJour, ResolutionResultat } from '../api/types.js'

import { MAJORITE_LABEL, STATUT_AG as STATUT_BADGE } from '../constants/statuts.js'
import { formaterDate } from '../utils/format.js'

type VoteChoice = 'OUI' | 'NON' | 'ABSTENTION'

export default function AssembleeDetail() {
  const { idAg } = useParams<{ idAg: string }>()
  const navigate = useNavigate()
  const { utilisateur } = useAuth()
  const [ag, setAg] = useState<Ag | null>(null)
  const [resolutions, setResolutions] = useState<ResolutionOrdreDuJour[]>([])
  const [resultats, setResultats] = useState<ResolutionResultat[] | null>(null)
  const [nombreInscrits, setNombreInscrits] = useState<number | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [action, setAction] = useState(false)
  const [votesEnregistres, setVotesEnregistres] = useState<Record<string, VoteChoice | 'DEJA_VOTE'>>({})

  const estCopro = utilisateur?.typeCompte === 'COPROPRIETAIRE'

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
        setNombreInscrits(res.ag.nombreInscrits)
      } else {
        setResultats(null)
      }
      // Un copropriétaire retrouve ses votes déjà exprimés (rechargement de
      // page, retour sur l'AG plus tard) au lieu de repartir d'un écran vierge.
      if (estCopro && detail.ag.statut !== 'PLANIFIEE') {
        const mes = await agsApi.mesVotes(idAg)
        setVotesEnregistres(Object.fromEntries(mes.votes.map((v) => [v.idResolution, v.valeur])))
      }
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de charger l'assemblée.")
    } finally {
      setChargement(false)
    }
  }, [idAg, estCopro])

  useEffect(() => {
    void charger()
  }, [charger])

  /** Vote (première fois) ou modification (vote déjà connu). Retourne `true` si l'état affiché est à jour. */
  async function handleVoter(idResolution: string, valeur: VoteChoice): Promise<boolean> {
    setErreur(null)
    setAction(true)
    try {
      const dejaVote = votesEnregistres[idResolution]
      if (dejaVote && dejaVote !== 'DEJA_VOTE') {
        await agsApi.modifierVote(idResolution, valeur)
      } else {
        await agsApi.voter(idResolution, valeur)
      }
      setVotesEnregistres((prev) => ({ ...prev, [idResolution]: valeur }))
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && !votesEnregistres[idResolution]) {
        setVotesEnregistres((prev) => ({ ...prev, [idResolution]: 'DEJA_VOTE' }))
        return true
      }
      setErreur(err instanceof ApiError ? err.message : 'Impossible d’enregistrer le vote.')
      return false
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
  const modeVoteCopro = !estSyndic && ag.statut === 'OUVERTE' && resolutions.length > 0

  return (
    <main style={{ maxWidth: modeVoteCopro ? 600 : 700, margin: '0 auto', padding: modeVoteCopro ? '0 0 48px' : '32px 24px 48px' }}>
      {!modeVoteCopro && (
        <button
          onClick={() => navigate('/assemblees')}
          style={{ marginBottom: 16, fontSize: 13, color: '#5C5C5C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          ← Toutes les assemblées
        </button>
      )}

      {!modeVoteCopro && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1A1A1A' }}>
            AG du {formaterDate(ag.dateAg)}
          </h1>
          <Badge {...STATUT_BADGE[ag.statut]} />
        </div>
      )}

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
        <div style={{ marginBottom: 16, padding: modeVoteCopro ? '0 16px' : 0 }}>
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
              {nombreInscrits !== null && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#5C5C5C' }}>
                  Participation : {r.decomptes.oui + r.decomptes.non + r.decomptes.abstention} votant(s) sur{' '}
                  {nombreInscrits} copropriétaire(s) inscrit(s)
                </p>
              )}
              {estCopro && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#5C5C5C', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Mon vote :
                  {votesEnregistres[r.id] ? (
                    <VoteLabel choix={votesEnregistres[r.id]} />
                  ) : (
                    <span>vous n’avez pas voté sur cette résolution</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : modeVoteCopro ? (
        <EcranVote
          ag={ag}
          resolutions={resolutions}
          votes={votesEnregistres}
          action={action}
          onVoter={handleVoter}
          onRetour={() => navigate('/assemblees')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resolutions.length === 0 && <p style={{ fontSize: 13, color: '#5C5C5C' }}>Aucune résolution.</p>}
          {resolutions.map((r) => (
            <div key={r.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 20 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{r.libelle}</h3>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: '#5C5C5C' }}>{MAJORITE_LABEL[r.typeMajorite]}</p>
              {ag.statut === 'PLANIFIEE' && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#5C5C5C' }}>Le vote n’est pas encore ouvert.</p>
              )}
              {ag.statut === 'OUVERTE' && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#5C5C5C' }}>Vote en cours parmi les copropriétaires.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

const OPTIONS_VOTE = [
  { value: 'OUI' as const, label: 'Pour', color: '#1E7A4C', bg: '#E8F5EE', border: '#A8D8BC' },
  { value: 'NON' as const, label: 'Contre', color: '#B3261E', bg: '#FDECEA', border: '#F5C6C4' },
  { value: 'ABSTENTION' as const, label: 'Abstention', color: '#5C5C5C', bg: '#F2F2F2', border: '#BDBDBD' },
]

function VoteLabel({ choix, enAttente }: { choix: VoteChoice | 'DEJA_VOTE' | undefined; enAttente?: boolean }) {
  if (enAttente) return <span style={{ fontSize: 12, color: '#BDBDBD' }}>En attente</span>
  if (!choix || choix === 'DEJA_VOTE') return <span style={{ fontSize: 12, color: '#BDBDBD' }}>—</span>
  const opt = OPTIONS_VOTE.find((o) => o.value === choix)!
  return (
    <span style={{ fontSize: 12, fontWeight: 500, color: opt.color, backgroundColor: opt.bg, padding: '2px 8px', borderRadius: 4 }}>
      {opt.label}
    </span>
  )
}

/**
 * Écran de vote copropriétaire : porté fidèlement du design proto
 * (`proto/.../VoteResolution.tsx`) — une résolution affichée à la fois,
 * barre de progression par résolution, gros boutons de vote colorés,
 * récapitulatif ; après le dernier vote, retour direct à la liste (pas
 * d'écran de confirmation intermédiaire). Données 100% réelles (aucune valeur
 * fictive : ni tantièmes, ni documents annexés, absents de notre modèle).
 */
function EcranVote({
  ag,
  resolutions,
  votes,
  action,
  onVoter,
  onRetour,
}: {
  ag: Ag
  resolutions: ResolutionOrdreDuJour[]
  votes: Record<string, VoteChoice | 'DEJA_VOTE'>
  action: boolean
  onVoter: (idResolution: string, valeur: VoteChoice) => Promise<boolean>
  onRetour: () => void
}) {
  // On reprend à la première résolution encore sans vote (0 si tout est voté).
  const [index, setIndex] = useState(() => {
    const premiereSansVote = resolutions.findIndex((r) => votes[r.id] === undefined)
    return premiereSansVote === -1 ? 0 : premiereSansVote
  })
  const [enModification, setEnModification] = useState(false)
  const resolution = resolutions[index]!
  const confirmee = votes[resolution.id] !== undefined

  useEffect(() => {
    setEnModification(false)
  }, [index])

  async function confirmer(valeur: VoteChoice) {
    const choixActuel = votes[resolution.id]
    if (choixActuel === valeur) {
      setEnModification(false) // même choix : rien à modifier côté serveur
      return
    }
    const ok = await onVoter(resolution.id, valeur)
    if (!ok) return
    if (choixActuel !== undefined) {
      setEnModification(false) // simple changement d'avis : on reste sur la résolution
      return
    }
    // Première réponse à cette résolution : on enchaîne sur la prochaine encore sans vote
    // (d'abord après celle-ci, sinon depuis le début) ; s'il n'en reste aucune, retour direct
    // à la liste des assemblées, où le badge « Voté » confirme — pas d'écran intermédiaire.
    const apres = resolutions.findIndex((r, i) => i > index && votes[r.id] === undefined)
    const cible = apres !== -1 ? apres : resolutions.findIndex((r, i) => i !== index && votes[r.id] === undefined)
    setTimeout(() => (cible !== -1 ? setIndex(cible) : onRetour()), 500)
  }

  return (
    <div>
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0E0E0', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
            Vote en ligne — AG du {formaterDate(ag.dateAg)}
          </p>
          <div style={{ display: 'flex', gap: 4 }}>
            {resolutions.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setIndex(i)}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: votes[r.id] !== undefined ? '#1E7A4C' : i === index ? '#1E4B8F' : '#E0E0E0',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#5C5C5C' }}>
            Résolution {index + 1} sur {resolutions.length}
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px 0' }}>
        {confirmee && !enModification && (
          <div style={{ marginBottom: 16 }}>
            <Notification variant="success" title="Vote enregistré">
              {votes[resolution.id] === 'DEJA_VOTE'
                ? 'Vous avez déjà voté pour cette résolution.'
                : 'Votre vote a été pris en compte pour cette résolution.'}
            </Notification>
          </div>
        )}

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, backgroundColor: '#EBF0F9', color: '#1E4B8F', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0, marginTop: 2 }}>
                RÉS. {index + 1}
              </span>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                {resolution.libelle}
              </h1>
            </div>

            <div style={{ padding: 12, backgroundColor: '#F5F6F8', borderRadius: 6, marginBottom: 16 }}>
              <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#5C5C5C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Règle de majorité
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>{MAJORITE_LABEL[resolution.typeMajorite]}</p>
            </div>
          </div>

          <div style={{ padding: '16px 20px 20px', borderTop: '1px solid #F2F2F2' }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>Mon vote</p>
            {confirmee && !enModification ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {OPTIONS_VOTE.map((opt) => {
                  const monChoix = votes[resolution.id]
                  const selected = monChoix === opt.value
                  return (
                    <div
                      key={opt.value}
                      style={{
                        padding: '14px 8px',
                        borderRadius: 8,
                        border: `2px solid ${selected ? opt.border : '#E0E0E0'}`,
                        backgroundColor: selected ? opt.bg : '#FFFFFF',
                        color: selected ? opt.color : '#5C5C5C',
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: 'center',
                        opacity: selected ? 1 : 0.4,
                      }}
                    >
                      {opt.label}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {OPTIONS_VOTE.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => void confirmer(opt.value)}
                    disabled={action}
                    style={{
                      padding: '14px 8px',
                      borderRadius: 8,
                      border: `2px solid ${enModification && votes[resolution.id] === opt.value ? opt.border : '#E0E0E0'}`,
                      backgroundColor: enModification && votes[resolution.id] === opt.value ? opt.bg : '#FFFFFF',
                      color: enModification && votes[resolution.id] === opt.value ? opt.color : '#5C5C5C',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: action ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.borderColor = opt.border
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = opt.bg
                      ;(e.currentTarget as HTMLElement).style.color = opt.color
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.borderColor = '#E0E0E0'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = '#FFFFFF'
                      ;(e.currentTarget as HTMLElement).style.color = '#5C5C5C'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            {confirmee && !enModification && (
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" fullWidth onClick={() => setEnModification(true)}>
                  Modifier mon vote
                </Button>
              </div>
            )}
            {enModification && (
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#5C5C5C' }}>
                Choisissez votre nouveau vote, ou gardez le même pour annuler la modification.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <Button variant="secondary" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            ← Précédente
          </Button>
          {index < resolutions.length - 1 && (
            <Button variant={confirmee ? 'primary' : 'secondary'} onClick={() => setIndex((i) => i + 1)}>
              Résolution suivante →
            </Button>
          )}
        </div>

        {Object.keys(votes).length > 0 && (
          <div style={{ marginTop: 24, padding: 16, backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#5C5C5C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Récapitulatif
            </p>
            {resolutions.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < resolutions.length - 1 ? '1px solid #F2F2F2' : 'none' }}>
                <span style={{ fontSize: 13, color: '#3D3D3D' }}>Résolution {i + 1}</span>
                <VoteLabel choix={votes[r.id]} enAttente={votes[r.id] === undefined} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
