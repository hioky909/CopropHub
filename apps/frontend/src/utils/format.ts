export function formaterDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR')
}

export function formaterMontant(montant: number | string): string {
  return Number(montant).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}
