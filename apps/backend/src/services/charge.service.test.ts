import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { chargeService, ChargeIntrouvableError, AccesChargeRefuseError } from './charge.service.js';
import { chargeRepository } from '../repositories/charge.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

const LOT_A = { id: 'lot-a', idImmeuble: 'imm-1', numero: '1', typeLot: 'appartement' };
const CHARGE_LOT_A = {
  id: 'charge-1',
  idLot: LOT_A.id,
  montant: new Prisma.Decimal('150.00'),
  periode: '2026-T1',
  statut: 'A_PAYER' as const,
};
const CHARGE_AUTRE_LOT = { ...CHARGE_LOT_A, id: 'charge-2', idLot: 'lot-autrui' };

const SYNDIC: UtilisateurAuthentifie = {
  id: 'u-syndic',
  email: 'syndic@test.local',
  typeCompte: 'SYNDIC',
  estMembreConseilSyndical: false,
};
const COPRO: UtilisateurAuthentifie = { ...SYNDIC, id: 'u-copro-a', typeCompte: 'COPROPRIETAIRE' };
const CONSEIL: UtilisateurAuthentifie = { ...COPRO, id: 'u-conseil', estMembreConseilSyndical: true };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chargeService.lister (T-14, F-09, US-01, US-05, RM-10)', () => {
  it('renvoie toutes les charges pour le syndic', async () => {
    const toutes = vi.spyOn(chargeRepository, 'listerToutes').mockResolvedValue([CHARGE_LOT_A]);
    const pourLots = vi.spyOn(chargeRepository, 'listerPourLots');
    const resultat = await chargeService.lister(SYNDIC);
    expect(toutes).toHaveBeenCalledTimes(1);
    expect(pourLots).not.toHaveBeenCalled();
    expect(resultat).toHaveLength(1);
  });

  it('renvoie toutes les charges pour un membre du conseil syndical (US-05 : pas seulement les miennes)', async () => {
    const toutes = vi.spyOn(chargeRepository, 'listerToutes').mockResolvedValue([]);
    await chargeService.lister(CONSEIL);
    expect(toutes).toHaveBeenCalledTimes(1);
  });

  it('renvoie uniquement les charges des lots rattachés à un copropriétaire ordinaire', async () => {
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
    const pourLots = vi.spyOn(chargeRepository, 'listerPourLots').mockResolvedValue([CHARGE_LOT_A]);
    await chargeService.lister(COPRO);
    expect(pourLots).toHaveBeenCalledWith([LOT_A.id]);
  });

  it('renvoie une liste vide (pas une erreur) pour un copropriétaire sans lot rattaché', async () => {
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    const pourLots = vi.spyOn(chargeRepository, 'listerPourLots');
    const resultat = await chargeService.lister(COPRO);
    expect(resultat).toEqual([]);
    expect(pourLots).not.toHaveBeenCalled();
  });
});

describe("chargeService.voirUne (T-14, US-01 — 403 explicite sur la charge d'un autre lot)", () => {
  it('le syndic consulte une charge quel que soit le lot', async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE_AUTRE_LOT);
    const charge = await chargeService.voirUne(SYNDIC, CHARGE_AUTRE_LOT.id);
    expect(charge.id).toBe(CHARGE_AUTRE_LOT.id);
  });

  it('un membre du conseil syndical consulte une charge qui ne lui appartient pas', async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE_AUTRE_LOT);
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    await expect(chargeService.voirUne(CONSEIL, CHARGE_AUTRE_LOT.id)).resolves.toBeDefined();
  });

  it('un copropriétaire consulte la charge de son propre lot', async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE_LOT_A);
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
    await expect(chargeService.voirUne(COPRO, CHARGE_LOT_A.id)).resolves.toBeDefined();
  });

  it("403 (cas de référence IDOR/BOLA) pour la charge d'un lot qui n'appartient pas au copropriétaire", async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE_AUTRE_LOT);
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([LOT_A]);
    await expect(chargeService.voirUne(COPRO, CHARGE_AUTRE_LOT.id)).rejects.toBeInstanceOf(
      AccesChargeRefuseError,
    );
  });

  it('404 pour une charge inconnue', async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(null);
    await expect(chargeService.voirUne(COPRO, 'charge-inconnue')).rejects.toBeInstanceOf(
      ChargeIntrouvableError,
    );
  });
});
