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
    mesVotes: vi.fn(),
    modifierVote: vi.fn(),
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

async function choisirEtValider(user: ReturnType<typeof userEvent.setup>, choix: 'Pour' | 'Contre' | 'Abstention') {
  await user.click(screen.getByRole('button', { name: choix }));
  await user.click(screen.getByRole('button', { name: new RegExp(`Valider mon vote — ${choix}`) }));
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
  vi.mocked(agsApi.modifierVote).mockResolvedValue({ vote: {} } as never);
  vi.mocked(agsApi.mesVotes).mockResolvedValue({ votes: [] });
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

  it('choisir une option n’envoie rien : le bouton « Valider mon vote » est requis', async () => {
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    expect(screen.getByRole('button', { name: 'Sélectionnez un vote' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Contre' }));

    expect(agsApi.voter).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Valider mon vote — Contre/ })).toBeEnabled();
  });

  it('envoie le vote choisi à l’API puis confirme à l’utilisateur', async () => {
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await choisirEtValider(user, 'Contre');

    expect(agsApi.voter).toHaveBeenCalledWith('r-1', 'NON');
    expect(await screen.findByText('Votre vote a été pris en compte pour cette résolution.')).toBeInTheDocument();
  });

  it('passe automatiquement à la résolution suivante après un vote', async () => {
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await choisirEtValider(user, 'Pour');

    expect(await screen.findByText('Installation de la vidéosurveillance')).toBeInTheDocument();
    expect(screen.getByText('Résolution 2 sur 2')).toBeInTheDocument();
  });

  it('indique un vote déjà enregistré quand l’API répond 409, sans le présenter comme une erreur', async () => {
    vi.mocked(agsApi.voter).mockRejectedValue(new ApiError(409, 'Vous avez déjà voté.'));
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await choisirEtValider(user, 'Pour');

    expect(await screen.findByText('Vous avez déjà voté pour cette résolution.')).toBeInTheDocument();
  });

  it('affiche l’erreur de l’API quand le vote échoue autrement, et permet de réessayer', async () => {
    vi.mocked(agsApi.voter).mockRejectedValue(new ApiError(500, 'Une erreur interne est survenue.'));
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await choisirEtValider(user, 'Pour');

    expect(await screen.findByText('Une erreur interne est survenue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pour' })).toBeEnabled();
  });

  it('après le dernier vote, retourne directement à la liste des assemblées, sans écran de confirmation intermédiaire', async () => {
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await choisirEtValider(user, 'Pour');
    await screen.findByText('Installation de la vidéosurveillance');
    expect(screen.queryByText('Liste des assemblées')).not.toBeInTheDocument();

    await choisirEtValider(user, 'Abstention');

    expect(await screen.findByText('Liste des assemblées')).toBeInTheDocument();
    expect(screen.queryByText('Votes enregistrés')).not.toBeInTheDocument();
    expect(agsApi.voter).toHaveBeenCalledWith('r-1', 'OUI');
    expect(agsApi.voter).toHaveBeenCalledWith('r-2', 'ABSTENTION');
  });
});

describe('AssembleeDetail — retrouver et modifier son vote', () => {
  beforeEach(() => connecteEnTant('COPROPRIETAIRE'));

  it('reprend à la première résolution sans vote et affiche les votes déjà exprimés', async () => {
    vi.mocked(agsApi.mesVotes).mockResolvedValue({ votes: [{ idResolution: 'r-1', valeur: 'OUI' }] });
    rendre();

    expect(await screen.findByText('Installation de la vidéosurveillance')).toBeInTheDocument();
    expect(screen.getByText('Résolution 2 sur 2')).toBeInTheDocument();
  });

  it('un vote déjà exprimé s’affiche en lecture seule avec un bouton « Modifier mon vote »', async () => {
    vi.mocked(agsApi.mesVotes).mockResolvedValue({
      votes: [
        { idResolution: 'r-1', valeur: 'OUI' },
        { idResolution: 'r-2', valeur: 'NON' },
      ],
    });
    rendre();

    expect(await screen.findByText('Renouvellement du mandat du syndic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier mon vote' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pour' })).not.toBeInTheDocument();
  });

  it('modifier son vote appelle PUT (pas POST) et reste sur la même résolution', async () => {
    vi.mocked(agsApi.mesVotes).mockResolvedValue({
      votes: [
        { idResolution: 'r-1', valeur: 'OUI' },
        { idResolution: 'r-2', valeur: 'NON' },
      ],
    });
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await user.click(screen.getByRole('button', { name: 'Modifier mon vote' }));
    await choisirEtValider(user, 'Contre');

    expect(agsApi.modifierVote).toHaveBeenCalledWith('r-1', 'NON');
    expect(agsApi.voter).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Modifier mon vote' })).toBeInTheDocument();
    expect(screen.getByText('Résolution 1 sur 2')).toBeInTheDocument();
  });

  it('garder le même vote en mode modification ne permet pas de valider et n’appelle pas l’API', async () => {
    vi.mocked(agsApi.mesVotes).mockResolvedValue({
      votes: [
        { idResolution: 'r-1', valeur: 'OUI' },
        { idResolution: 'r-2', valeur: 'NON' },
      ],
    });
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await user.click(screen.getByRole('button', { name: 'Modifier mon vote' }));
    await user.click(screen.getByRole('button', { name: 'Pour' }));

    expect(screen.getByRole('button', { name: /Valider mon vote — Pour/ })).toBeDisabled();
    expect(agsApi.modifierVote).not.toHaveBeenCalled();
    expect(agsApi.voter).not.toHaveBeenCalled();
  });

  it('un vote qui échoue ne fait pas avancer à la résolution suivante', async () => {
    vi.mocked(agsApi.voter).mockRejectedValue(new ApiError(500, 'Une erreur interne est survenue.'));
    const user = userEvent.setup();
    rendre();
    await screen.findByText('Renouvellement du mandat du syndic');

    await choisirEtValider(user, 'Pour');
    await screen.findByText('Une erreur interne est survenue.');
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(screen.getByText('Résolution 1 sur 2')).toBeInTheDocument();
  });

  it('sur une AG clôturée, affiche le vote du copropriétaire à côté du résultat', async () => {
    vi.mocked(agsApi.ordreDuJour).mockResolvedValue({
      ag: { ...AG_OUVERTE, statut: 'CLOTUREE' },
      resolutions: RESOLUTIONS,
    } as never);
    vi.mocked(agsApi.resultats).mockResolvedValue({
      ag: { ...AG_OUVERTE, statut: 'CLOTUREE' },
      resolutions: RESOLUTIONS.map((r) => ({
        ...r,
        statutResultat: 'ADOPTEE',
        decomptes: { oui: 2, non: 1, abstention: 0 },
      })),
    } as never);
    vi.mocked(agsApi.mesVotes).mockResolvedValue({ votes: [{ idResolution: 'r-1', valeur: 'NON' }] });
    rendre();

    expect(await screen.findAllByText(/Mon vote/)).toHaveLength(2);
    expect(screen.getByText('Contre')).toBeInTheDocument();
    expect(screen.getByText('vous n’avez pas voté sur cette résolution')).toBeInTheDocument();
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
