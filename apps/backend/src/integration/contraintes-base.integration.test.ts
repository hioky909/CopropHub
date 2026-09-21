import { beforeEach, describe, expect, it } from 'vitest';
import {
  creerAg,
  creerImmeuble,
  creerLot,
  creerUtilisateur,
  prisma,
  viderBase,
} from './support.js';

/**
 * T-03 — les contraintes que le MPD (Doc 3) impose à la base sont-elles
 * réellement appliquées par PostgreSQL ? (migration 0001_init écrite à la
 * main pour l'index unique partiel et les CHECK.)
 */
beforeEach(viderBase);

describe('contraintes de la base (MPD)', () => {
  it('email unique sur utilisateur', async () => {
    await creerUtilisateur({ email: 'doublon@test.local' });
    await expect(creerUtilisateur({ email: 'doublon@test.local' })).rejects.toThrow();
  });

  it('CHECK chk_conseil_syndical_coproprietaire : un compte SYNDIC ne peut pas être membre du conseil syndical', async () => {
    await expect(creerUtilisateur({ typeCompte: 'SYNDIC', conseilSyndical: true })).rejects.toThrow(
      /chk_conseil_syndical_coproprietaire/,
    );
    // ... alors qu'un copropriétaire peut l'être.
    await expect(
      creerUtilisateur({ typeCompte: 'COPROPRIETAIRE', conseilSyndical: true }),
    ).resolves.toBeDefined();
  });

  it("index unique partiel : un lot ne peut avoir qu'un seul rattachement ACTIF", async () => {
    const immeuble = await creerImmeuble();
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1', a.id);

    await expect(
      prisma.rattachement.create({ data: { idLot: lot.id, idUtilisateur: b.id } }),
    ).rejects.toThrow(/idx_rattachement_actif_unique|Unique constraint/);
  });

  it("l'index partiel autorise l'historique : un ancien rattachement clôturé n'empêche pas un nouveau", async () => {
    const immeuble = await creerImmeuble();
    const a = await creerUtilisateur();
    const b = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1');

    await prisma.rattachement.create({
      data: {
        idLot: lot.id,
        idUtilisateur: a.id,
        dateDebut: new Date('2025-01-01'),
        dateFin: new Date('2025-06-01'),
      },
    });
    await expect(
      prisma.rattachement.create({ data: { idLot: lot.id, idUtilisateur: b.id } }),
    ).resolves.toBeDefined();
  });

  it('CHECK chk_periode : date_fin doit être strictement postérieure à date_debut', async () => {
    const immeuble = await creerImmeuble();
    const a = await creerUtilisateur();
    const lot = await creerLot(immeuble.id, '1');

    await expect(
      prisma.rattachement.create({
        data: {
          idLot: lot.id,
          idUtilisateur: a.id,
          dateDebut: new Date('2025-03-01'),
          dateFin: new Date('2025-03-01'),
        },
      }),
    ).rejects.toThrow(/chk_periode/);
  });

  it('unicité (immeuble, numéro) sur lot', async () => {
    const immeuble = await creerImmeuble();
    await creerLot(immeuble.id, '12');
    await expect(creerLot(immeuble.id, '12')).rejects.toThrow();
  });

  it('vote : clé primaire composite (résolution, utilisateur) — RM-02', async () => {
    const immeuble = await creerImmeuble();
    const votant = await creerUtilisateur();
    const ag = await creerAg(immeuble.id, 'OUVERTE', [{ libelle: 'R1', typeMajorite: 'SIMPLE' }]);
    const idResolution = ag.resolutions[0]!.id;

    await prisma.vote.create({ data: { idResolution, idUtilisateur: votant.id, valeur: 'OUI' } });
    await expect(
      prisma.vote.create({ data: { idResolution, idUtilisateur: votant.id, valeur: 'NON' } }),
    ).rejects.toThrow(/Unique constraint|duplicate key/);
  });

  it('valeurs par défaut : AG planifiée (RM-05), résolution en attente', async () => {
    const immeuble = await creerImmeuble();
    const ag = await prisma.aG.create({
      data: {
        idImmeuble: immeuble.id,
        dateAg: new Date('2026-10-15'),
        resolutions: { create: [{ libelle: 'R1', typeMajorite: 'UNANIMITE' }] },
      },
      include: { resolutions: true },
    });
    expect(ag.statut).toBe('PLANIFIEE');
    expect(ag.resolutions[0]?.statutResultat).toBe('EN_ATTENTE');
  });
});
