import { afterEach, describe, expect, it, vi } from 'vitest';
import { agService, OrdreDuJourVideError } from './ag.service.js';
import { ImmeubleNonInitialiseError } from './lot.service.js';
import { agRepository } from '../repositories/ag.repository.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';

const IMMEUBLE = {
  id: '11111111-1111-4111-8111-111111111111',
  nom: 'Résidence Test',
  adresse: '1 rue du Test',
};
const DATE_AG = new Date('2026-10-15T00:00:00.000Z');
const RESOLUTIONS = [
  { libelle: 'Approbation des comptes', typeMajorite: 'SIMPLE' as const },
  { libelle: 'Ravalement de façade', typeMajorite: 'ABSOLUE' as const },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agService.creerAG (F-04, US-07)', () => {
  it("crée l'AG sur l'immeuble unique avec toutes les résolutions fournies", async () => {
    vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(IMMEUBLE);
    const creer = vi.spyOn(agRepository, 'creerAvecResolutions').mockResolvedValue({
      id: 'ag-1',
      idImmeuble: IMMEUBLE.id,
      dateAg: DATE_AG,
      statut: 'PLANIFIEE',
      resolutions: [],
    });

    const ag = await agService.creerAG({ dateAg: DATE_AG, resolutions: RESOLUTIONS });

    expect(creer).toHaveBeenCalledTimes(1);
    expect(creer).toHaveBeenCalledWith(IMMEUBLE.id, DATE_AG, RESOLUTIONS);
    expect(ag.statut).toBe('PLANIFIEE'); // RM-05 : l'AG naît planifiée
  });

  it("refuse une AG sans résolution et n'écrit rien en base", async () => {
    const unique = vi.spyOn(immeubleRepository, 'unique');
    const creer = vi.spyOn(agRepository, 'creerAvecResolutions');

    await expect(agService.creerAG({ dateAg: DATE_AG, resolutions: [] })).rejects.toBeInstanceOf(
      OrdreDuJourVideError,
    );
    expect(unique).not.toHaveBeenCalled();
    expect(creer).not.toHaveBeenCalled();
  });

  it("échoue explicitement si aucun immeuble n'est initialisé, sans créer d'AG", async () => {
    vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(null);
    const creer = vi.spyOn(agRepository, 'creerAvecResolutions');

    await expect(
      agService.creerAG({ dateAg: DATE_AG, resolutions: RESOLUTIONS }),
    ).rejects.toBeInstanceOf(ImmeubleNonInitialiseError);
    expect(creer).not.toHaveBeenCalled();
  });
});
