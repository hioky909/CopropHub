import { afterEach, describe, expect, it, vi } from 'vitest';
import { agService, AgIntrouvableError, OuvertureAgImpossibleError } from './ag.service.js';
import { agRepository } from '../repositories/ag.repository.js';

const ID_AG = '33333333-3333-4333-8333-333333333333';
const DATE_AG = new Date('2026-10-15T00:00:00.000Z');

function ag(statut: 'PLANIFIEE' | 'OUVERTE' | 'CLOTUREE') {
  return { id: ID_AG, idImmeuble: 'imm-1', dateAg: DATE_AG, statut };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agService.ouvrirVote (transition PLANIFIEE → OUVERTE)', () => {
  it('ouvre une AG planifiée', async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(ag('PLANIFIEE'));
    const ouvrir = vi.spyOn(agRepository, 'ouvrirSiPlanifiee').mockResolvedValue(ag('OUVERTE'));

    const resultat = await agService.ouvrirVote(ID_AG);

    expect(ouvrir).toHaveBeenCalledWith(ID_AG);
    expect(resultat.statut).toBe('OUVERTE');
  });

  it('refuse une AG inconnue, sans écriture', async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(null);
    const ouvrir = vi.spyOn(agRepository, 'ouvrirSiPlanifiee');
    await expect(agService.ouvrirVote(ID_AG)).rejects.toBeInstanceOf(AgIntrouvableError);
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it.each(['OUVERTE', 'CLOTUREE'] as const)(
    'refuse une AG déjà %s (CLOTUREE est terminale, RM-04), sans écriture',
    async (statut) => {
      vi.spyOn(agRepository, 'parId').mockResolvedValue(ag(statut));
      const ouvrir = vi.spyOn(agRepository, 'ouvrirSiPlanifiee');
      await expect(agService.ouvrirVote(ID_AG)).rejects.toBeInstanceOf(OuvertureAgImpossibleError);
      expect(ouvrir).not.toHaveBeenCalled();
    },
  );

  it("refuse si une requête concurrente a ouvert l'AG entre la lecture et l'écriture", async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(ag('PLANIFIEE'));
    vi.spyOn(agRepository, 'ouvrirSiPlanifiee').mockResolvedValue(null);
    await expect(agService.ouvrirVote(ID_AG)).rejects.toBeInstanceOf(OuvertureAgImpossibleError);
  });
});
