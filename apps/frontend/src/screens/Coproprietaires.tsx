import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Button from '../components/Button.js'
import { SelectField, TextField } from '../components/FormField.js'
import Notification from '../components/Notification.js'
import { utilisateursApi } from '../api/utilisateurs.js'
import { ApiError } from '../api/client.js'
import type { Coproprietaire, LotAvecProprietaire } from '../api/types.js'

const TYPES_LOT = ['appartement', 'cave', 'parking', 'local commercial']

const carte = { backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-neutral-200)', borderRadius: 8 } as const
const carteTableau = { ...carte, overflowX: 'auto' } as const
const cellule = { padding: '12px 24px', fontSize: 14, color: 'var(--color-neutral-900)' } as const
const enTete = {
  padding: '10px 24px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--color-neutral-500)',
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
  const [syndics, setSyndics] = useState<{ id: string; nom: string; email: string }[]>([])
  const [nomSyndic, setNomSyndic] = useState('')
  const [emailSyndic, setEmailSyndic] = useState('')
  const [motDePasseSyndic, setMotDePasseSyndic] = useState('')

  const charger = useCallback(async () => {
    try {
      const [c, l, s] = await Promise.all([
        utilisateursApi.lister(),
        utilisateursApi.listerLots(),
        utilisateursApi.listerSyndics(),
      ])
      setCoproprietaires(c.coproprietaires)
      setLots(l.lots)
      setSyndics(s.syndics)
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

  async function creerSyndic(e: FormEvent) {
    e.preventDefault()
    const ok = await executer(
      () => utilisateursApi.creerSyndic(nomSyndic, emailSyndic, motDePasseSyndic),
      `Syndic ${nomSyndic} créé.`,
    )
    if (ok) {
      setNomSyndic('')
      setEmailSyndic('')
      setMotDePasseSyndic('')
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
      <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: 'var(--color-neutral-900)', letterSpacing: '-0.02em' }}>
        Copropriétaires
      </h1>
      <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--color-neutral-500)' }}>
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
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Ajouter un copropriétaire</h2>
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
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Ajouter un lot</h2>
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
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-neutral-100)' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Lots et propriétaires</h2>
        </div>
        {lots.length === 0 ? (
          <p style={{ padding: 24, margin: 0, fontSize: 13, color: 'var(--color-neutral-500)' }}>
            {chargement ? 'Chargement…' : 'Aucun lot. Créez-en un ci-dessus.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th scope="col" style={enTete}>Lot</th>
                <th scope="col" style={enTete}>Type</th>
                <th scope="col" style={enTete}>Propriétaire</th>
                <th scope="col" style={enTete}>Rattacher à</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
                  <td style={{ ...cellule, fontWeight: 600 }}>{lot.numero}</td>
                  <td style={cellule}>{lot.typeLot}</td>
                  <td style={cellule}>{lot.proprietaire?.nom ?? <span style={{ color: 'var(--color-neutral-500)' }}>Non rattaché</span>}</td>
                  <td style={cellule}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        aria-label={`Copropriétaire à rattacher au lot ${lot.numero}`}
                        value={choixProprietaire[lot.id] ?? ''}
                        onChange={(e) => setChoixProprietaire((prev) => ({ ...prev, [lot.id]: e.target.value }))}
                        style={{ padding: '6px 8px', fontSize: 13, border: '1px solid var(--color-neutral-200)', borderRadius: 6, fontFamily: 'inherit' }}
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
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-neutral-100)' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Copropriétaires</h2>
        </div>
        {coproprietaires.length === 0 ? (
          <p style={{ padding: 24, margin: 0, fontSize: 13, color: 'var(--color-neutral-500)' }}>
            {chargement ? 'Chargement…' : 'Aucun copropriétaire. Créez-en un ci-dessus.'}
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th scope="col" style={enTete}>Nom</th>
                <th scope="col" style={enTete}>Email</th>
                <th scope="col" style={enTete}>Lots</th>
                <th scope="col" style={enTete}>Conseil syndical</th>
              </tr>
            </thead>
            <tbody>
              {coproprietaires.map((c) => {
                const numeros = lotsDe(c.id)
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
                    <td style={{ ...cellule, fontWeight: 500 }}>{c.nom}</td>
                    <td style={cellule}>{c.email}</td>
                    <td style={cellule}>
                      {numeros.length > 0 ? numeros.join(', ') : <span style={{ color: 'var(--color-neutral-500)' }}>Aucun lot</span>}
                    </td>
                    <td style={cellule}>
                      <input
                        type="checkbox"
                        aria-label={`Membre du conseil syndical : ${c.nom}`}
                        checked={c.estMembreConseilSyndical}
                        disabled={action}
                        onChange={(e) =>
                          void executer(
                            () => utilisateursApi.definirConseilSyndical(c.id, e.target.checked),
                            e.target.checked
                              ? `${c.nom} est désigné(e) membre du conseil syndical.`
                              : `${c.nom} n’est plus membre du conseil syndical.`,
                          )
                        }
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="grille-deux-colonnes" style={{ marginTop: 24 }}>
        <div style={carteTableau}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-neutral-100)' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Équipe du syndic</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th scope="col" style={enTete}>Nom</th>
                <th scope="col" style={enTete}>Email</th>
              </tr>
            </thead>
            <tbody>
              {syndics.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--color-neutral-100)' }}>
                  <td style={{ ...cellule, fontWeight: 500 }}>{s.nom}</td>
                  <td style={cellule}>{s.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={creerSyndic} style={{ ...carte, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-neutral-900)' }}>Ajouter un syndic</h2>
          <TextField label="Nom du nouveau syndic" required value={nomSyndic} onChange={(e) => setNomSyndic(e.target.value)} />
          <TextField label="Courriel du nouveau syndic" type="email" required value={emailSyndic} onChange={(e) => setEmailSyndic(e.target.value)} />
          <TextField
            label="Mot de passe du nouveau syndic"
            type="password"
            required
            value={motDePasseSyndic}
            onChange={(e) => setMotDePasseSyndic(e.target.value)}
            help="12 caractères minimum. Un syndic peut tout gérer : n’en créez que de confiance."
          />
          <Button type="submit" variant="primary" disabled={action}>
            Créer le syndic
          </Button>
        </form>
      </div>
    </main>
  )
}
