import { api } from './client.js';
import type { Incident } from './types.js';

export const incidentsApi = {
  lister: () => api.get<{ incidents: Incident[] }>('/incidents'),
  declarer: (donnees: { titre: string; description?: string; idLot?: string }) =>
    api.post<{ incident: Incident }>('/incidents', donnees),
  transitionner: (idIncident: string, statut: 'EN_COURS' | 'RESOLU') =>
    api.patch<{ incident: Incident }>(`/incidents/${idIncident}/statut`, { statut }),
};
