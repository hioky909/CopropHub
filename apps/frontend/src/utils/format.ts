export function formaterDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR')
}

export function formaterMontant(montant: number | string): string {
  return Number(montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

/** « 14 novembre 2026 » — en UTC : `dateAg` est une date calendaire stockée à minuit UTC, jamais décalée par le fuseau. */
export function formaterDateLongue(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Jour et mois abrégé (« 14 », « NOV. ») pour la tuile de date d'une carte. */
export function partiesDate(date: string | Date): { jour: string; mois: string } {
  const d = new Date(date)
  return {
    jour: String(d.getUTCDate()),
    mois: d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
  }
}
