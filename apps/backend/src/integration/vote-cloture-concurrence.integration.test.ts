import { beforeAll, describe, expect, it } from 'vitest';
import { agService } from '../services/ag.service.js';
import { voteService, AgNonOuverteError } from '../services/vote.service.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';
import {
  creerAg,
  creerCoproprietaireHabilite,
  creerImmeuble,
  prisma,
  viderBase,
} from './support.js';

/**
 * RM-04 sous concurrence : des votes arrivent PENDANT la clôture. Invariant
 * à tenir dans tous les cas :
 *   - aucun vote accepté (succès) n'échappe au décompte de la clôture ;
 *   - aucun vote n'est ajouté à une AG déjà clôturée ;
 *   - le résultat figé est exactement celui que donne le décompte final.
 *
 * La résolution est de type UNANIMITÉ avec 12 inscrits qui votent tous
 * « oui » : elle n'est adoptée que si les 12 votes sont comptés, donc un
 * seul vote raté par la clôture change le résultat et fait échouer le test.
 *
 * Entrelacement : les 12 votes et la clôture démarrent à des instants
 * aléatoires d'une fenêtre de 20 ms. (Lancés dans le même instant, les
 * résultats étaient bimodaux, tout accepté ou tout refusé, et la course
 * n'était pas exercée : le test vérifie d'ailleurs qu'elle l'est.)
 * Test probabiliste : il détecte une course, il ne peut pas prouver son absence.
 */
const INSCRITS = 12;
const ITERATIONS = 80;

let votants: UtilisateurAuthentifie[];
let idImmeuble: string;

// Fenêtre (ms) dans laquelle les 12 votes et la clôture démarrent au hasard.
const FENETRE_MS = 20;
const attendre = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  await viderBase();
  const immeuble = await creerImmeuble();
  idImmeuble = immeuble.id;
  const crees = await Promise.all(
    Array.from({ length: INSCRITS }, (_, i) =>
      creerCoproprietaireHabilite(immeuble.id, `L${i + 1}`),
    ),
  );
  votants = crees.map((u) => ({
    id: u.id,
    email: u.email,
    typeCompte: u.typeCompte,
    estMembreConseilSyndical: u.estMembreConseilSyndical,
  }));
});

describe('vote et clôture simultanés (RM-04)', () => {
  it(`${ITERATIONS} clôtures lancées au milieu de ${INSCRITS} votes : aucun vote perdu ni ajouté après coup`, async () => {
    let acceptes = 0;
    let refuses = 0;
    let iterationsMixtes = 0;

    for (let i = 0; i < ITERATIONS; i += 1) {
      const ag = await creerAg(idImmeuble, 'OUVERTE', [
        { libelle: `R${i}`, typeMajorite: 'UNANIMITE' },
      ]);
      const idResolution = ag.resolutions[0]!.id;

      // Chaque vote et la clôture partent à un instant aléatoire de la fenêtre :
      // la clôture tombe ainsi tantôt avant, tantôt au milieu, tantôt après les votes.
      const aleatoire = () => attendre(Math.random() * FENETRE_MS);
      const votes = votants.map((votant) =>
        aleatoire()
          .then(() => voteService.voter(votant, idResolution, 'OUI'))
          .then(
            () => 'ACCEPTE' as const,
            (erreur: unknown) => {
              if (erreur instanceof AgNonOuverteError) return 'REFUSE' as const;
              throw erreur;
            },
          ),
      );
      const cloture = aleatoire().then(() => agService.cloturer(ag.id));

      const [issues] = await Promise.all([Promise.all(votes), cloture]);

      const nbAcceptes = issues.filter((x) => x === 'ACCEPTE').length;
      acceptes += nbAcceptes;
      refuses += issues.length - nbAcceptes;
      if (nbAcceptes > 0 && nbAcceptes < INSCRITS) iterationsMixtes += 1;

      // 1) Les votes en base sont exactement ceux qui ont été acceptés.
      expect(await prisma.vote.count({ where: { idResolution } }), `itération ${i}`).toBe(
        nbAcceptes,
      );

      // 2) Le résultat figé correspond au décompte final (unanimité : 12/12 requis).
      const figee = await prisma.resolution.findUniqueOrThrow({ where: { id: idResolution } });
      expect(figee.statutResultat, `itération ${i}`).toBe(
        nbAcceptes === INSCRITS ? 'ADOPTEE' : 'REJETEE',
      );
      expect((await prisma.aG.findUniqueOrThrow({ where: { id: ag.id } })).statut).toBe('CLOTUREE');
    }

    // Preuve que le test exerce bien la course : des votes acceptés ET refusés
    // dans une même itération.
    // eslint-disable-next-line no-console -- affichage volontaire : preuve que la course est exercée
    console.info(
      `[concurrence] votes acceptés=${acceptes}, refusés=${refuses}, itérations où la clôture est tombée au milieu des votes=${iterationsMixtes}/${ITERATIONS}`,
    );
    expect(acceptes + refuses).toBe(INSCRITS * ITERATIONS);
    expect(
      iterationsMixtes,
      "le test n'exerce pas la course (clôture trop rarement au milieu des votes)",
    ).toBeGreaterThanOrEqual(ITERATIONS / 8);
  });
});
