import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  incidentService,
  IncidentIntrouvableError,
  TransitionInvalideError,
} from './incident.service.js';
import { incidentRepository } from '../repositories/incident.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const ID_INCIDENT = '66666666-6666-4666-8666-666666666666';
const DATE_CREATION = new Date('2026-10-15T00:00:00.000Z');

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const COPRO: UtilisateurAuthentifie = { ...SYNDIC, id: 'u-copro-a', typeCompte: 'COPROPRIETAIRE' };
const CONSEIL: UtilisateurAuthentifie = {
  ...COPRO,
  id: 'u-conseil',
  estMembreConseilSyndical: true,
};

function incident(statut: 'DECLARE' | 'EN_COURS' | 'RESOLU') {
  return {
    id: ID_INCIDENT,
    idImmeuble: 'imm-1',
    idLot: null,
    idUtilisateurDeclarant: COPRO.id,
    titre: 'Fuite',
    description: null,
    statut,
    dateCreation: DATE_CREATION,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('incidentService.lister (T-13, RM-12)', () => {
  it('renvoie tous les incidents pour le syndic', async () => {
    const tous = vi
      .spyOn(incidentRepository, 'listerTous')
      .mockResolvedValue([incident('DECLARE')]);
    const pourDeclarant = vi.spyOn(incidentRepository, 'listerPourCoproprietaire');
    const resultat = await incidentService.lister(SYNDIC);
    expect(tous).toHaveBeenCalledTimes(1);
    expect(pourDeclarant).not.toHaveBeenCalled();
    expect(resultat).toHaveLength(1);
  });

  it('renvoie tous les incidents pour un membre du conseil syndical (droit de regard étendu)', async () => {
    const tous = vi.spyOn(incidentRepository, 'listerTous').mockResolvedValue([]);
    await incidentService.lister(CONSEIL);
    expect(tous).toHaveBeenCalledTimes(1);
  });

  it('renvoie uniquement les incidents déclarés par un copropriétaire ordinaire (« les siens »)', async () => {
    const tous = vi.spyOn(incidentRepository, 'listerTous');
    const pourDeclarant = vi
      .spyOn(incidentRepository, 'listerPourCoproprietaire')
      .mockResolvedValue([incident('DECLARE')]);
    await incidentService.lister(COPRO);
    expect(pourDeclarant).toHaveBeenCalledWith(COPRO.id);
    expect(tous).not.toHaveBeenCalled();
  });
});

describe('incidentService.transitionner (T-13, RM-11, RM-13, US-09)', () => {
  it('DECLARE → EN_COURS est une transition valide', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('DECLARE'));
    const transitionner = vi
      .spyOn(incidentRepository, 'transitionnerSiStatut')
      .mockResolvedValue(incident('EN_COURS'));
    const resultat = await incidentService.transitionner(ID_INCIDENT, 'EN_COURS');
    expect(transitionner).toHaveBeenCalledWith(ID_INCIDENT, 'DECLARE', 'EN_COURS');
    expect(resultat.statut).toBe('EN_COURS');
  });

  it('EN_COURS → RESOLU est une transition valide', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('EN_COURS'));
    const transitionner = vi
      .spyOn(incidentRepository, 'transitionnerSiStatut')
      .mockResolvedValue(incident('RESOLU'));
    await incidentService.transitionner(ID_INCIDENT, 'RESOLU');
    expect(transitionner).toHaveBeenCalledWith(ID_INCIDENT, 'EN_COURS', 'RESOLU');
  });

  it("refuse un saut d'étape DECLARE → RESOLU (RM-11), sans écriture", async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('DECLARE'));
    const transitionner = vi.spyOn(incidentRepository, 'transitionnerSiStatut');
    await expect(incidentService.transitionner(ID_INCIDENT, 'RESOLU')).rejects.toBeInstanceOf(
      TransitionInvalideError,
    );
    expect(transitionner).not.toHaveBeenCalled();
  });

  it('refuse tout retour en arrière depuis RESOLU (RM-13, état terminal), sans écriture', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('RESOLU'));
    const transitionner = vi.spyOn(incidentRepository, 'transitionnerSiStatut');
    await expect(incidentService.transitionner(ID_INCIDENT, 'EN_COURS')).rejects.toBeInstanceOf(
      TransitionInvalideError,
    );
    expect(transitionner).not.toHaveBeenCalled();
  });

  it('refuse une transition répétée EN_COURS → EN_COURS (pas un no-op valide)', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('EN_COURS'));
    const transitionner = vi.spyOn(incidentRepository, 'transitionnerSiStatut');
    await expect(incidentService.transitionner(ID_INCIDENT, 'EN_COURS')).rejects.toBeInstanceOf(
      TransitionInvalideError,
    );
    expect(transitionner).not.toHaveBeenCalled();
  });

  it('refuse un incident inconnu', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(null);
    await expect(incidentService.transitionner(ID_INCIDENT, 'EN_COURS')).rejects.toBeInstanceOf(
      IncidentIntrouvableError,
    );
  });

  it("refuse si une requête concurrente a déjà changé le statut entre la lecture et l'écriture", async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(incident('DECLARE'));
    vi.spyOn(incidentRepository, 'transitionnerSiStatut').mockResolvedValue(null);
    await expect(incidentService.transitionner(ID_INCIDENT, 'EN_COURS')).rejects.toBeInstanceOf(
      TransitionInvalideError,
    );
  });
});
