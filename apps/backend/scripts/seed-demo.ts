/* eslint-disable no-console -- script CLI : la sortie console est son interface */
import { prisma } from '../src/repositories/prisma-client.js';
import { motDePasseService } from '../src/services/mot-de-passe.service.js';
import { calculerResultat } from '../src/services/resultat-calculateur.js';

/**
 * Peuple des données de DÉMONSTRATION réalistes (pas de la donnée réelle,
 * pas destiné à la production) : plusieurs copropriétaires, lots, charges,
 * incidents à différents statuts, et trois AG à trois stades différents
 * (planifiée / ouverte avec des votes déjà exprimés / clôturée avec un
 * résultat réellement calculé par le moteur métier, pas inventé à la main).
 *
 * Séparé du seed principal (`prisma/seed.ts`), qui reste volontairement
 * minimal (immeuble + syndic uniquement) — celui-ci est explicitement un
 * jeu de démonstration, à lancer après `npm run prisma:seed`.
 *
 * S'ajoute aux données existantes (n'efface rien) : les numéros de lot
 * utilisés commencent à 10 pour ne jamais entrer en collision avec un lot
 * déjà créé manuellement.
 */

const MOT_DE_PASSE_DEMO = 'mot-de-passe-demo-1';

async function main() {
  const immeuble = await prisma.immeuble.findFirst();
  if (!immeuble) {
    throw new Error("Aucun immeuble trouvé : exécuter d'abord `npm run prisma:seed`.");
  }

  const copros = [
    {
      numero: '10',
      nom: 'Claire Dupont',
      email: 'claire.dupont@demo.local',
      conseilSyndical: true,
    },
    {
      numero: '11',
      nom: 'Pierre Martin',
      email: 'pierre.martin@demo.local',
      conseilSyndical: false,
    },
    { numero: '12', nom: 'Sophie Leroy', email: 'sophie.leroy@demo.local', conseilSyndical: false },
    { numero: '13', nom: 'Luc Bernard', email: 'luc.bernard@demo.local', conseilSyndical: false },
    {
      numero: '14',
      nom: 'Anne Rousseau',
      email: 'anne.rousseau@demo.local',
      conseilSyndical: false,
    },
    { numero: '15', nom: 'Thomas Petit', email: 'thomas.petit@demo.local', conseilSyndical: false },
  ];

  const utilisateurs: { id: string; email: string }[] = [];
  const lots: { id: string; numero: string; idUtilisateur: string }[] = [];

  for (const c of copros) {
    const utilisateur = await prisma.utilisateur.create({
      data: {
        nom: c.nom,
        email: c.email,
        motDePasseHash: await motDePasseService.hacher(MOT_DE_PASSE_DEMO),
        typeCompte: 'COPROPRIETAIRE',
        estMembreConseilSyndical: c.conseilSyndical,
      },
    });
    const lot = await prisma.lot.create({
      data: { idImmeuble: immeuble.id, numero: c.numero, typeLot: 'appartement' },
    });
    await prisma.rattachement.create({ data: { idLot: lot.id, idUtilisateur: utilisateur.id } });
    utilisateurs.push({ id: utilisateur.id, email: utilisateur.email });
    lots.push({ id: lot.id, numero: lot.numero, idUtilisateur: utilisateur.id });
  }
  console.log(`${copros.length} copropriétaires + lots créés (dont 1 membre du conseil syndical).`);

  // Charges — un mix réaliste de statuts sur 2 périodes.
  const statutsCharges: Array<'A_PAYER' | 'PAYEE' | 'EN_RETARD'> = [
    'PAYEE',
    'PAYEE',
    'A_PAYER',
    'EN_RETARD',
    'PAYEE',
    'A_PAYER',
  ];
  for (const [i, lot] of lots.entries()) {
    await prisma.charge.create({
      data: {
        idLot: lot.id,
        montant: (350 + i * 47).toFixed(2),
        periode: '2026-T3',
        // eslint-disable-next-line security/detect-object-injection -- script de démo local (npm run demo:seed), `i` est l'index de boucle sur `lots`.
        statut: statutsCharges[i]!,
      },
    });
    await prisma.charge.create({
      data: {
        idLot: lot.id,
        montant: (350 + i * 47).toFixed(2),
        periode: '2026-T2',
        statut: 'PAYEE',
      },
    });
  }
  console.log(`${lots.length * 2} charges créées.`);

  // Incidents — un par statut, répartis entre lots et partie commune.
  await prisma.incident.create({
    data: {
      idImmeuble: immeuble.id,
      idLot: lots[0]!.id,
      idUtilisateurDeclarant: utilisateurs[0]!.id,
      titre: 'Infiltration dans la salle de bain',
      description:
        "Trace d'humidité sur le mur mitoyen avec le lot 11, apparue depuis une semaine.",
      statut: 'DECLARE',
    },
  });
  await prisma.incident.create({
    data: {
      idImmeuble: immeuble.id,
      idLot: null,
      idUtilisateurDeclarant: utilisateurs[1]!.id,
      titre: 'Ascenseur bloqué entre le 2e et le 3e étage',
      description: 'Prestataire contacté, intervention prévue sous 48h.',
      statut: 'EN_COURS',
    },
  });
  await prisma.incident.create({
    data: {
      idImmeuble: immeuble.id,
      idLot: null,
      idUtilisateurDeclarant: utilisateurs[2]!.id,
      titre: "Ampoule grillée dans le hall d'entrée",
      description: 'Remplacée par le gardien.',
      statut: 'RESOLU',
    },
  });
  await prisma.incident.create({
    data: {
      idImmeuble: immeuble.id,
      idLot: lots[3]!.id,
      idUtilisateurDeclarant: utilisateurs[3]!.id,
      titre: 'Interphone défectueux',
      description: "Ne sonne plus depuis l'installation du nouveau tableau électrique.",
      statut: 'DECLARE',
    },
  });
  console.log('4 incidents créés (statuts variés).');

  const nombreInscrits = lots.length; // tous les copropriétaires ci-dessus sont rattachés à un lot

  // AG 1 — clôturée, avec un résultat réellement calculé par le moteur métier.
  const agCloturee = await prisma.aG.create({
    data: {
      idImmeuble: immeuble.id,
      dateAg: new Date('2026-06-12T00:00:00.000Z'),
      statut: 'CLOTUREE',
      resolutions: {
        create: [
          { libelle: 'Approbation des comptes 2025', typeMajorite: 'SIMPLE' },
          { libelle: 'Ravalement de la façade principale', typeMajorite: 'ABSOLUE' },
        ],
      },
    },
    include: { resolutions: true },
  });

  const votesResolution1: Array<'OUI' | 'NON' | 'ABSTENTION'> = [
    'OUI',
    'OUI',
    'OUI',
    'NON',
    'ABSTENTION',
    'OUI',
  ];
  const votesResolution2: Array<'OUI' | 'NON' | 'ABSTENTION'> = [
    'OUI',
    'NON',
    'OUI',
    'NON',
    'NON',
    'OUI',
  ];
  for (const [resIndex, votes] of [votesResolution1, votesResolution2].entries()) {
    // eslint-disable-next-line security/detect-object-injection -- script de démo local, `resIndex` est l'index de boucle sur un tableau littéral de deux éléments.
    const resolution = agCloturee.resolutions[resIndex]!;
    const comptes = { oui: 0, non: 0, abstention: 0 };
    for (const [i, valeur] of votes.entries()) {
      await prisma.vote.create({
        // eslint-disable-next-line security/detect-object-injection -- `i` est l'index de boucle sur `votes`, tableau littéral local.
        data: { idResolution: resolution.id, idUtilisateur: utilisateurs[i]!.id, valeur },
      });
      if (valeur === 'OUI') comptes.oui += 1;
      else if (valeur === 'NON') comptes.non += 1;
      else comptes.abstention += 1;
    }
    const statutResultat = calculerResultat(resolution.typeMajorite, comptes, nombreInscrits);
    await prisma.resolution.update({ where: { id: resolution.id }, data: { statutResultat } });
  }
  console.log(
    'AG clôturée créée avec 2 résolutions, votes réels et résultats calculés par le moteur métier.',
  );

  // AG 2 — ouverte au vote, avec quelques votes déjà exprimés (pas tous, pour montrer un vote en cours).
  const agOuverte = await prisma.aG.create({
    data: {
      idImmeuble: immeuble.id,
      dateAg: new Date('2026-11-14T00:00:00.000Z'),
      statut: 'OUVERTE',
      resolutions: {
        create: [
          { libelle: 'Renouvellement du mandat du syndic pour 3 ans', typeMajorite: 'ABSOLUE' },
          {
            libelle: "Installation d'un système de vidéosurveillance dans le hall",
            typeMajorite: 'DOUBLE_MAJORITE',
          },
        ],
      },
    },
    include: { resolutions: true },
  });
  const votantsPartiels = utilisateurs.slice(0, 3);
  for (const resolution of agOuverte.resolutions) {
    for (const [i, u] of votantsPartiels.entries()) {
      await prisma.vote.create({
        data: { idResolution: resolution.id, idUtilisateur: u.id, valeur: i === 1 ? 'NON' : 'OUI' },
      });
    }
  }
  console.log('AG ouverte créée avec 2 résolutions, 3 copropriétaires sur 6 ont déjà voté.');

  // AG 3 — planifiée, pas encore ouverte.
  await prisma.aG.create({
    data: {
      idImmeuble: immeuble.id,
      dateAg: new Date('2027-03-20T00:00:00.000Z'),
      statut: 'PLANIFIEE',
      resolutions: {
        create: [{ libelle: "Budget prévisionnel de l'exercice 2027", typeMajorite: 'SIMPLE' }],
      },
    },
  });
  console.log('AG planifiée créée avec 1 résolution.');

  console.log('\nComptes de démonstration (mot de passe commun : ' + MOT_DE_PASSE_DEMO + ') :');
  for (const c of copros) {
    console.log(`  ${c.email}${c.conseilSyndical ? '  (conseil syndical)' : ''}`);
  }
}

main()
  .catch((erreur) => {
    console.error(erreur);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
