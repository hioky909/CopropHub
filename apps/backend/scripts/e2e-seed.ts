import { prisma } from '../src/repositories/prisma-client.js';
import { motDePasseService } from '../src/services/mot-de-passe.service.js';

/**
 * Amorce une base réelle pour les tests E2E Playwright (T-17) : mêmes
 * comptes/mot de passe à chaque exécution, pour que les specs puissent se
 * connecter par le vrai formulaire de connexion (contrairement aux tests
 * d'intégration, qui contournent la connexion via un cookie de session
 * signé directement — cf. `src/integration/support.ts`).
 *
 * Protégé comme les tests d'intégration : refuse de s'exécuter si
 * `DATABASE_URL` ne pointe pas vers une base dont le nom finit par `_test`.
 */

const url = process.env.DATABASE_URL ?? '';
const nomBase = url.split('/').pop()?.split('?')[0] ?? '';
if (!nomBase.endsWith('_test')) {
  throw new Error(
    `e2e-seed refuse de s'exécuter : DATABASE_URL doit pointer vers une base dont le nom finit par "_test" (base actuelle : "${nomBase || '(vide)'}").`,
  );
}

export const E2E_SYNDIC = {
  email: 'e2e-syndic@coprophub.local',
  motDePasse: 'un-mot-de-passe-e2e-syndic-1',
};
export const E2E_COPRO = {
  email: 'e2e-copro@coprophub.local',
  motDePasse: 'un-mot-de-passe-e2e-copro-1',
};
export const E2E_LOT_NUMERO = 'E2E-1';
export const E2E_CHARGE_PERIODE = '2026-E2E';

async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE vote, resolution, ag, rattachement, charge, incident, lot, immeuble, utilisateur RESTART IDENTITY CASCADE',
  );

  const immeuble = await prisma.immeuble.create({
    data: { nom: 'Résidence E2E', adresse: '1 rue du Test E2E, 75000 Paris' },
  });

  await prisma.utilisateur.create({
    data: {
      nom: 'Syndic E2E',
      email: E2E_SYNDIC.email,
      motDePasseHash: await motDePasseService.hacher(E2E_SYNDIC.motDePasse),
      typeCompte: 'SYNDIC',
    },
  });

  const copro = await prisma.utilisateur.create({
    data: {
      nom: 'Copropriétaire E2E',
      email: E2E_COPRO.email,
      motDePasseHash: await motDePasseService.hacher(E2E_COPRO.motDePasse),
      typeCompte: 'COPROPRIETAIRE',
    },
  });

  const lot = await prisma.lot.create({
    data: { idImmeuble: immeuble.id, numero: E2E_LOT_NUMERO, typeLot: 'appartement' },
  });
  await prisma.rattachement.create({ data: { idLot: lot.id, idUtilisateur: copro.id } });
  await prisma.charge.create({
    data: { idLot: lot.id, montant: '150.00', periode: E2E_CHARGE_PERIODE, statut: 'A_PAYER' },
  });

  // eslint-disable-next-line no-console -- script CLI : la sortie console est son interface
  console.log('Base E2E amorcée : syndic, copropriétaire + lot rattaché + charge.');
}

main()
  .catch((erreur) => {
    // eslint-disable-next-line no-console -- script CLI
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
