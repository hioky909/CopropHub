import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Button from '../components/Button.js'
import { SelectField, TextField } from '../components/FormField.js'
import Notification from '../components/Notification.js'
import { utilisateursApi } from '../api/utilisateurs.js'
import { ApiError } from '../api/client.js'
import type { Coproprietaire, LotAvecProprietaire } from '../api/types.js'

const TYPES_LOT = ['appartement', 'cave', 'parking', 'local commercial']

const carte = { backgroundColor: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 8 } as const
const carteTableau = { ...carte, overflowX: 'auto' } as const
const cellule = { padding: '12px 24px', fontSize: 14, color: '#1A1A1A' } as const
const enTete = {
  padding: '10px 24px',
  fontSize: 12,
  fontWeight: 500,
  color: '#5C5C5C',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
} as const

/**
 * Gestion des copropriétaires et des lots par le syndic (F-02, F-03, US-10) :
 * créer un compte copropriétaire, créer un lot, rattacher un lot à un
 * copropriétaire (ce qui clôture l'éventuel rattachement précédent). Sans
 * cet écran, il fallait passer par l'API pour qu'un compte puisse voter ou
 * déclarer un incident sur son lot.
 */
export default function Coproprietaires() {
  const [coproprietaires, setCoproprietaires] = useState<Coproprietaire[]>([])
  const [lots, setLots] = useState<LotAvecProprietaire[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [succes, setSucces] = useState<string | null>(null)
  const [action, setAction] = useState(false)

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [numeroLot, setNumeroLot] = useState('')
  const [typeLot, setTypeLot] = useState(TYPES_LOT[0]!)
  const [choixProprietaire, setChoixProprietaire] = useState<Record<string, string>>({})

  const charger = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([utilisateursApi.lister(), utilisateursApi.listerLots()])
      setCoproprietaires(c.coproprietaires)
      setLots(l.lots)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les copropriétaires.')
    } finally {
      setChargement(false)
    }
  }, [])

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

  async function creerCoproprietaire(e: FormEvent) {
    e.preventDefault()
    const ok = await executer(
      () => utilisateursApi.creer(nom, email, motDePasse),
      `Copropriétaire ${nom} créé.`,
    )
    if (ok) {
      setNom('')
      setEmail('')
      setMotDePasse('')
    }
  }

  async function creerLot(e: FormEvent) {
    e.preventDefault()
    const ok = await executer(() => utilisateursApi.creerLot(numeroLot, typeLot), `Lot ${numeroLot} créé.`)
    if (ok) setNumeroLot('')
  }

  async function rattacher(lot: LotAvecProprietaire) {
    const idUtilisateur = choixProprietaire[lot.id]
    if (!idUtilisateur) return
    await executer(() => utilisateursApi.rattacher(lot.id, idUtilisateur), `Lot ${lot.numero} rattaché.`)
    setChoixProprietaire((prev) => ({ ...prev, [lot.id]: '' }))
  }

  const lotsDe = (idUtilisateur: string) =>
    lots.filter((l) => l.proprietaire?.id === idUtilisateur).map((l) => l.numero)

  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
        Copropriétaires
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: '#5C5C5C' }}>
        {chargement ? 'Chargement…' : `${coproprietaires.length} copropriétaires · ${lots.length} lots`}
      </p>

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

      <div className="grille-deux-colonnes" style={{ marginBottom: 24 }}>
        <form onSubmit={creerCoproprietaire} style={{ ...carte, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Ajouter un copropriétaire</h2>
          <TextField label="Nom complet" required value={nom} onChange={(e) => setNom(e.target.value)} />
          <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField
            label="Mot de passe provisoire"
            type="password"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            help="12 caractères minimum. Le copropriétaire pourra le changer depuis « Mon compte »."
          />
          <Button type="submit" variant="primary" disabled={action}>
            Créer le copropriétaire
          </Button>
        </form>

        <form onSubmit={creerLot} style={{ ...carte, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Ajouter un lot</h2>
          <TextField label="Numéro du lot" required value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)} />
          <SelectField label="Type de lot" value={typeLot} onChange={(e) => setTypeLot(e.target.value)}>
            {TYPES_LOT.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
          <Button type="submit" variant="primary" disabled={action}>
            Créer le lot
          </Button>
        </form>
      </div>

      <div style={{ ...carteTableau, marginBottom: 24 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F2F2F2' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Lots et propriétaires</h2>
        </div>
        {lots.length === 0 ? (
          <p style={{ padding: 24, margin: 0, fontSize: 13, color: '#5C5C5C' }}>
            {chargement ? 'Chargement…' : 'Aucun lot. Créez-en un ci-dessus.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={enTete}>Lot</th>
                <th style={enTete}>Type</th>
                <th style={enTete}>Propriétaire</th>
                <th style={enTete}>Rattacher à</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} style={{ borderTop: '1px solid #F2F2F2' }}>
                  <td style={{ ...cellule, fontWeight: 600 }}>{lot.numero}</td>
                  <td style={cellule}>{lot.typeLot}</td>
                  <td style={cellule}>{lot.proprietaire?.nom ?? <span style={{ color: '#5C5C5C' }}>Non rattaché</span>}</td>
                  <td style={cellule}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        aria-label={`Copropriétaire à rattacher au lot ${lot.numero}`}
                        value={choixProprietaire[lot.id] ?? ''}
                        onChange={(e) => setChoixProprietaire((prev) => ({ ...prev, [lot.id]: e.target.value }))}
                        style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #E0E0E0', borderRadius: 6, fontFamily: 'inherit' }}
                      >
                        <option value="">Choisir…</option>
                        {coproprietaires.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={action || !choixProprietaire[lot.id]}
                        onClick={() => void rattacher(lot)}
                      >
                        Rattacher
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={carteTableau}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F2F2F2' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Copropriétaires</h2>
        </div>
        {coproprietaires.length === 0 ? (
          <p style={{ padding: 24, margin: 0, fontSize: 13, color: '#5C5C5C' }}>
            {chargement ? 'Chargement…' : 'Aucun copropriétaire. Créez-en un ci-dessus.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={enTete}>Nom</th>
                <th style={enTete}>Email</th>
                <th style={enTete}>Lots</th>
              </tr>
            </thead>
            <tbody>
              {coproprietaires.map((c) => {
                const numeros = lotsDe(c.id)
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #F2F2F2' }}>
                    <td style={{ ...cellule, fontWeight: 500 }}>{c.nom}</td>
                    <td style={cellule}>{c.email}</td>
                    <td style={cellule}>
                      {numeros.length > 0 ? numeros.join(', ') : <span style={{ color: '#5C5C5C' }}>Aucun lot</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
