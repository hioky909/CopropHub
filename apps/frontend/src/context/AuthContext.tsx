import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth.js';
import { utilisateursApi } from '../api/utilisateurs.js';
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
  /** F-12 : active ou désactive les courriels de service, puis met à jour l'utilisateur en mémoire. */
  definirNotificationsEmail: (actives: boolean) => Promise<void>;
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
        // Seul un 401 signifie « pas de session » (état normal). Tout le reste
        // — serveur injoignable, 5xx, et surtout 429 (trop de requêtes) — est
        // une indisponibilité temporaire : on ne doit JAMAIS traiter cela comme
        // une déconnexion, sinon un simple ralentissement expulserait l'utilisateur.
        setErreurServeur(!(err instanceof ApiError && err.status === 401));
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

  const definirNotificationsEmail = useCallback(async (actives: boolean) => {
    const reponse = await utilisateursApi.definirNotificationsEmail(actives);
    setUtilisateur((courant) => (courant ? { ...courant, notificationsEmail: reponse.notificationsEmail } : courant));
  }, []);

  return (
    <AuthContext.Provider
      value={{ utilisateur, chargement, erreurServeur, connecter, inscrire, deconnecter, definirNotificationsEmail }}
    >
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

