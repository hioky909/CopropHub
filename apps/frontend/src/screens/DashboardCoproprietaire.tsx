import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/Badge.js'
import Button from '../components/Button.js'
import Notification from '../components/Notification.js'
import { agsApi } from '../api/ags.js'
import { incidentsApi } from '../api/incidents.js'
import { chargesApi } from '../api/charges.js'
import { ApiError } from '../api/client.js'
import type { Ag, Charge, Incident } from '../api/types.js'
import { STATUT_AG as STATUT_AG_BADGE, STATUT_INCIDENT as STATUT_INCIDENT_BADGE } from '../constants/statuts.js'
import { formaterDate, formaterMontant } from '../utils/format.js'

/**
 * Tableau de bord copropriétaire — vue d'ensemble équivalente à celle du syndic (`DashboardSyndic.tsx`),
 * mais sur SES données uniquement. Réutilise trois endpoints déjà existants et déjà scellés côté
 * serveur (RM-10, RM-06/07, incidents « les siens + parties communes ») : aucun changement backend,
 * aucune nouvelle règle d'autorisation à écrire. Remplace la redirection directe vers /charges.
 */
export default function DashboardCoproprietaire() {
  const navigate = useNavigate()
  const [ags, setAgs] = useState<Ag[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

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

  const agsOuvertes = ags.filter((ag) => ag.statut === 'OUVERTE')
  const prochaineAg = agsOuvertes[0] ?? ags.find((ag) => ag.statut === 'PLANIFIEE')
  const chargesAPayer = charges.filter((c) => c.statut === 'A_PAYER')
  const chargesEnRetard = charges.filter((c) => c.statut === 'EN_RETARD')
  const totalRetard = chargesEnRetard.reduce((s, c) => s + Number(c.montant), 0)
  const incidentsEnCours = incidents.filter((i) => i.statut !== 'RESOLU')
  const incidentsRecents = incidents.slice(0, 5)

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
            Tableau de bord
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-500)' }}>
            {chargement ? 'Chargement…' : `${ags.length} AG · ${incidents.length} incident${incidents.length > 1 ? 's' : ''} · ${charges.length} charge${charges.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/incidents')}>
          Déclarer un incident
        </Button>
      </div>

      {erreur && (
        <div style={{ marginBottom: 24 }}>
          <Notification variant="error">{erreur}</Notification>
        </div>
      )}

      <div className="grille-stats" style={{ marginBottom: 32 }}>
        {[
          { label: 'Assemblées en vote', value: String(agsOuvertes.length) },
          { label: 'Mes incidents en cours', value: String(incidentsEnCours.length) },
          { label: 'Mes charges à payer', value: String(chargesAPayer.length) },
          {
            label: 'Mes charges en retard',
            value: String(chargesEnRetard.length),
            sub: chargesEnRetard.length > 0 ? `${formaterMontant(totalRetard)} non payés` : undefined,
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
            {stat.sub && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-500)' }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grille-tableau-de-bord">
        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, overflowX: 'auto' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Mes incidents récents</h2>
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
                {prochaineAg.statut === 'OUVERTE' && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--color-primary)' }}>Le vote est ouvert.</p>
                )}
              </div>
            ) : (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-neutral-500)' }}>Aucune AG à venir.</p>
            )}
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(prochaineAg ? `/assemblees/${prochaineAg.id}` : '/assemblees')}
            >
              {prochaineAg?.statut === 'OUVERTE' ? 'Voter' : 'Voir les assemblées'}
            </Button>
          </div>

          {chargesEnRetard.length > 0 && (
            <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', borderRadius: 8, padding: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
                {chargesEnRetard.length} charge{chargesEnRetard.length > 1 ? 's' : ''} en retard
              </p>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-neutral-700)' }}>
                {formaterMontant(totalRetard)} non payés.
              </p>
              <button
                onClick={() => navigate('/charges')}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                Voir mes charges
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
