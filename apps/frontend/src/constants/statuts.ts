import type { Ag, Charge, Incident } from '../api/types.js'

/** Source unique des libellés et variantes de badge par statut, partagée par tous les écrans. */

export const STATUT_INCIDENT: Record<
  Incident['statut'],
  { variant: 'success' | 'warning' | 'neutral'; label: string }
> = {
  DECLARE: { variant: 'neutral', label: 'Déclaré' },
  EN_COURS: { variant: 'warning', label: 'En cours' },
  RESOLU: { variant: 'success', label: 'Résolu' },
}

export const STATUT_AG: Record<
  Ag['statut'],
  { variant: 'neutral' | 'info' | 'success'; label: string }
> = {
  PLANIFIEE: { variant: 'neutral', label: 'Planifiée' },
  OUVERTE: { variant: 'info', label: 'Vote ouvert' },
  CLOTUREE: { variant: 'success', label: 'Clôturée' },
}

export const STATUT_CHARGE: Record<
  Charge['statut'],
  { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  A_PAYER: { variant: 'neutral', label: 'À payer' },
  PAYEE: { variant: 'success', label: 'Payée' },
  EN_RETARD: { variant: 'danger', label: 'En retard' },
}

export const MAJORITE_LABEL: Record<string, string> = {
  SIMPLE: 'Majorité simple (art. 24)',
  ABSOLUE: 'Majorité absolue (art. 25)',
  DOUBLE_MAJORITE: 'Double majorité (art. 26)',
  UNANIMITE: 'Unanimité',
}
