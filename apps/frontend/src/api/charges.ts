import { api } from './client.js';
import type { Charge } from './types.js';

export const chargesApi = {
  lister: () => api.get<{ charges: Charge[] }>('/charges'),
  creer: (idLot: string, montant: string, periode: string, dateEcheance?: string) =>
    api.post<{ charge: Charge }>('/charges', { idLot, montant, periode, ...(dateEcheance ? { dateEcheance } : {}) }),
  marquerPayee: (idCharge: string) => api.patch<{ charge: Charge }>(`/charges/${idCharge}/paiement`),
};
