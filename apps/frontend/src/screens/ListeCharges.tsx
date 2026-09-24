import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Badge from '../components/Badge.js'
import Button from '../components/Button.js'
import { SelectField, TextField } from '../components/FormField.js'
import Notification from '../components/Notification.js'
import { chargesApi } from '../api/charges.js'
import { utilisateursApi } from '../api/utilisateurs.js'
import { ApiError } from '../api/client.js'
import { useAuth } from '../context/AuthContext.js'
import type { Charge, LotAvecProprietaire } from '../api/types.js'
import { STATUT_CHARGE as STATUT_MAP } from '../constants/statuts.js'
import { formaterDate, formaterMontant as fmt } from '../utils/format.js'

export default function ListeCharges() {
  const [charges, setCharges] = useState<Charge[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const { utilisateur } = useAuth()
  const estSyndic = utilisateur?.typeCompte === 'SYNDIC'
  const [lots, setLots] = useState<LotAvecProprietaire[]>([])
  const [succes, setSucces] = useState<string | null>(null)
  const [action, setAction] = useState(false)
  const [idLot, setIdLot] = useState('')
  const [montant, setMontant] = useState('')
  const [periode, setPeriode] = useState('')
  const [echeance, setEcheance] = useState('')

  const charger = useCallback(async () => {
    try {
      const r = await chargesApi.lister()
      setCharges(r.charges)
      if (estSyndic) setLots((await utilisateursApi.listerLots()).lots)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les charges.')
    } finally {
      setChargement(false)
    }
  }, [estSyndic])

  useEffect(() => {
    void charger()
  }, [charger])

  async function executer(operation: () => Promise<unknown>, message: string) {
    setErreur(null)
    setSucces(null)
    setAction(true)
    try {
      await operation()
      setSucces(message)
      await charger()
      return true
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'L’opération a échoué.')
      return false
    } finally {
      setAction(false)
    }
  }

  async function creerCharge(e: FormEvent) {
    e.preventDefault()
    const ok = await executer(() => chargesApi.creer(idLot, montant, periode, echeance || undefined), 'Charge créée.')
    if (ok) {
      setMontant('')
      setPeriode('')
      setEcheance('')
    }
  }

  const numeroLot = (id: string) => lots.find((l) => l.id === id)?.numero ?? '—'

  const filtered = filterStatut === 'tous' ? charges : charges.filter((c) => c.statut === filterStatut)
  const total = charges.reduce((s, c) => s + Number(c.montant), 0)
  const totalPaye = charges.filter((c) => c.statut === 'PAYEE').reduce((s, c) => s + Number(c.montant), 0)
  const totalRetard = charges.filter((c) => c.statut === 'EN_RETARD').reduce((s, c) => s + Number(c.montant), 0)
  const tauxRecouvrement = total > 0 ? Math.round((totalPaye / total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F6F8' }}>
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E0E0E0', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h1 style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.01em' }}>
            Charges
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#5C5C5C' }}>{charges.length} ligne(s) de charge</p>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
        {erreur && (
          <div style={{ marginBottom: 16 }}>
            <Notification variant="error">{erreur}</Notification>
          </div>
        )}

        {succes && (
          <div style={{ marginBottom: 16 }}>
            <Notification variant="success">{succes}</Notification>
          </div>
        )}

        {estSyndic && (
          <form
            onSubmit={creerCharge}
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 20, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 12, alignItems: 'end' }}
          >
            <SelectField label="Lot" required value={idLot} onChange={(e) => setIdLot(e.target.value)}>
              <option value="">Choisir…</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {`Lot ${l.numero}${l.proprietaire ? ` — ${l.proprietaire.nom}` : ''}`}
                </option>
              ))}
            </SelectField>
            <TextField label="Montant (€)" required inputMode="decimal" placeholder="150.00" value={montant} onChange={(e) => setMontant(e.target.value)} />
            <TextField label="Période" required placeholder="2026-T4" value={periode} onChange={(e) => setPeriode(e.target.value)} />
            <TextField label="Échéance" type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
            <Button type="submit" variant="primary" disabled={action}>
              Ajouter la charge
            </Button>
          </form>
        )}

        {charges.length > 0 && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total', value: fmt(total), color: '#1A1A1A' },
                { label: 'Recouvré', value: fmt(totalPaye), color: '#1E7A4C' },
                { label: 'En retard', value: fmt(totalRetard), color: '#B3261E' },
              ].map((kpi) => (
                <div key={kpi.label} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, padding: 20 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: '#5C5C5C', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {kpi.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E0E0E0',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', whiteSpace: 'nowrap' }}>Taux de recouvrement</span>
              <div style={{ flex: 1, height: 8, backgroundColor: '#F2F2F2', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${tauxRecouvrement}%`,
                    height: '100%',
                    backgroundColor: tauxRecouvrement >= 80 ? '#1E7A4C' : tauxRecouvrement >= 60 ? '#A15C00' : '#B3261E',
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{tauxRecouvrement} %</span>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[
                { key: 'tous', label: 'Tous' },
                { key: 'A_PAYER', label: 'À payer' },
                { key: 'EN_RETARD', label: 'En retard' },
                { key: 'PAYEE', label: 'Payée' },
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
          </>
        )}

        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8, overflow: 'hidden' }}>
          {chargement ? (
            <p style={{ padding: 24, fontSize: 13, color: '#5C5C5C', margin: 0 }}>Chargement…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 24, fontSize: 13, color: '#5C5C5C', margin: 0 }}>Aucune charge.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F5F6F8', borderBottom: '1px solid #E0E0E0' }}>
                  {[...(estSyndic ? ['Lot'] : []), 'Période', 'Montant', 'Échéance', 'Statut', ...(estSyndic ? [''] : [])].map((col, index) => (
                    <th
                      key={`${col}-${index}`}
                      style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#5C5C5C', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((charge, i) => (
                  <tr key={charge.id} style={{ borderTop: i > 0 ? '1px solid #F2F2F2' : 'none' }}>
                    {estSyndic && (
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{numeroLot(charge.idLot)}</td>
                    )}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#5C5C5C' }}>{charge.periode}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                      {fmt(Number(charge.montant))}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#5C5C5C' }}>
                      {charge.dateEcheance ? formaterDate(charge.dateEcheance) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge {...STATUT_MAP[charge.statut]} />
                    </td>
                    {estSyndic && (
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {charge.statut !== 'PAYEE' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={action}
                            onClick={() => void executer(() => chargesApi.marquerPayee(charge.id), 'Charge marquée payée.')}
                          >
                            Marquer payée
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
