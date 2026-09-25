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

import { STATUT_AG as STATUT_AG_BADGE, STATUT_INCIDENT as STATUT_INCIDENT_BADGE } from '../constants/statuts.js'
import { formaterDate, formaterMontant } from '../utils/format.js'

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
            Tableau de bord
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-500)' }}>
            {chargement ? 'Chargement…' : `${ags.length} AG · ${incidents.length} incidents · ${charges.length} charges`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={() => navigate('/incidents')}>
            Déclarer un incident
          </Button>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            Créer une AG
          </Button>
        </div>
      </div>

      {erreur && (
        <div style={{ marginBottom: 24 }}>
          <Notification variant="error">{erreur}</Notification>
        </div>
      )}

      <div className="grille-stats" style={{ marginBottom: 32 }}>
        {[
          { label: 'Assemblées générales', value: String(ags.length), sub: `${ags.filter((a) => a.statut === 'OUVERTE').length} en vote` },
          { label: 'Incidents', value: String(incidents.length), sub: `${incidents.filter((i) => i.statut !== 'RESOLU').length} non résolus` },
          { label: 'Charges', value: String(charges.length), sub: `${charges.filter((c) => c.statut === 'A_PAYER').length} à payer` },
          {
            label: 'Charges en retard',
            value: String(chargesEnRetard.length),
            sub: `${formaterMontant(totalRetard)} non recouvrés`,
            alert: chargesEnRetard.length > 0,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${stat.alert ? 'var(--color-danger-border)' : 'var(--color-neutral-200)'}`,
              borderRadius: 8,
              padding: 24,
            }}
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: 'var(--color-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {stat.label}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: stat.alert ? 'var(--color-danger)' : 'var(--color-neutral-900)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {stat.value}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-500)' }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grille-tableau-de-bord">
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, overflowX: 'auto' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Incidents récents</h2>
            <button
              onClick={() => navigate('/incidents')}
              style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
            >
              Voir tous
            </button>
          </div>
          {incidentsRecents.length === 0 ? (
            <p style={{ padding: 24, fontSize: 13, color: 'var(--color-neutral-500)', margin: 0 }}>
              {chargement ? 'Chargement…' : 'Aucun incident déclaré.'}
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {incidentsRecents.map((inc, i) => (
                  <tr key={inc.id} style={{ borderTop: i > 0 ? '1px solid var(--color-neutral-100)' : 'none' }}>
                    <td style={{ padding: '12px 24px', fontSize: 14, color: 'var(--color-neutral-900)', fontWeight: 500 }}>{inc.titre}</td>
                    <td style={{ padding: '12px 24px', fontSize: 13, color: 'var(--color-neutral-500)' }}>
                      {formaterDate(inc.dateCreation)}
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
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: 24 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>
              Assemblée générale
            </h2>
            {prochaineAg ? (
              <div style={{ padding: 16, backgroundColor: 'var(--color-primary-light)', borderRadius: 6, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
                    {formaterDate(prochaineAg.dateAg)}
                  </p>
                  <Badge {...STATUT_AG_BADGE[prochaineAg.statut]} />
                </div>
              </div>
            ) : (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-neutral-500)' }}>Aucune AG planifiée.</p>
            )}
            <Button variant="primary" fullWidth onClick={() => navigate('/assemblees')}>
              Gérer les AG
            </Button>
          </div>

          {chargesEnRetard.length > 0 && (
            <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', borderRadius: 8, padding: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
                {chargesEnRetard.length} charge{chargesEnRetard.length > 1 ? 's' : ''} en retard
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-neutral-700)' }}>
                {formaterMontant(totalRetard)} non recouvrés.
              </p>
              <button
                onClick={() => navigate('/charges')}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
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
  { value: 'SIMPLE', label: 'Majorité simple (art. 24)' },
  { value: 'ABSOLUE', label: 'Majorité absolue (art. 25)' },
  { value: 'DOUBLE_MAJORITE', label: 'Double majorité (art. 26)' },
  { value: 'UNANIMITE', label: 'Unanimité' },
]

function CreerAgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [dateAg, setDateAg] = useState('')
  const [resolutions, setResolutions] = useState<NouvelleResolution[]>([
    { libelle: '', typeMajorite: 'SIMPLE' },
  ])
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const boiteRef = useRef<HTMLDivElement>(null)
  const surFermeture = useRef(onClose)
  surFermeture.current = onClose

  // Accessibilité de la boîte de dialogue : focus à l'ouverture, Échap pour fermer, Tab qui reste
  // dans la boîte, et focus rendu au bouton d'origine à la fermeture.
  useEffect(() => {
    const declencheur = document.activeElement as HTMLElement | null
    dateInputRef.current?.focus()
    function surTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        surFermeture.current()
        return
      }
      if (e.key !== 'Tab' || !boiteRef.current) return
      const focalisables = boiteRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input, select, textarea, a[href]',
      )
      if (focalisables.length === 0) return
      const premier = focalisables[0]
      const dernier = focalisables[focalisables.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }
    window.addEventListener('keydown', surTouche)
    return () => {
      window.removeEventListener('keydown', surTouche)
      declencheur?.focus?.()
    }
  }, [])

  function majResolution(index: number, patch: Partial<NouvelleResolution>) {
    setResolutions((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  async function handleCreer() {
    setErreur(null)
    const propres = resolutions.filter((r) => r.libelle.trim().length > 0)
    if (!dateAg || propres.length === 0) {
      setErreur('La date et au moins une résolution sont requises.')
      return
    }
    setEnvoi(true)
    try {
      await agsApi.creer(dateAg, propres)
      onCreated()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de créer l’AG.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--color-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        ref={boiteRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-modal-creation-ag"
        style={{ backgroundColor: 'var(--color-surface)', borderRadius: 10, padding: 32, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titre-modal-creation-ag" style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Créer une assemblée générale</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-neutral-500)' }}>
          L&apos;AG est créée à l&apos;état planifiée. Vous l&apos;ouvrirez au vote depuis la liste des assemblées.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <div>
            <label htmlFor="date-ag-creation" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-900)', marginBottom: 4 }}>
              Date prévue <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="date-ag-creation"
              ref={dateInputRef}
              type="date"
              value={dateAg}
              onChange={(e) => setDateAg(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid var(--color-neutral-200)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--color-neutral-900)' }}
            />
          </div>

          <div>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-900)' }}>
              Résolutions <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {resolutions.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <input
                    aria-label={`Libellé de la résolution ${i + 1}`}
                    placeholder={`Résolution ${i + 1}`}
                    value={r.libelle}
                    onChange={(e) => majResolution(i, { libelle: e.target.value })}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 14, border: '1px solid var(--color-neutral-200)', borderRadius: 6, fontFamily: 'inherit' }}
                  />
                  <select
                    aria-label={`Type de majorité de la résolution ${i + 1}`}
                    value={r.typeMajorite}
                    onChange={(e) => majResolution(i, { typeMajorite: e.target.value as TypeMajorite })}
                    style={{ padding: '8px 8px', fontSize: 13, border: '1px solid var(--color-neutral-200)', borderRadius: 6, fontFamily: 'inherit', color: 'var(--color-neutral-700)' }}
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
                      aria-label={`Retirer la résolution ${i + 1}`}
                      style={{ background: 'none', border: '1px solid var(--color-neutral-200)', borderRadius: 6, color: 'var(--color-danger)', cursor: 'pointer', padding: '0 10px' }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setResolutions((prev) => [...prev, { libelle: '', typeMajorite: 'SIMPLE' }])}
              style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
            >
              + Ajouter une résolution
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
            {envoi ? 'Création…' : 'Créer l’AG'}
          </Button>
        </div>
      </div>
    </div>
  )
}
