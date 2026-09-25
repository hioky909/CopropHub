import { api } from './client.js'

export interface ThemeEnregistre {
  teinte: number
  intensite: number
}

export const themeApi = {
  definir: (teinte: number, intensite: number) =>
    api.put<{ theme: ThemeEnregistre }>('/utilisateurs/moi/theme', { teinte, intensite }),
  reinitialiser: () => api.delete<void>('/utilisateurs/moi/theme'),
}
