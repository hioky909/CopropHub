import type { StatutAG, TypeCompte, TypeMajorite } from '@prisma/client';
import { prisma } from '../repositories/prisma-client.js';
import { sessionService } from '../services/session.service.js';

/**
 * Outils communs aux tests d'intégration. Ce fichier accède directement à
 * Prisma pour préparer et inspecter la base ; c'est acceptable ici (jamais
 * dans le code applicatif, où seul `repositories/` importe Prisma).
 */
export { prisma };

const HASH_NON_UTILISABLE = '$2b$12$hashquinepermetaucuneconnexionxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/** Vide toutes les tables métier. Protégé par `setup.ts` (base `_test` uniquement). */
export async function viderBase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE vote, resolution, ag, rattachement, charge, incident, lot, immeuble, utilisateur RESTART IDENTITY CASCADE',
  );
}

export function creerImmeuble() {
  return prisma.immeuble.create({
    data: { nom: 'Résidence Test', adresse: '1 rue du Test, 75000 Paris' },
  });
}

let compteur = 0;

export function creerUtilisateur(
  options: { typeCompte?: TypeCompte; email?: string; conseilSyndical?: boolean } = {},
) {
  compteur += 1;
  return prisma.utilisateur.create({
    data: {
      nom: `Utilisateur ${compteur}`,
      email: options.email ?? `utilisateur${compteur}@test.local`,
      motDePasseHash: HASH_NON_UTILISABLE,
      typeCompte: options.typeCompte ?? 'COPROPRIETAIRE',
      estMembreConseilSyndical: options.conseilSyndical ?? false,
    },
  });
}

/** Crée un lot dans l'immeuble et, si `idUtilisateur` est fourni, le rattache activement. */
export async function creerLot(idImmeuble: string, numero: string, idUtilisateur?: string) {
  const lot = await prisma.lot.create({ data: { idImmeuble, numero, typeLot: 'appartement' } });
  if (idUtilisateur) {
    await prisma.rattachement.create({ data: { idLot: lot.id, idUtilisateur } });
  }
  return lot;
}

/** Copropriétaire habilité à voter : compte + lot rattaché. */
export async function creerCoproprietaireHabilite(idImmeuble: string, numeroLot: string) {
  const utilisateur = await creerUtilisateur();
  await creerLot(idImmeuble, numeroLot, utilisateur.id);
  return utilisateur;
}

export function creerAg(
  idImmeuble: string,
  statut: StatutAG,
  resolutions: { libelle: string; typeMajorite: TypeMajorite }[],
) {
  return prisma.aG.create({
    data: {
      idImmeuble,
      dateAg: new Date('2026-10-15T00:00:00.000Z'),
      statut,
      resolutions: { create: resolutions },
    },
    include: { resolutions: true },
  });
}

/** Cookie de session réellement signé pour cet utilisateur (même mécanisme que la connexion). */
export function cookieSession(idUtilisateur: string): string {
  return `session=${sessionService.emettreJeton(idUtilisateur)}`;
}
