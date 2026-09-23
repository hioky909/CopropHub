import { useEffect, useState } from 'react'
import Badge from '../components/Badge.js'
import Button from '../components/Button.js'
import { SelectField, TextareaField, TextField } from '../components/FormField.js'
import Notification from '../components/Notification.js'
import { incidentsApi } from '../api/incidents.js'
import { lotsApi } from '../api/lots.js'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'
import type { Incident, Lot } from '../api/types.js'
import { STATUT_INCIDENT as STATUT_MAP } from '../constants/statuts.js'
import { formaterDate } from '../utils/format.js'

const PROCHAIN_STATUT: Partial<Record<Incident['statut'], 'EN_COURS' | 'RESOLU'>> = {
  DECLARE: 'EN_COURS',
  EN_COURS: 'RESOLU',
}

export default function ListeIncidents() {
  const { utilisateur } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [lots, setLots] = useState<Lot[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [success, setSuccess] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState(false)
  const [form, setForm] = useState({ titre: '', idLot: '', description: '' })

  const estCopro = utilisateur?.typeCompte === 'COPROPRIETAIRE'
  const estSyndic = utilisateur?.typeCompte === 'SYNDIC'

  async function recharger() {
    setChargement(true)
    try {
      const [incidentsRep, lotsRep] = await Promise.all([
        incidentsApi.lister(),
        estCopro ? lotsApi.mesLots() : Promise.resolve({ lots: [] }),
      ])
      setIncidents(incidentsRep.incidents)
      setLots(lotsRep.lots)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les incidents.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    void recharger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = filterStatut === 'tous' ? incidents : incidents.filter((i) => i.statut === filterStatut)

  function validateForm() {
    const errors: Record<string, string> = {}
    if (!form.titre.trim()) errors.titre = 'Le titre est obligatoire.'
    return errors
  }

  async function handleSubmit() {
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setEnvoi(true)
    setErreur(null)
    try {
      await incidentsApi.declarer({
        titre: form.titre,
        description: form.description.trim() ? form.description : undefined,
        idLot: form.idLot || undefined,
      })
      setSuccess(true)
      setShowForm(false)
      setForm({ titre: '', idLot: '', description: '' })
      setFormErrors({})
      await recharger()
      setTimeout(() => setSuccess(false), 5000)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible d'enregistrer le signalement.")
    } finally {
      setEnvoi(false)
    }
  }

  async function handleTransition(incident: Incident) {
    const cible = PROCHAIN_STATUT[incident.statut]
    if (!cible) return
    setErreur(null)
    try {
      await incidentsApi.transitionner(incident.id, cible)
      await recharger()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de changer le statut.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F6F8' }}>
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0E0E0', padding: '16px 16px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
                Incidents
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>{incidents.length} incident(s) enregistré(s)</p>
            </div>
            {estCopro && (
              <Button variant="primary" onClick={() => setShowForm(true)}>
                Déclarer un incident
              </Button>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        {success && (
          <div style={{ marginBottom: 16 }}>
            <Notification variant="success" title="Incident déclaré" onDismiss={() => setSuccess(false)}>
              Votre signalement a bien été enregistré.
            </Notification>
          </div>
        )}
        {erreur && (
          <div style={{ marginBottom: 16 }}>
            <Notification variant="error">{erreur}</Notification>
          </div>
        )}

        {showForm && (
          <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: '#1A1A1A' }}>Déclarer un incident</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#5C5C5C' }}>
              Votre signalement sera transmis au syndic.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <TextField
                label="Titre de l'incident"
                placeholder="Ex. : Fuite d'eau dans le couloir du 2e étage"
                value={form.titre}
                onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                error={formErrors.titre}
                required
              />
              <SelectField
                label="Lieu concerné"
                value={form.idLot}
                onChange={(e) => setForm((f) => ({ ...f, idLot: e.target.value }))}
              >
                <option value="">Partie commune</option>
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    Mon lot {lot.numero} ({lot.typeLot})
                  </option>
                ))}
              </SelectField>
              <TextareaField
                label="Description"
                placeholder="Décrivez l'incident : localisation exacte, symptômes observés, depuis quand…"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button variant="primary" onClick={handleSubmit} disabled={envoi}>
                {envoi ? 'Envoi…' : 'Envoyer le signalement'}
              </Button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'tous', label: 'Tous' },
            { key: 'DECLARE', label: 'Déclaré' },
            { key: 'EN_COURS', label: 'En cours' },
            { key: 'RESOLU', label: 'Résolu' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatut(f.key)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: filterStatut === f.key ? 600 : 400,
                color: filterStatut === f.key ? '#1E4B8F' : '#5C5C5C',
                backgroundColor: filterStatut === f.key ? '#EBF0F9' : '#FFFFFF',
                border: `1px solid ${filterStatut === f.key ? '#B3C8E8' : '#E0E0E0'}`,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
          {chargement ? (
            <p style={{ padding: 24, fontSize: 13, color: '#5C5C5C', margin: 0 }}>Chargement…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 24, fontSize: 13, color: '#5C5C5C', margin: 0 }}>Aucun incident.</p>
          ) : (
            filtered.map((inc, i) => {
              const s = STATUT_MAP[inc.statut]
              const cible = PROCHAIN_STATUT[inc.statut]
              return (
                <div
                  key={inc.id}
                  data-testid={`incident-${inc.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '12px 16px',
                    borderTop: i > 0 ? '1px solid #F2F2F2' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>{inc.titre}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#5C5C5C' }}>
                      {formaterDate(inc.dateCreation)} · {inc.idLot ? 'Lot' : 'Partie commune'}
                    </p>
                  </div>
                  <Badge {...s} />
                  {estSyndic && cible && (
                    <button
                      onClick={() => handleTransition(inc)}
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#1E4B8F',
                        background: 'none',
                        border: '1px solid #B3C8E8',
                        borderRadius: 4,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Passer à « {STATUT_MAP[cible].label} »
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
