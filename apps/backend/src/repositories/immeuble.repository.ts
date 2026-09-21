import { prisma } from './prisma-client.js';

/**
 * MVP mono-immeuble (cf. Doc 2 § Périmètre) : une seule ligne existe dans
 * `immeuble`, créée par le script de seed (`prisma/seed.ts`). Il n'y a
 * volontairement pas d'endpoint de création d'immeuble au MVP — en ajouter
 * un préparerait un multi-immeuble hors périmètre verrouillé.
 */
export const immeubleRepository = {
  unique() {
    return prisma.immeuble.findFirst();
  },
};
