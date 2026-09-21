import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  voteService,
  VoteInterditError,
  ResolutionIntrouvableError,
  AgNonOuverteError,
  VoteDejaExprimeError,
} from './vote.service.js';
import { voteRepository } from '../repositories/vote.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_RESOLUTION = '22222222-2222-4222-8222-222222222222';
const COPRO: UtilisateurAuthentifie = {
  id: 'u-copro',
  email: 'copro@test.local',
  typeCompte: 'COPROPRIETAIRE',
  estMembreConseilSyndical: false,
};
const SYNDIC: UtilisateurAuthentifie = { ...COPRO, id: 'u-syndic', typeCompte: 'SYNDIC' };
const CONSEIL_COPRO: UtilisateurAuthentifie = {
  ...COPRO,
  id: 'u-conseil',
  estMembreConseilSyndical: true,
};

const LOT = { id: 'lot-1', idImmeuble: 'imm-1', numero: '12', typeLot: 'appartement' };
const VOTE = {
  idResolution: ID_RESOLUTION,
  idUtilisateur: 'u-copro',
  valeur: 'OUI' as const,
  dateVote: new Date(),
};

function espions() {
  return {
    lots: vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT]),
    enregistrer: vi
      .spyOn(voteRepository, 'enregistrerSiAgOuverte')
      .mockResolvedValue({ statut: 'ENREGISTRE', vote: VOTE }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('voteService.voter (F-05, US-02)', () => {
  it("enregistre le vote d'un copropriétaire rattaché", async () => {
    const { enregistrer } = espions();
    const vote = await voteService.voter(COPRO, ID_RESOLUTION, 'OUI');
    expect(enregistrer).toHaveBeenCalledWith(ID_RESOLUTION, COPRO.id, 'OUI');
    expect(vote).toEqual(VOTE);
  });

  it('RM-07 : le syndic ne vote pas, sans aucun accès aux données', async () => {
    const { lots, enregistrer } = espions();
    await expect(voteService.voter(SYNDIC, ID_RESOLUTION, 'OUI')).rejects.toBeInstanceOf(
      VoteInterditError,
    );
    expect(lots).not.toHaveBeenCalled();
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('RM-07 : un membre du conseil syndical vote en tant que copropriétaire, pas en tant que conseil', async () => {
    const { enregistrer } = espions();
    await voteService.voter(CONSEIL_COPRO, ID_RESOLUTION, 'NON');
    expect(enregistrer).toHaveBeenCalledWith(ID_RESOLUTION, CONSEIL_COPRO.id, 'NON');
  });

  it("RM-06 : un copropriétaire sans lot rattaché ne vote pas, et rien n'est écrit", async () => {
    const { lots, enregistrer } = espions();
    lots.mockResolvedValue([]);
    await expect(voteService.voter(COPRO, ID_RESOLUTION, 'OUI')).rejects.toBeInstanceOf(
      VoteInterditError,
    );
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it.each([
    ['RESOLUTION_INTROUVABLE', ResolutionIntrouvableError],
    ['AG_NON_OUVERTE', AgNonOuverteError],
    ['DEJA_VOTE', VoteDejaExprimeError],
  ] as const)(
    'traduit le résultat %s du dépôt en erreur métier',
    async (statut, erreurAttendue) => {
      const { enregistrer } = espions();
      enregistrer.mockResolvedValue({ statut });
      await expect(voteService.voter(COPRO, ID_RESOLUTION, 'OUI')).rejects.toBeInstanceOf(
        erreurAttendue,
      );
    },
  );
});
