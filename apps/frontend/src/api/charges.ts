import { api } from './client.js';
import type { Charge } from './types.js';

export const chargesApi = {
  lister: () => api.get<{ charges: Charge[] }>('/charges'),
};
