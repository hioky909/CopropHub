import { api } from './client.js';
import type { Lot } from './types.js';

export const lotsApi = {
  mesLots: () => api.get<{ lots: Lot[] }>('/utilisateurs/moi/lots'),
};
