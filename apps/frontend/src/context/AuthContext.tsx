import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth.js';
import type { Utilisateur } from '../api/types.js';

interface AuthContextValue {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  inscrire: (nom: string, email: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    authApi
      .moi()
      .then((reponse) => setUtilisateur(reponse.utilisateur))
      .catch(() => setUtilisateur(null))
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
    <AuthContext.Provider value={{ utilisateur, chargement, connecter, inscrire, deconnecter }}>
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

