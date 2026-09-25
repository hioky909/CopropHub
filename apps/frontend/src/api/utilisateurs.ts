import { api } from './client.js';
import type { Coproprietaire, LotAvecProprietaire } from './types.js';

/** Gestion des copropriétaires et des lots — réservée au syndic côté serveur. */
export const utilisateursApi = {
  lister: () => api.get<{ coproprietaires: Coproprietaire[] }>('/utilisateurs'),
  creer: (nom: string, email: string, motDePasse: string) =>
    api.post<{ utilisateur: { id: string; nom: string; email: string } }>('/utilisateurs', {
      nom,
      email,
      motDePasse,
    }),
  listerSyndics: () => api.get<{ syndics: { id: string; nom: string; email: string }[] }>('/utilisateurs/syndics'),
  creerSyndic: (nom: string, email: string, motDePasse: string) =>
    api.post<{ utilisateur: { id: string; nom: string; email: string } }>('/utilisateurs/syndics', {
      nom,
      email,
      motDePasse,
    }),
  definirConseilSyndical: (idUtilisateur: string, estMembre: boolean) =>
    api.patch<{ utilisateur: { id: string; estMembreConseilSyndical: boolean } }>(
      `/utilisateurs/${idUtilisateur}/conseil-syndical`,
      { estMembre },
    ),
  listerLots: () => api.get<{ lots: LotAvecProprietaire[] }>('/utilisateurs/lots'),
  creerLot: (numero: string, typeLot: string) =>
    api.post<{ lot: { id: string; numero: string; typeLot: string } }>('/utilisateurs/lots', {
      numero,
      typeLot,
    }),
  rattacher: (idLot: string, idUtilisateur: string) =>
    api.post<{ rattachement: { id: string } }>('/utilisateurs/lots/rattachement', {
      idLot,
      idUtilisateur,
    }),
};
