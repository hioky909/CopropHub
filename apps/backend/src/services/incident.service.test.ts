import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  incidentService,
  DeclarationInterditeError,
  LotNonRattacheError,
} from './incident.service.js';
import { ImmeubleNonInitialiseError } from './lot.service.js';
import { incidentRepository, type NouvelIncident } from '../repositories/incident.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const IMMEUBLE = { id: 'imm-1', nom: 'Résidence Test', adresse: '1 rue du Test' };
const LOT_A = { id: 'lot-a', idImmeuble: IMMEUBLE.id, numero: '1', typeLot: 'appartement' };

const COPRO: UtilisateurAuthentifie = {
  id: 'u-copro',
  email: 'copro@test.local',
  typeCompte: 'COPROPRIETAIRE',
  estMembreConseilSyndical: false,
};
const CONSEIL_COPRO: UtilisateurAuthentifie = {
  ...COPRO,
  id: 'u-conseil',
  estMembreConseilSyndical: true,
};
const SYNDIC: UtilisateurAuthentifie = { ...COPRO, id: 'u-syndic', typeCompte: 'SYNDIC' };

function espions() {
  vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(IMMEUBLE);
  vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
  return vi.spyOn(incidentRepository, 'creer').mockImplementation(((donnees: NouvelIncident) =>
    Promise.resolve({
      id: 'inc-1',
      statut: 'DECLARE',
      dateCreation: new Date('2026-10-15T00:00:00.000Z'),
      ...donnees,
    })) as unknown as typeof incidentRepository.creer);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('incidentService.declarer (T-12, F-08 partiel, US-03)', () => {
  it('déclare un incident sur une partie commune (idLot absent)', async () => {
    const creer = espions();
    const incident = await incidentService.declarer(COPRO, { titre: 'Fuite dans le hall' });
    expect(creer).toHaveBeenCalledWith(
      expect.objectContaining({
        idLot: null,
        idUtilisateurDeclarant: COPRO.id,
        titre: 'Fuite dans le hall',
      }),
    );
    expect(incident.statut).toBe('DECLARE'); // RM-11
  });

  it('déclare un incident sur un lot que le copropriétaire possède', async () => {
    const creer = espions();
    await incidentService.declarer(COPRO, { idLot: LOT_A.id, titre: 'Fenêtre cassée' });
    expect(creer).toHaveBeenCalledWith(expect.objectContaining({ idLot: LOT_A.id }));
  });

  it('un membre du conseil syndical déclare sur son propre lot comme un copropriétaire ordinaire', async () => {
    const creer = espions();
    await incidentService.declarer(CONSEIL_COPRO, { idLot: LOT_A.id, titre: 'Dégât des eaux' });
    expect(creer).toHaveBeenCalledWith(
      expect.objectContaining({ idUtilisateurDeclarant: CONSEIL_COPRO.id }),
    );
  });

  it('RM-14 : le syndic ne déclare pas, sans aucun accès aux données', async () => {
    const immeuble = vi.spyOn(immeubleRepository, 'unique');
    const lots = vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur');
    const creer = vi.spyOn(incidentRepository, 'creer');
    await expect(incidentService.declarer(SYNDIC, { titre: 'X' })).rejects.toBeInstanceOf(
      DeclarationInterditeError,
    );
    expect(immeuble).not.toHaveBeenCalled();
    expect(lots).not.toHaveBeenCalled();
    expect(creer).not.toHaveBeenCalled();
  });

  it("anti-IDOR : refuse un idLot qui n'appartient pas au déclarant, sans écriture", async () => {
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
    const creer = vi.spyOn(incidentRepository, 'creer');
    await expect(
      incidentService.declarer(COPRO, { idLot: 'lot-dun-autre', titre: 'X' }),
    ).rejects.toBeInstanceOf(LotNonRattacheError);
    expect(creer).not.toHaveBeenCalled();
  });

  it("échoue explicitement si aucun immeuble n'est initialisé", async () => {
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(null);
    const creer = vi.spyOn(incidentRepository, 'creer');
    await expect(incidentService.declarer(COPRO, { titre: 'X' })).rejects.toBeInstanceOf(
      ImmeubleNonInitialiseError,
    );
    expect(creer).not.toHaveBeenCalled();
  });
});
