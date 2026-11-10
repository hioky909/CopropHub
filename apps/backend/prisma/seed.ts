/* eslint-disable no-console -- script CLI : la sortie console est son interface */
import { PrismaClient } from '@prisma/client';
import { lireConfigurationSeed } from '../src/seed/configuration.js';

/**
 * Amorce l'immeuble unique du MVP (cf. Doc 2 § Périmètre : mono-immeuble)
 * et un compte syndic. À exécuter une seule fois après la première
 * migration (`npm run prisma:migrate:deploy && npx tsx prisma/seed.ts`).
 * Ce script n'écrit que des comptes/de la structure, jamais de données
 * métier fictives (AG, votes, incidents) — conformément au principe « pas d'anticipation ».
 *
 * Configuration par variables `SEED_IMMEUBLE_NOM`, `SEED_IMMEUBLE_ADRESSE`, `SEED_SYNDIC_NOM`,
 * `SEED_SYNDIC_EMAIL`, `SEED_SYNDIC_MOT_DE_PASSE` : valeurs de développement par défaut, mais
 * OBLIGATOIRES en production (`NODE_ENV=production`), où le mot de passe par défaut est refusé.
 */

const prisma = new PrismaClient();

async function main() {
  const configuration = lireConfigurationSeed(process.env);
  const immeubleExistant = await prisma.immeuble.findFirst();
  if (immeubleExistant) {
    console.log('Immeuble déjà initialisé, rien à faire.');
    return;
  }

  const immeuble = await prisma.immeuble.create({
    data: { nom: configuration.immeuble.nom, adresse: configuration.immeuble.adresse },
  });
  console.log(`Immeuble créé : ${immeuble.nom} (${immeuble.id})`);

  const motDePasseHash = await import('bcrypt').then((bcrypt) =>
    bcrypt.hash(configuration.syndic.motDePasse, 12),
  );
  const syndic = await prisma.utilisateur.create({
    data: {
      nom: configuration.syndic.nom,
      email: configuration.syndic.email,
      motDePasseHash,
      typeCompte: 'SYNDIC',
    },
  });
  console.log(
    `Compte syndic créé : ${syndic.email}${process.env.NODE_ENV === 'production' ? '' : ' (mot de passe de développement, à changer)'}.`,
  );
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
