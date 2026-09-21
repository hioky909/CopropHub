import { PrismaClient } from '@prisma/client';

/**
 * Amorce l'immeuble unique du MVP (cf. Doc 2 § Périmètre : mono-immeuble)
 * et un compte syndic. À exécuter une seule fois après la première
 * migration (`npm run prisma:migrate:deploy && npx tsx prisma/seed.ts`).
 * Ce script n'écrit que des comptes/de la structure, jamais de données
 * métier fictives (AG, votes, incidents) — conformément au principe « pas d'anticipation ».
 */

const prisma = new PrismaClient();

async function main() {
  const immeubleExistant = await prisma.immeuble.findFirst();
  if (immeubleExistant) {
    console.log('Immeuble déjà initialisé, rien à faire.');
    return;
  }

  const immeuble = await prisma.immeuble.create({
    data: { nom: 'Résidence Exemple', adresse: '1 rue Exemple, 75000 Paris' },
  });
  console.log(`Immeuble créé : ${immeuble.nom} (${immeuble.id})`);

  const motDePasseHash = await import('bcrypt').then((bcrypt) =>
    bcrypt.hash('changez-ce-mot-de-passe', 12),
  );
  const syndic = await prisma.utilisateur.create({
    data: {
      nom: 'Syndic par défaut',
      email: 'syndic@coprophub.local',
      motDePasseHash,
      typeCompte: 'SYNDIC',
    },
  });
  console.log(`Compte syndic créé : ${syndic.email} (mot de passe à changer immédiatement).`);
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
