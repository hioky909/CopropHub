import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RouteProtegee } from './RouteProtegee.js';
import { useAuth } from '../context/AuthContext.js';
import type { Utilisateur } from '../api/types.js';

vi.mock('../context/AuthContext.js', () => ({ useAuth: vi.fn() }));

const utilisateur = (typeCompte: Utilisateur['typeCompte']): Utilisateur => ({
  id: 'u-1',
  email: 't@test.local',
  typeCompte,
  estMembreConseilSyndical: false,
});

function etatAuth(surcharge: Partial<ReturnType<typeof useAuth>>) {
  vi.mocked(useAuth).mockReturnValue({
    utilisateur: null,
    chargement: false,
    erreurServeur: false,
    connecter: vi.fn(),
    inscrire: vi.fn(),
    deconnecter: vi.fn(),
    ...surcharge,
  });
}

function rendre(roles?: Utilisateur['typeCompte'][]) {
  return render(
    <MemoryRouter initialEntries={['/prive']}>
      <Routes>
        <Route
          path="/prive"
          element={
            <RouteProtegee roles={roles}>
              <p>Contenu protégé</p>
            </RouteProtegee>
          }
        />
        <Route path="/connexion" element={<p>Page de connexion</p>} />
        <Route path="/" element={<p>Accueil</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RouteProtegee', () => {
  it('affiche un état de chargement tant que la session est vérifiée', () => {
    etatAuth({ chargement: true });
    rendre();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument();
  });

  it('distingue une panne serveur (pas de session vérifiable) d’une simple absence de session', () => {
    etatAuth({ erreurServeur: true });
    rendre();
    expect(screen.getByText('Serveur injoignable')).toBeInTheDocument();
    expect(screen.queryByText('Page de connexion')).not.toBeInTheDocument();
  });

  it('redirige un visiteur non connecté vers la page de connexion', () => {
    etatAuth({});
    rendre();
    expect(screen.getByText('Page de connexion')).toBeInTheDocument();
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument();
  });

  it('redirige vers l’accueil un utilisateur dont le rôle n’est pas autorisé', () => {
    etatAuth({ utilisateur: utilisateur('COPROPRIETAIRE') });
    rendre(['SYNDIC']);
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.queryByText('Contenu protégé')).not.toBeInTheDocument();
  });

  it('affiche le contenu pour un rôle autorisé', () => {
    etatAuth({ utilisateur: utilisateur('SYNDIC') });
    rendre(['SYNDIC']);
    expect(screen.getByText('Contenu protégé')).toBeInTheDocument();
  });

  it('affiche le contenu pour tout utilisateur connecté quand aucun rôle n’est exigé', () => {
    etatAuth({ utilisateur: utilisateur('COPROPRIETAIRE') });
    rendre();
    expect(screen.getByText('Contenu protégé')).toBeInTheDocument();
  });
});
