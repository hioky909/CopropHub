import { api } from './client.js';
import type { Ag, ResolutionOrdreDuJour, ResolutionResultat, TypeMajorite } from './types.js';

export const agsApi = {
  lister: () => api.get<{ ags: Ag[] }>('/ags'),
  ordreDuJour: (idAg: string) =>
    api.get<{ ag: Ag; resolutions: ResolutionOrdreDuJour[] }>(`/ags/${idAg}`),
  resultats: (idAg: string) =>
    api.get<{ ag: Ag; resolutions: ResolutionResultat[] }>(`/ags/${idAg}/resolutions`),
  creer: (dateAg: string, resolutions: { libelle: string; typeMajorite: TypeMajorite }[]) =>
    api.post<{ ag: Ag }>('/ags', { dateAg, resolutions }),
  ouvrir: (idAg: string) => api.post<{ ag: Ag }>(`/ags/${idAg}/ouverture`),
  cloturer: (idAg: string) => api.post<{ ag: Ag }>(`/ags/${idAg}/cloture`),
  mesVotes: (idAg: string) =>
    api.get<{ votes: { idResolution: string; valeur: 'OUI' | 'NON' | 'ABSTENTION' }[] }>(
      `/ags/${idAg}/mes-votes`,
    ),
  modifierVote: (idResolution: string, valeur: 'OUI' | 'NON' | 'ABSTENTION') =>
    api.put<{ vote: { idResolution: string; valeur: string; dateVote: string } }>(
      `/resolutions/${idResolution}/votes`,
      { valeur },
    ),
  voter: (idResolution: string, valeur: 'OUI' | 'NON' | 'ABSTENTION') =>
    api.post<{ vote: { idResolution: string; valeur: string; dateVote: string } }>(
      `/resolutions/${idResolution}/votes`,
      { valeur },
    ),
};
