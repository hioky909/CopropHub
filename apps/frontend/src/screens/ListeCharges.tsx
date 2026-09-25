import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Badge from '../components/Badge.js'
import Button from '../components/Button.js'
import { SelectField, TextField } from '../components/FormField.js'
import BoutonTelechargement from '../components/BoutonTelechargement.js'
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
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
            Charges
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-500)' }}>{charges.length} ligne(s) de charge</p>
        </div>
        <BoutonTelechargement libelle="Exporter en PDF" onTelecharger={() => chargesApi.relevePdf()} />
      </div>

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
            className="formulaire-charge"
            style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: 20, marginBottom: 24 }}
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
            <div className="grille-trois-kpi" style={{ marginBottom: 24 }}>
              {[
                { label: 'Total', value: fmt(total), color: 'var(--color-neutral-900)' },
                { label: 'Recouvré', value: fmt(totalPaye), color: 'var(--color-success)' },
                { label: 'En retard', value: fmt(totalRetard), color: 'var(--color-danger)' },
              ].map((kpi) => (
                <div key={kpi.label} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, padding: 20 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {kpi.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: kpi.color, letterSpacing: '-0.02em' }}>{kpi.value}</p>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-neutral-200)',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-neutral-900)', whiteSpace: 'nowrap' }}>Taux de recouvrement</span>
              <div style={{ flex: 1, height: 8, backgroundColor: 'var(--color-neutral-100)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${tauxRecouvrement}%`,
                    height: '100%',
                    backgroundColor: tauxRecouvrement >= 80 ? 'var(--color-success)' : tauxRecouvrement >= 60 ? 'var(--color-warning)' : 'var(--color-danger)',
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-900)' }}>{tauxRecouvrement} %</span>
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
                    color: filterStatut === f.key ? 'var(--color-primary)' : 'var(--color-neutral-500)',
                    backgroundColor: filterStatut === f.key ? 'var(--color-primary-light)' : 'var(--color-surface)',
                    border: `1px solid ${filterStatut === f.key ? 'var(--color-primary-border)' : 'var(--color-neutral-200)'}`,
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

        <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8, overflowX: 'auto' }}>
          {chargement ? (
            <p style={{ padding: 24, fontSize: 13, color: 'var(--color-neutral-500)', margin: 0 }}>Chargement…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 24, fontSize: 13, color: 'var(--color-neutral-500)', margin: 0 }}>Aucune charge.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-background)', borderBottom: '1px solid var(--color-neutral-200)' }}>
                  {[...(estSyndic ? ['Lot'] : []), 'Période', 'Montant', 'Échéance', 'Statut', ...(estSyndic ? [''] : [])].map((col, index) => (
                    <th scope="col"
                      key={`${col}-${index}`}
                      style={{ padding: '9px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((charge, i) => (
                  <tr key={charge.id} style={{ borderTop: i > 0 ? '1px solid var(--color-neutral-100)' : 'none' }}>
                    {estSyndic && (
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-neutral-900)', fontWeight: 500 }}>{numeroLot(charge.idLot)}</td>
                    )}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-neutral-500)' }}>{charge.periode}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: 'var(--color-neutral-900)' }}>
                      {fmt(Number(charge.montant))}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-neutral-500)' }}>
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
  )
}
