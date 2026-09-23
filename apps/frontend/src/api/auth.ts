import { api } from './client.js';
import type { Utilisateur } from './types.js';

export const authApi = {
  moi: () => api.get<{ utilisateur: Utilisateur }>('/auth/moi'),
  connecter: (email: string, motDePasse: string) =>
    api.post<{ utilisateur: Utilisateur }>('/auth/connexion', { email, motDePasse }),
  inscrire: (nom: string, email: string, motDePasse: string) =>
    api.post<{ utilisateur: Utilisateur }>('/auth/inscription', { nom, email, motDePasse }),
  deconnecter: () => api.post<void>('/auth/deconnexion'),
};
