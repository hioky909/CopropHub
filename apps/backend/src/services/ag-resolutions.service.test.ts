import { afterEach, describe, expect, it, vi } from 'vitest';
import { agService, AgIntrouvableError, ResolutionsNonDisponiblesError } from './ag.service.js';
import { agRepository } from '../repositories/ag.repository.js';

const ID_AG = '55555555-5555-4555-8555-555555555555';
const DATE_AG = new Date('2026-10-15T00:00:00.000Z');

function agAvecDecomptes(statut: 'PLANIFIEE' | 'OUVERTE' | 'CLOTUREE') {
  return {
    id: ID_AG,
    idImmeuble: 'imm-1',
    dateAg: DATE_AG,
    statut,
    nombreInscritsGeles: null,
    resolutions: [
      {
        id: 'r-1',
        idAg: ID_AG,
        libelle: 'Approbation des comptes',
        typeMajorite: 'SIMPLE' as const,
        statutResultat: statut === 'CLOTUREE' ? ('ADOPTEE' as const) : ('EN_ATTENTE' as const),
        decomptes: { oui: 3, non: 1, abstention: 0 },
      },
    ],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('agService.listerAgs (T-11, F-07)', () => {
  it('délègue au dépôt', async () => {
    const lister = vi
      .spyOn(agRepository, 'listerToutes')
      .mockResolvedValue([{ ...agAvecDecomptes('CLOTUREE'), _count: { resolutions: 1 } }]);
    const ags = await agService.listerAgs();
    expect(lister).toHaveBeenCalledTimes(1);
    expect(ags).toHaveLength(1);
  });
});

describe('agService.consulterResolutions (T-11, F-07, US-04)', () => {
  it("renvoie les décomptes anonymes d'une AG clôturée", async () => {
    vi.spyOn(agRepository, 'avecResolutionsEtDecomptes').mockResolvedValue(
      agAvecDecomptes('CLOTUREE'),
    );
    const resultat = await agService.consulterResolutions(ID_AG);
    expect(resultat.resolutions[0]?.decomptes).toEqual({ oui: 3, non: 1, abstention: 0 });
    // US-04 : jamais l'identité d'un votant dans la réponse.
    expect(JSON.stringify(resultat)).not.toMatch(/idUtilisateur|votant/i);
  });

  it('refuse une AG inconnue', async () => {
    vi.spyOn(agRepository, 'avecResolutionsEtDecomptes').mockResolvedValue(null);
    await expect(agService.consulterResolutions(ID_AG)).rejects.toBeInstanceOf(AgIntrouvableError);
  });

  it.each(['PLANIFIEE', 'OUVERTE'] as const)(
    "refuse tant que l'AG est %s (les décomptes en cours ne doivent pas influencer les votants)",
    async (statut) => {
      vi.spyOn(agRepository, 'avecResolutionsEtDecomptes').mockResolvedValue(
        agAvecDecomptes(statut),
      );
      await expect(agService.consulterResolutions(ID_AG)).rejects.toBeInstanceOf(
        ResolutionsNonDisponiblesError,
      );
    },
  );
});
