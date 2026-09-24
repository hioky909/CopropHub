import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext.js';
import { authApi } from '../api/auth.js';
import { ApiError } from '../api/client.js';

vi.mock('../api/auth.js', () => ({
  authApi: { moi: vi.fn(), connecter: vi.fn(), inscrire: vi.fn(), deconnecter: vi.fn() },
}));

function Sonde() {
  const { chargement, utilisateur, erreurServeur } = useAuth();
  if (chargement) return <p>chargement</p>;
  return (
    <p>
      {utilisateur ? 'connecté' : 'déconnecté'} / {erreurServeur ? 'indisponible' : 'disponible'}
    </p>
  );
}

function rendre() {
  return render(
    <AuthProvider>
      <Sonde />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AuthProvider — contrôle de session au démarrage', () => {
  it('un 401 signifie simplement « pas de session » : déconnecté, serveur disponible', async () => {
    vi.mocked(authApi.moi).mockRejectedValue(new ApiError(401, 'Authentification requise.'));
    rendre();
    expect(await screen.findByText('déconnecté / disponible')).toBeInTheDocument();
  });

  it.each([429, 500, 503])(
    'un %s n’est PAS une déconnexion : le serveur est signalé indisponible (l’utilisateur n’est pas expulsé)',
    async (statut) => {
      vi.mocked(authApi.moi).mockRejectedValue(new ApiError(statut, 'Erreur.'));
      rendre();
      expect(await screen.findByText('déconnecté / indisponible')).toBeInTheDocument();
    },
  );

  it('un réseau coupé (fetch qui échoue) est aussi une indisponibilité', async () => {
    vi.mocked(authApi.moi).mockRejectedValue(new TypeError('Failed to fetch'));
    rendre();
    expect(await screen.findByText('déconnecté / indisponible')).toBeInTheDocument();
  });
});
