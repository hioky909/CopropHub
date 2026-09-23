import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth.js';
import { ApiError } from '../api/client.js';
import type { Utilisateur } from '../api/types.js';

interface AuthContextValue {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  /** true si le contrôle de session au démarrage a échoué pour une raison
   * autre qu'une session absente/expirée (ex. serveur injoignable) — sert
   * à distinguer « pas connecté » d'une vraie panne (T-23). */
  erreurServeur: boolean;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  inscrire: (nom: string, email: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreurServeur, setErreurServeur] = useState(false);

  useEffect(() => {
    authApi
      .moi()
      .then((reponse) => setUtilisateur(reponse.utilisateur))
      .catch((err: unknown) => {
        setUtilisateur(null);
        // Un ApiError (401 : pas de session, ou autre statut connu) est un
        // état normal, pas une panne. Toute autre erreur (fetch qui rejette
        // : serveur injoignable, réseau coupé) est une vraie panne.
        setErreurServeur(!(err instanceof ApiError));
      })
      .finally(() => setChargement(false));
  }, []);

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const reponse = await authApi.connecter(email, motDePasse);
    setUtilisateur(reponse.utilisateur);
  }, []);

  const inscrire = useCallback(async (nom: string, email: string, motDePasse: string) => {
    const reponse = await authApi.inscrire(nom, email, motDePasse);
    setUtilisateur(reponse.utilisateur);
  }, []);

  const deconnecter = useCallback(async () => {
    await authApi.deconnecter();
    setUtilisateur(null);
  }, []);

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, erreurServeur, connecter, inscrire, deconnecter }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const contexte = useContext(AuthContext);
  if (!contexte) {
    throw new Error('useAuth doit être utilisé à l’intérieur de <AuthProvider>.');
  }
  return contexte;
}

