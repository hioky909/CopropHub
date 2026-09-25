import { api } from './client.js';
import type { Charge } from './types.js';

export const chargesApi = {
  lister: () => api.get<{ charges: Charge[] }>('/charges'),
  /** F-13 : relevé de charges (toutes pour le syndic et le conseil, celles de ses lots sinon). */
  relevePdf: () => api.telecharger('/charges/export.pdf', `releve-charges-${new Date().toISOString().slice(0, 10)}.pdf`),
  creer: (idLot: string, montant: string, periode: string, dateEcheance?: string) =>
    api.post<{ charge: Charge }>('/charges', { idLot, montant, periode, ...(dateEcheance ? { dateEcheance } : {}) }),
  marquerPayee: (idCharge: string) => api.patch<{ charge: Charge }>(`/charges/${idCharge}/paiement`),
};
