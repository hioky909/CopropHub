import { api } from './client.js';
import type { Utilisateur } from './types.js';

export const authApi = {
  moi: () => api.get<{ utilisateur: Utilisateur }>('/auth/moi'),
  connecter: (email: string, motDePasse: string) =>
    api.post<{ utilisateur: Utilisateur }>('/auth/connexion', { email, motDePasse }),
  inscrire: (nom: string, email: string, motDePasse: string) =>
    api.post<{ utilisateur: Utilisateur }>('/auth/inscription', { nom, email, motDePasse }),
  demanderReinitialisation: (email: string) =>
    api.post<{ message: string }>('/auth/mot-de-passe-oublie', { email }),
  reinitialiserMotDePasse: (jeton: string, nouveauMotDePasse: string) =>
    api.post<void>('/auth/reinitialiser-mot-de-passe', { jeton, nouveauMotDePasse }),
  deconnecter: () => api.post<void>('/auth/deconnexion'),
  changerMotDePasse: (motDePasseActuel: string, nouveauMotDePasse: string) =>
    api.post<void>('/auth/mot-de-passe', { motDePasseActuel, nouveauMotDePasse }),
};
