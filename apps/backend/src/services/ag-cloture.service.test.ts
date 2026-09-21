import { afterEach, describe, expect, it, vi } from 'vitest';
import { agService, AgIntrouvableError, ClotureAgImpossibleError } from './ag.service.js';
import { agRepository } from '../repositories/ag.repository.js';

const ID_AG = '44444444-4444-4444-8444-444444444444';
const DATE_AG = new Date('2026-10-15T00:00:00.000Z');

function ag(statut: 'PLANIFIEE' | 'OUVERTE' | 'CLOTUREE') {
  return { id: ID_AG, idImmeuble: 'imm-1', dateAg: DATE_AG, statut };
}

const AG_CLOTUREE = { ...ag('CLOTUREE'), resolutions: [] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agService.cloturer (US-08, RM-03, RM-04)', () => {
  it('clôture une AG ouverte via une écriture atomique unique', async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(ag('OUVERTE'));
    const cloturer = vi.spyOn(agRepository, 'cloturerAvecResultats').mockResolvedValue(AG_CLOTUREE);

    const resultat = await agService.cloturer(ID_AG);

    expect(cloturer).toHaveBeenCalledTimes(1);
    expect(cloturer.mock.calls[0]?.[0]).toBe(ID_AG);
    expect(resultat.statut).toBe('CLOTUREE');
  });

  it('branche le vrai calcul RM-03 : la fonction transmise au dépôt applique la règle de chaque type', async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(ag('OUVERTE'));
    let calculer!: Parameters<typeof agRepository.cloturerAvecResultats>[1];
    vi.spyOn(agRepository, 'cloturerAvecResultats').mockImplementation((_id, fn) => {
      calculer = fn;
      return Promise.resolve(AG_CLOTUREE);
    });

    await agService.cloturer(ID_AG);

    const comptes = { oui: 5, non: 0, abstention: 0 };
    // 5 oui sur 10 inscrits : simple → adoptée, absolue → rejetée (pile la moitié).
    expect(calculer({ typeMajorite: 'SIMPLE', comptes }, 10)).toBe('ADOPTEE');
    expect(calculer({ typeMajorite: 'ABSOLUE', comptes }, 10)).toBe('REJETEE');
    expect(calculer({ typeMajorite: 'UNANIMITE', comptes }, 5)).toBe('ADOPTEE');
  });

  it('refuse une AG inconnue, sans écriture', async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(null);
    const cloturer = vi.spyOn(agRepository, 'cloturerAvecResultats');
    await expect(agService.cloturer(ID_AG)).rejects.toBeInstanceOf(AgIntrouvableError);
    expect(cloturer).not.toHaveBeenCalled();
  });

  it.each(['PLANIFIEE', 'CLOTUREE'] as const)(
    "refuse une AG %s (il faut qu'elle soit ouverte ; CLOTUREE est immuable, RM-04), sans écriture",
    async (statut) => {
      vi.spyOn(agRepository, 'parId').mockResolvedValue(ag(statut));
      const cloturer = vi.spyOn(agRepository, 'cloturerAvecResultats');
      await expect(agService.cloturer(ID_AG)).rejects.toBeInstanceOf(ClotureAgImpossibleError);
      expect(cloturer).not.toHaveBeenCalled();
    },
  );

  it("refuse si une requête concurrente a déjà clôturé l'AG (le dépôt retourne null)", async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(ag('OUVERTE'));
    vi.spyOn(agRepository, 'cloturerAvecResultats').mockResolvedValue(null);
    await expect(agService.cloturer(ID_AG)).rejects.toBeInstanceOf(ClotureAgImpossibleError);
  });
});
