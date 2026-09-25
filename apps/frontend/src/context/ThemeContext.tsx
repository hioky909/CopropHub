import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { themeApi } from '../api/theme.js'
import { appliquerTheme } from '../theme/appliquerTheme.js'
import { genererTheme, type EntreesTheme } from '../theme/genererTheme.js'
import { ecrireThemeCache, effacerThemeCache, lireThemeCache } from '../theme/themeStorage.js'
import { useAuth } from './AuthContext.js'

interface ThemeContextValue {
  /** Thème enregistré de l'utilisateur ; `null` = thème CopropHub d'origine (« Classique »). */
  theme: EntreesTheme | null
  enregistrer: (teinte: number, intensite: number) => Promise<void>
  reinitialiser: () => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function appliquerAuDocument(theme: EntreesTheme | null): void {
  appliquerTheme(document.documentElement, theme ? genererTheme(theme) : null)
  if (theme) ecrireThemeCache(theme)
  else effacerThemeCache()
}

/**
 * Thème enregistré de l'utilisateur, appliqué à toute l'application par variables CSS sur `<html>` :
 * les composants lisent `var(--…)`, donc un changement de thème ne re-rend rien. Le contexte
 * n'expose que la valeur enregistrée (jamais l'état de glissement de l'éditeur, qui reste local).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { utilisateur, chargement, erreurServeur } = useAuth()
  // Le cache (appliqué avant le premier rendu par `main.tsx`) évite un flash de la couleur d'origine.
  const [theme, setTheme] = useState<EntreesTheme | null>(() => lireThemeCache())

  useEffect(() => {
    if (chargement || erreurServeur) return // session pas encore connue, ou serveur injoignable : on garde l'affichage
    // Le serveur a le dernier mot ; sans session (déconnexion, cookie expiré), retour au thème d'origine.
    setTheme(utilisateur?.theme ?? null)
  }, [utilisateur, chargement, erreurServeur])

  useEffect(() => {
    if (chargement || erreurServeur) return
    appliquerAuDocument(theme)
  }, [theme, chargement, erreurServeur])

  const enregistrer = useCallback(async (teinte: number, intensite: number) => {
    const { theme: enregistre } = await themeApi.definir(teinte, intensite)
    setTheme({ teinte: enregistre.teinte, intensite: enregistre.intensite })
  }, [])

  const reinitialiser = useCallback(async () => {
    await themeApi.reinitialiser()
    setTheme(null)
  }, [])

  const valeur = useMemo(() => ({ theme, enregistrer, reinitialiser }), [theme, enregistrer, reinitialiser])
  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const contexte = useContext(ThemeContext)
  if (!contexte) {
    throw new Error('useTheme doit être utilisé à l’intérieur de <ThemeProvider>.')
  }
  return contexte
}
