import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/Badge.js'
import Button from '../components/Button.js'
import Notification from '../components/Notification.js'
import { agsApi } from '../api/ags.js'
import { incidentsApi } from '../api/incidents.js'
import { chargesApi } from '../api/charges.js'
import { ApiError } from '../api/client.js'
import type { Ag, Charge, Incident, TypeMajorite } from '../api/types.js'

const STATUT_INCIDENT_BADGE: Record<Incident['statut'], { variant: 'success' | 'warning' | 'neutral'; label: string }> = {
  DECLARE: { variant: 'neutral', label: 'Declare' },
  EN_COURS: { variant: 'warning', label: 'En cours' },
  RESOLU: { variant: 'success', label: 'Resolu' },
}

const STATUT_AG_BADGE: Record<Ag['statut'], { variant: 'neutral' | 'info' | 'success'; label: string }> = {
  PLANIFIEE: { variant: 'neutral', label: 'Planifiee' },
  OUVERTE: { variant: 'info', label: 'Vote ouvert' },
  CLOTUREE: { variant: 'success', label: 'Cloturee' },
}

interface NouvelleResolution {
  libelle: string
  typeMajorite: TypeMajorite
}

export default function DashboardSyndic() {
  const navigate = useNavigate()
  const [ags, setAgs] = useState<Ag[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  async function recharger() {
    setChargement(true)
    try {
      const [agsRep, incidentsRep, chargesRep] = await Promise.all([
        agsApi.lister(),
        incidentsApi.lister(),
        chargesApi.lister(),
      ])
      setAgs(agsRep.ags)
      setIncidents(incidentsRep.incidents)
      setCharges(chargesRep.charges)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger le tableau de bord.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    void recharger()
  }, [])

  const prochaineAg = ags.find((ag) => ag.statut !== 'CLOTUREE')
  const chargesEnRetard = charges.filter((c) => c.statut === 'EN_RETARD')
  const totalRetard = chargesEnRetard.reduce((s, c) => s + Number(c.montant), 0)
  const incidentsRecents = incidents.slice(0, 5)

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
            Tableau de bord
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: '#5C5C5C' }}>
            {chargement ? 'Chargement...' : `${ags.length} AG - ${incidents.length} incidents - ${charges.length} charges`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => navigate('/incidents')}>
            Declarer un incident
          </Button>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            Creer une AG
          </Button>
        </div>
      </div>

      {erreur && (
        <div style={{ marginBottom: 24 }}>
          <Notification variant="error">{erreur}</Notification>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Assemblees generales', value: String(ags.length), sub: `${ags.filter((a) => a.statut === 'OUVERTE').length} en vote` },
          { label: 'Incidents', value: String(incidents.length), sub: `${incidents.filter((i) => i.statut !== 'RESOLU').length} non resolus` },
          { label: 'Charges', value: String(charges.length), sub: `${charges.filter((c) => c.statut === 'A_PAYER').length} a payer` },
          {
            label: 'Charges en retard',
            value: String(chargesEnRetard.length),
            sub: `${totalRetard.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} non recouvres`,
            alert: chargesEnRetard.length > 0,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: '#FFFFFF',
              border: `1px solid ${stat.alert ? '#F5C6C4' : '#E0E0E0'}`,
              borderRadius: 8,
              padding: 24,
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#5C5C5C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {stat.label}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: stat.alert ? '#B3261E' : '#1A1A1A', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {stat.value}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#5C5C5C' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F2F2F2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Incidents recents</h2>
            <button
              onClick={() => navigate('/incidents')}
              style={{ fontSize: 13, color: '#1E4B8F', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Voir tous
            </button>
          </div>
          {incidentsRecents.length === 0 ? (
            <p style={{ padding: 24, fontSize: 13, color: '#5C5C5C', margin: 0 }}>
              {chargement ? 'Chargement...' : 'Aucun incident declare.'}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {incidentsRecents.map((inc, i) => (
                  <tr key={inc.id} style={{ borderTop: i > 0 ? '1px solid #F2F2F2' : 'none' }}>
                    <td style={{ padding: '12px 24px', fontSize: 14, color: '#1A1A1A', fontWeight: 500 }}>{inc.titre}</td>
                    <td style={{ padding: '12px 24px', fontSize: 13, color: '#5C5C5C' }}>
                      {new Date(inc.dateCreation).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '12px 24px' }}>
                      <Badge {...STATUT_INCIDENT_BADGE[inc.statut]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>
              Assemblee generale
            </h2>
            {prochaineAg ? (
              <div style={{ padding: 16, backgroundColor: '#EBF0F9', borderRadius: 6, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1E4B8F' }}>
                    {new Date(prochaineAg.dateAg).toLocaleDateString('fr-FR')}
                  </p>
                  <Badge {...STATUT_AG_BADGE[prochaineAg.statut]} />
                </div>
              </div>
            ) : (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#5C5C5C' }}>Aucune AG planifiee.</p>
            )}
            <Button variant="primary" fullWidth onClick={() => navigate('/assemblees')}>
              Gerer les AG
            </Button>
          </div>

          {chargesEnRetard.length > 0 && (
            <div style={{ backgroundColor: '#FDECEA', border: '1px solid #F5C6C4', borderRadius: 8, padding: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#B3261E' }}>
                {chargesEnRetard.length} charge{chargesEnRetard.length > 1 ? 's' : ''} en retard
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#3D3D3D' }}>
                {totalRetard.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} non recouvres.
              </p>
              <button
                onClick={() => navigate('/charges')}
                style={{ fontSize: 12, fontWeight: 600, color: '#B3261E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                Voir les charges
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreerAgModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false)
            void recharger()
          }}
        />
      )}
    </main>
  )
}

const OPTIONS_MAJORITE: { value: TypeMajorite; label: string }[] = [
  { value: 'SIMPLE', label: 'Majorite simple (art. 24)' },
  { value: 'ABSOLUE', label: 'Majorite absolue (art. 25)' },
  { value: 'DOUBLE_MAJORITE', label: 'Double majorite (art. 26)' },
  { value: 'UNANIMITE', label: 'Unanimite' },
]

function CreerAgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [dateAg, setDateAg] = useState('')
  const [resolutions, setResolutions] = useState<NouvelleResolution[]>([
    { libelle: '', typeMajorite: 'SIMPLE' },
  ])
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dateInputRef.current?.focus()
    function surEchap(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', surEchap)
    return () => window.removeEventListener('keydown', surEchap)
  }, [onClose])

  function majResolution(index: number, patch: Partial<NouvelleResolution>) {
    setResolutions((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function handleCreer() {
    setErreur(null)
    const propres = resolutions.filter((r) => r.libelle.trim().length > 0)
    if (!dateAg || propres.length === 0) {
      setErreur('La date et au moins une resolution sont requises.')
      return
    }
    setEnvoi(true)
    try {
      await agsApi.creer(dateAg, propres)
      onCreated()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de creer l’AG.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modal-creation-ag"
        style={{ backgroundColor: '#FFFFFF', borderRadius: 10, padding: 32, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titre-modal-creation-ag" style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: '#1A1A1A' }}>Creer une assemblee generale</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#5C5C5C' }}>
          L&apos;AG est creee a l&apos;etat planifiee. Vous l&apos;ouvrirez au vote depuis la liste des assemblees.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <div>
            <label htmlFor="date-ag-creation" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
              Date prevue <span style={{ color: '#B3261E' }}>*</span>
            </label>
            <input
              id="date-ag-creation"
              ref={dateInputRef}
              type="date"
              value={dateAg}
              onChange={(e) => setDateAg(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #E0E0E0', borderRadius: 6, fontFamily: 'inherit', color: '#1A1A1A', outline: 'none' }}
            />
          </div>

          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>
              Resolutions <span style={{ color: '#B3261E' }}>*</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resolutions.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <input
                    placeholder={`Resolution ${i + 1}`}
                    value={r.libelle}
                    onChange={(e) => majResolution(i, { libelle: e.target.value })}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid #E0E0E0', borderRadius: 6, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <select
                    value={r.typeMajorite}
                    onChange={(e) => majResolution(i, { typeMajorite: e.target.value as TypeMajorite })}
                    style={{ padding: '8px 8px', fontSize: 13, border: '1px solid #E0E0E0', borderRadius: 6, fontFamily: 'inherit', outline: 'none', color: '#3D3D3D' }}
                  >
                    {OPTIONS_MAJORITE.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {resolutions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setResolutions((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Retirer la resolution"
                      style={{ background: 'none', border: '1px solid #E0E0E0', borderRadius: 6, color: '#B3261E', cursor: 'pointer', padding: '0 10px' }}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setResolutions((prev) => [...prev, { libelle: '', typeMajorite: 'SIMPLE' }])}
              style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: '#1E4B8F', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              + Ajouter une resolution
            </button>
          </div>
        </div>

        {erreur && (
          <div style={{ marginBottom: 16 }}>
            <Notification variant="error">{erreur}</Notification>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={handleCreer} disabled={envoi}>
            {envoi ? 'Creation...' : 'Creer l’AG'}
          </Button>
        </div>
      </div>
    </div>
  )
}
