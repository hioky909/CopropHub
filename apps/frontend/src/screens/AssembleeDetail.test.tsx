import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AssembleeDetail from './AssembleeDetail.js';
import { agsApi } from '../api/ags.js';
import { ApiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

vi.mock('../api/ags.js', () => ({
  agsApi: {
    ordreDuJour: vi.fn(),
    resultats: vi.fn(),
    voter: vi.fn(),
    ouvrir: vi.fn(),
    cloturer: vi.fn(),
  },
}));
vi.mock('../context/AuthContext.js', () => ({ useAuth: vi.fn() }));

const AG_OUVERTE = { id: 'ag-1', dateAg: '2026-11-14T00:00:00.000Z', statut: 'OUVERTE' as const };
const RESOLUTIONS = [
  { id: 'r-1', libelle: 'Renouvellement du mandat du syndic', typeMajorite: 'ABSOLUE' as const },
  { id: 'r-2', libelle: 'Installation de la vidéosurveillance', typeMajorite: 'DOUBLE_MAJORITE' as const },
];

function connecteEnTant(typeCompte: 'COPROPRIETAIRE' | 'SYNDIC') {
  vi.mocked(useAuth).mockReturnValue({
    utilisateur: {
      id: 'u-1',
      email: 't@test.local',
      typeCompte,
      estMembreConseilSyndical: false,
    },
    chargement: false,
    erreurServeur: false,
    connecter: vi.fn(),
    inscrire: vi.fn(),
    deconnecter: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

function rendre() {
  return render(
    <MemoryRouter initialEntries={['/assemblees/ag-1']}>
      <Routes>
        <Route path="/assemblees/:idAg" element={<AssembleeDetail />} />
        <Route path="/assemblees" element={<p>Liste des assemblées</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(agsApi.ordreDuJour).mockResolvedValue({ ag: AG_OUVERTE, resolutions: RESOLUTIONS } as never);
  vi.mocked(agsApi.voter).mockResolvedValue({ vote: {} } as never);
});

describe('AssembleeDetail — vote d’un copropriétaire', () => {
  beforeEach(() => connecteEnTant('COPROPRIETAIRE'));

  it('affiche une seule résolution à la fois avec sa progression et sa règle de majorité', async () => {
    rendre();
    expect(await screen.findByText('Renouvellement du mandat du syndic')).toBeInTheDocument();
    expect(screen.getByText('Résolution 1 sur 2')).toBeInTheDocument();
    expect(screen.getByText('Majorité absolue (art. 25)')).toBeInTheDocument();
    expect(screen.queryByText('Installation de la vidéosurveillance')).not.toBeInTheDocument();
  });

  it('envoie le vote choisi à l’API puis confirme à l’utilisateur', async () => {
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await user.click(screen.getByRole('button', { name: 'Contre' }));

    expect(agsApi.voter).toHaveBeenCalledWith('r-1', 'NON');
    expect(await screen.findByText('Votre vote a été pris en compte pour cette résolution.')).toBeInTheDocument();
  });

  it('passe automatiquement à la résolution suivante après un vote', async () => {
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await user.click(screen.getByRole('button', { name: 'Pour' }));

    expect(await screen.findByText('Installation de la vidéosurveillance')).toBeInTheDocument();
    expect(screen.getByText('Résolution 2 sur 2')).toBeInTheDocument();
  });

  it('indique un vote déjà enregistré quand l’API répond 409, sans le présenter comme une erreur', async () => {
    vi.mocked(agsApi.voter).mockRejectedValue(new ApiError(409, 'Vous avez déjà voté.'));
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await user.click(screen.getByRole('button', { name: 'Pour' }));

    expect(await screen.findByText('Vous avez déjà voté pour cette résolution.')).toBeInTheDocument();
  });

  it('affiche l’erreur de l’API quand le vote échoue autrement, et permet de réessayer', async () => {
    vi.mocked(agsApi.voter).mockRejectedValue(new ApiError(500, 'Une erreur interne est survenue.'));
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await user.click(screen.getByRole('button', { name: 'Pour' }));

    expect(await screen.findByText('Une erreur interne est survenue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pour' })).toBeEnabled();
  });

  it('propose « Terminer le vote » seulement une fois toutes les résolutions votées, puis affiche le récapitulatif', async () => {
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await user.click(screen.getByRole('button', { name: 'Pour' }));
    await screen.findByText('Installation de la vidéosurveillance');
    expect(screen.queryByRole('button', { name: /Terminer le vote/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abstention' }));
    await user.click(await screen.findByRole('button', { name: /Terminer le vote/ }));

    expect(await screen.findByText('Votes enregistrés')).toBeInTheDocument();
    expect(agsApi.voter).toHaveBeenCalledWith('r-1', 'OUI');
    expect(agsApi.voter).toHaveBeenCalledWith('r-2', 'ABSTENTION');
  });
});

describe('AssembleeDetail — syndic', () => {
  beforeEach(() => connecteEnTant('SYNDIC'));

  it('ne montre pas l’écran de vote au syndic : liste de l’ordre du jour et bouton de clôture', async () => {
    rendre();
    expect(await screen.findByText('Renouvellement du mandat du syndic')).toBeInTheDocument();
    expect(screen.getByText('Installation de la vidéosurveillance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clôturer l’AG' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pour' })).not.toBeInTheDocument();
  });
});
