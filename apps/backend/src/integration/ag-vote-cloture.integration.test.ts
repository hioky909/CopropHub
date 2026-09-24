import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { agRepository } from '../repositories/ag.repository.js';
import {
  cookieSession,
  creerAg,
  creerCoproprietaireHabilite,
  creerImmeuble,
  creerUtilisateur,
  prisma,
  viderBase,
} from './support.js';

/**
 * T-08, T-38, T-09, T-10 sur une vraie base : création d'AG, ouverture du
 * vote, vote, calcul du résultat et clôture, avec de vrais décomptes.
 */
const app = createApp();

let immeuble: Awaited<ReturnType<typeof creerImmeuble>>;
let cookieSyndic: string;

beforeEach(async () => {
  await viderBase();
  immeuble = await creerImmeuble();
  const syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
  cookieSyndic = cookieSession(syndic.id);
});

const voter = (cookie: string, idResolution: string, valeur: string) =>
  request(app).post(`/resolutions/${idResolution}/votes`).set('Cookie', cookie).send({ valeur });

describe('parcours complet : création → ouverture → votes → clôture', () => {
  it('applique RM-01 à RM-07 et calcule chaque type de majorité (RM-03) sur des décomptes réels', async () => {
    // --- T-08 : création, statut planifiée (RM-05), résolutions typées (RM-01)
    const creation = await request(app)
      .post('/ags')
      .set('Cookie', cookieSyndic)
      .send({
        dateAg: '2026-10-15',
        resolutions: [
          { libelle: 'R1 simple', typeMajorite: 'SIMPLE' },
          { libelle: 'R2 absolue', typeMajorite: 'ABSOLUE' },
          { libelle: 'R3 double majorité', typeMajorite: 'DOUBLE_MAJORITE' },
          { libelle: 'R4 unanimité (un absent)', typeMajorite: 'UNANIMITE' },
          { libelle: 'R5 unanimité (tous oui)', typeMajorite: 'UNANIMITE' },
        ],
      });
    expect(creation.status).toBe(201);
    const idAg: string = creation.body.ag.id;
    const enBase = await prisma.aG.findUniqueOrThrow({
      where: { id: idAg },
      include: { resolutions: true },
    });
    expect(enBase.statut).toBe('PLANIFIEE');
    expect(enBase.dateAg.toISOString().slice(0, 10)).toBe('2026-10-15');
    expect(enBase.resolutions).toHaveLength(5);
    expect(enBase.resolutions.every((r) => r.statutResultat === 'EN_ATTENTE')).toBe(true);

    const id = (libelle: string): string =>
      enBase.resolutions.find((r) => r.libelle.startsWith(libelle))!.id;
    const [r1, r2, r3, r4, r5] = ['R1', 'R2', 'R3', 'R4', 'R5'].map(id) as [
      string,
      string,
      string,
      string,
      string,
    ];

    // --- 4 copropriétaires habilités (A à D) + E sans lot + le syndic
    const [a, b, c, d] = await Promise.all(
      ['1', '2', '3', '4'].map((numero) => creerCoproprietaireHabilite(immeuble.id, numero)),
    );
    const e = await creerUtilisateur(); // copropriétaire SANS lot
    const [ca, cb, cc, cd, ce] = [a!, b!, c!, d!, e].map((u) => cookieSession(u.id)) as [
      string,
      string,
      string,
      string,
      string,
    ];

    // --- RM-05 : aucun vote tant que l'AG est planifiée
    expect((await voter(ca, r1, 'OUI')).status).toBe(409);
    expect(await prisma.vote.count()).toBe(0);

    // --- T-38 : ouverture ; une seconde ouverture est refusée
    const ouverture = await request(app).post(`/ags/${idAg}/ouverture`).set('Cookie', cookieSyndic);
    expect(ouverture.status).toBe(200);
    expect(ouverture.body.ag.statut).toBe('OUVERTE');
    expect(
      (await request(app).post(`/ags/${idAg}/ouverture`).set('Cookie', cookieSyndic)).status,
    ).toBe(409);

    // --- RM-06 / RM-07 : E (sans lot) et le syndic ne votent pas
    expect((await voter(ce, r1, 'OUI')).status).toBe(403);
    expect((await voter(cookieSyndic, r1, 'OUI')).status).toBe(403);

    // --- T-09 : votes. N = 4 copropriétaires habilités.
    // R1 simple : 2 oui, 1 non, 1 abstention → adoptée (abstention exclue)
    // R2 absolue : 2 oui sur 4 = pile la moitié → rejetée
    // R3 double majorité : 3 oui sur 4 (≥ 2/3) → adoptée
    // R4 unanimité : 3 oui, D n'a pas voté → rejetée
    // R5 unanimité : 4 oui → adoptée (E, sans lot, n'est pas compté dans N)
    const bulletins: [string, string, string][] = [
      [ca, r1, 'OUI'],
      [cb, r1, 'OUI'],
      [cc, r1, 'NON'],
      [cd, r1, 'ABSTENTION'],
      [ca, r2, 'OUI'],
      [cb, r2, 'OUI'],
      [cc, r2, 'NON'],
      [cd, r2, 'NON'],
      [ca, r3, 'OUI'],
      [cb, r3, 'OUI'],
      [cc, r3, 'OUI'],
      [cd, r3, 'NON'],
      [ca, r4, 'OUI'],
      [cb, r4, 'OUI'],
      [cc, r4, 'OUI'],
      [ca, r5, 'OUI'],
      [cb, r5, 'OUI'],
      [cc, r5, 'OUI'],
      [cd, r5, 'OUI'],
    ];
    for (const [cookie, resolution, valeur] of bulletins) {
      expect((await voter(cookie, resolution, valeur)).status, `${resolution} ${valeur}`).toBe(201);
    }
    expect(await prisma.vote.count()).toBe(bulletins.length);

    // --- RM-02 : un second vote est refusé et le premier est conservé
    expect((await voter(ca, r1, 'NON')).status).toBe(409);
    const premierVote = await prisma.vote.findUniqueOrThrow({
      where: { idResolution_idUtilisateur: { idResolution: r1, idUtilisateur: a!.id } },
    });
    expect(premierVote.valeur).toBe('OUI');
    expect(await prisma.vote.count()).toBe(bulletins.length);

    // --- T-10 : clôture, résultats RM-03
    const cloture = await request(app).post(`/ags/${idAg}/cloture`).set('Cookie', cookieSyndic);
    expect(cloture.status).toBe(200);
    expect(cloture.body.ag.statut).toBe('CLOTUREE');

    // La participation s'appuie sur l'électorat figé à l'ouverture (4 copropriétaires habilités).
    const resultatsApi = await request(app).get(`/ags/${idAg}/resolutions`).set('Cookie', cookieSyndic);
    expect(resultatsApi.body.ag.nombreInscrits).toBe(4);

    const attendu: Record<string, 'ADOPTEE' | 'REJETEE'> = {
      'R1 simple': 'ADOPTEE',
      'R2 absolue': 'REJETEE',
      'R3 double majorité': 'ADOPTEE',
      'R4 unanimité (un absent)': 'REJETEE',
      'R5 unanimité (tous oui)': 'ADOPTEE',
    };
    const finales = await prisma.resolution.findMany({ where: { idAg } });
    for (const resolution of finales) {
      expect(resolution.statutResultat, resolution.libelle).toBe(attendu[resolution.libelle]);
    }

    // --- RM-04 : plus aucun vote, clôture et ouverture refusées, résultats figés
    expect((await voter(cd, r4, 'OUI')).status).toBe(409);
    expect(
      (await request(app).post(`/ags/${idAg}/cloture`).set('Cookie', cookieSyndic)).status,
    ).toBe(409);
    expect(
      (await request(app).post(`/ags/${idAg}/ouverture`).set('Cookie', cookieSyndic)).status,
    ).toBe(409);
    expect(await prisma.vote.count()).toBe(bulletins.length);
    const apres = await prisma.resolution.findMany({ where: { idAg } });
    expect(apres.map((r) => [r.id, r.statutResultat]).sort()).toEqual(
      finales.map((r) => [r.id, r.statutResultat]).sort(),
    );
  });

  it('clôturer une AG encore planifiée est refusé (409) sans rien modifier ; AG inconnue : 404', async () => {
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'R', typeMajorite: 'SIMPLE' }]);
    const inconnu = '99999999-9999-4999-8999-999999999999';

    expect(
      (await request(app).post(`/ags/${ag.id}/cloture`).set('Cookie', cookieSyndic)).status,
    ).toBe(409);
    expect((await prisma.aG.findUniqueOrThrow({ where: { id: ag.id } })).statut).toBe('PLANIFIEE');

    expect(
      (await request(app).post(`/ags/${inconnu}/ouverture`).set('Cookie', cookieSyndic)).status,
    ).toBe(404);
    expect(
      (await request(app).post(`/ags/${inconnu}/cloture`).set('Cookie', cookieSyndic)).status,
    ).toBe(404);
  });

  it('un vote sur une résolution inconnue : 404', async () => {
    const votant = await creerCoproprietaireHabilite(immeuble.id, '1');
    const reponse = await voter(
      cookieSession(votant.id),
      '99999999-9999-4999-8999-999999999999',
      'OUI',
    );
    expect(reponse.status).toBe(404);
  });
});

describe('autorisation (RM-14) sur /ags', () => {
  it('401 sans session ; 403 pour un copropriétaire et un membre du conseil syndical, sans aucune modification', async () => {
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'R', typeMajorite: 'SIMPLE' }]);
    const copro = await creerUtilisateur();
    const conseil = await creerUtilisateur({ conseilSyndical: true });
    const corps = { dateAg: '2026-10-15', resolutions: [{ libelle: 'X', typeMajorite: 'SIMPLE' }] };

    expect((await request(app).post('/ags').send(corps)).status).toBe(401);
    expect((await request(app).post(`/ags/${ag.id}/ouverture`)).status).toBe(401);
    expect((await request(app).post(`/ags/${ag.id}/cloture`)).status).toBe(401);

    for (const utilisateur of [copro, conseil]) {
      const cookie = cookieSession(utilisateur.id);
      expect((await request(app).post('/ags').set('Cookie', cookie).send(corps)).status).toBe(403);
      expect(
        (await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookie)).status,
      ).toBe(403);
      expect((await request(app).post(`/ags/${ag.id}/cloture`).set('Cookie', cookie)).status).toBe(
        403,
      );
    }
    expect(await prisma.aG.count()).toBe(1);
    expect((await prisma.aG.findUniqueOrThrow({ where: { id: ag.id } })).statut).toBe('PLANIFIEE');
  });
});

describe('modifier et consulter son vote', () => {
  const modifier = (cookie: string, idResolution: string, valeur: string) =>
    request(app).put(`/resolutions/${idResolution}/votes`).set('Cookie', cookie).send({ valeur });

  async function agOuverteAvecDeuxVotants() {
    const [a, b] = await Promise.all(
      ['1', '2'].map((numero) => creerCoproprietaireHabilite(immeuble.id, numero)),
    );
    const ag = await creerAg(immeuble.id, 'OUVERTE', [
      { libelle: 'R1', typeMajorite: 'SIMPLE' },
      { libelle: 'R2', typeMajorite: 'SIMPLE' },
    ]);
    return { a: a!, b: b!, ag, r1: ag.resolutions[0]!.id, r2: ag.resolutions[1]!.id };
  }

  it("changer d'avis tant que l'AG est ouverte : la valeur et la date sont mises à jour, un seul vote reste en base", async () => {
    const { a, r1 } = await agOuverteAvecDeuxVotants();
    const cookie = cookieSession(a.id);
    expect((await voter(cookie, r1, 'OUI')).status).toBe(201);
    const avant = await prisma.vote.findFirstOrThrow({ where: { idResolution: r1 } });

    const reponse = await modifier(cookie, r1, 'NON');

    expect(reponse.status).toBe(200);
    expect(reponse.body.vote).toMatchObject({ idResolution: r1, valeur: 'NON' });
    const apres = await prisma.vote.findMany({ where: { idResolution: r1 } });
    expect(apres).toHaveLength(1);
    expect(apres[0]!.valeur).toBe('NON');
    expect(apres[0]!.dateVote.getTime()).toBeGreaterThanOrEqual(avant.dateVote.getTime());
  });

  it("modifier sans avoir voté : 404, et rien n'est créé (le PUT ne crée pas de vote)", async () => {
    const { a, r1 } = await agOuverteAvecDeuxVotants();
    expect((await modifier(cookieSession(a.id), r1, 'OUI')).status).toBe(404);
    expect(await prisma.vote.count()).toBe(0);
  });

  it("l'identité vient de la session : modifier ne peut jamais toucher le vote d'un autre copropriétaire", async () => {
    const { a, b, r1 } = await agOuverteAvecDeuxVotants();
    await voter(cookieSession(a.id), r1, 'OUI');

    expect((await modifier(cookieSession(b.id), r1, 'NON')).status).toBe(404);
    expect((await prisma.vote.findFirstOrThrow({ where: { idResolution: r1 } })).valeur).toBe('OUI');
  });

  it('après la clôture, la modification est refusée (409) et le vote figé reste inchangé (RM-04)', async () => {
    const { a, ag, r1 } = await agOuverteAvecDeuxVotants();
    const cookie = cookieSession(a.id);
    await voter(cookie, r1, 'OUI');
    await request(app).post(`/ags/${ag.id}/cloture`).set('Cookie', cookieSyndic);

    expect((await modifier(cookie, r1, 'NON')).status).toBe(409);
    expect((await prisma.vote.findFirstOrThrow({ where: { idResolution: r1 } })).valeur).toBe('OUI');
  });

  it('le résultat calculé à la clôture tient compte de la dernière valeur du vote modifié', async () => {
    const { a, ag, r1 } = await agOuverteAvecDeuxVotants();
    const cookie = cookieSession(a.id);
    await voter(cookie, r1, 'OUI');
    await modifier(cookie, r1, 'NON');

    await request(app).post(`/ags/${ag.id}/cloture`).set('Cookie', cookieSyndic);

    const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id: r1 } });
    expect(resolution.statutResultat).toBe('REJETEE'); // 0 oui / 1 non en majorité simple
  });

  it('le syndic ne peut pas modifier de vote (403) ; sans session : 401 ; corps invalide : 422', async () => {
    const { a, r1 } = await agOuverteAvecDeuxVotants();
    await voter(cookieSession(a.id), r1, 'OUI');

    expect((await modifier(cookieSyndic, r1, 'NON')).status).toBe(403);
    expect((await request(app).put(`/resolutions/${r1}/votes`).send({ valeur: 'NON' })).status).toBe(
      401,
    );
    expect((await modifier(cookieSession(a.id), r1, 'PEUT-ETRE')).status).toBe(422);
  });

  it("GET /ags/:idAg/mes-votes ne renvoie que MES votes de cette AG, jamais ceux d'un autre", async () => {
    const { a, b, ag, r1, r2 } = await agOuverteAvecDeuxVotants();
    await voter(cookieSession(a.id), r1, 'OUI');
    await voter(cookieSession(b.id), r1, 'NON');
    await voter(cookieSession(b.id), r2, 'ABSTENTION');

    const reponse = await request(app)
      .get(`/ags/${ag.id}/mes-votes`)
      .set('Cookie', cookieSession(a.id));

    expect(reponse.status).toBe(200);
    expect(reponse.body.votes).toEqual([{ idResolution: r1, valeur: 'OUI' }]);
  });

  it('mes-votes : 403 pour le syndic, 401 sans session, 404 pour une AG inconnue', async () => {
    const { a, ag } = await agOuverteAvecDeuxVotants();
    expect(
      (await request(app).get(`/ags/${ag.id}/mes-votes`).set('Cookie', cookieSyndic)).status,
    ).toBe(403);
    expect((await request(app).get(`/ags/${ag.id}/mes-votes`)).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/ags/99999999-9999-4999-8999-999999999999/mes-votes')
          .set('Cookie', cookieSession(a.id))
      ).status,
    ).toBe(404);
  });
});

describe('double vote concurrent', () => {
  it('20 requêtes simultanées du même copropriétaire sur la même résolution : un seul vote enregistré', async () => {
    const votant = await creerCoproprietaireHabilite(immeuble.id, '1');
    const ag = await creerAg(immeuble.id, 'OUVERTE', [{ libelle: 'R', typeMajorite: 'SIMPLE' }]);
    const idResolution = ag.resolutions[0]!.id;
    const cookie = cookieSession(votant.id);

    const reponses = await Promise.all(
      Array.from({ length: 20 }, () => voter(cookie, idResolution, 'OUI')),
    );

    expect(reponses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(reponses.filter((r) => r.status === 409)).toHaveLength(19);
    expect(await prisma.vote.count()).toBe(1);
  });
});

describe("électorat figé à l'ouverture du vote", () => {
  it(
    "un copropriétaire qui quitte l'immeuble après avoir voté ne fait pas basculer " +
      'rétroactivement le résultat : le dénominateur reste celui figé à l’ouverture',
    async () => {
      const [a, b, c, d] = await Promise.all(
        ['1', '2', '3', '4'].map((numero) => creerCoproprietaireHabilite(immeuble.id, numero)),
      );
      const creation = await request(app)
        .post('/ags')
        .set('Cookie', cookieSyndic)
        .send({ dateAg: '2026-10-15', resolutions: [{ libelle: 'R', typeMajorite: 'ABSOLUE' }] });
      const idAg: string = creation.body.ag.id;
      const idResolution: string = creation.body.ag.resolutions[0].id;

      await request(app).post(`/ags/${idAg}/ouverture`).set('Cookie', cookieSyndic);
      expect((await prisma.aG.findUniqueOrThrow({ where: { id: idAg } })).nombreInscritsGeles).toBe(
        4,
      );

      // 2 OUI sur 4 inscrits figés : 2*2=4, pas > 4 → REJETEE (majorité absolue, RM-03).
      expect((await voter(cookieSession(a!.id), idResolution, 'OUI')).status).toBe(201);
      expect((await voter(cookieSession(b!.id), idResolution, 'OUI')).status).toBe(201);

      // D quitte l'immeuble (rattachement supprimé, sans remplaçant) pendant que l'AG est
      // toujours ouverte : si le dénominateur était recalculé à la clôture, il tomberait à 3
      // et 2*2=4 > 3 ferait basculer le résultat à ADOPTEE — exactement le bug corrigé.
      // (`deleteMany` plutôt qu'une clôture par date_fin : chk_periode interdit date_fin =
      // date_debut le jour même, non pertinent pour ce test.)
      await prisma.rattachement.deleteMany({ where: { idUtilisateur: d!.id, dateFin: null } });
      void c; // C n'a jamais voté, volontairement (RM-03 : les non-votants comptent contre en ABSOLUE)

      const cloture = await request(app).post(`/ags/${idAg}/cloture`).set('Cookie', cookieSyndic);
      expect(cloture.status).toBe(200);
      const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id: idResolution } });
      expect(resolution.statutResultat).toBe('REJETEE');
    },
  );
});

describe('atomicité des écritures', () => {
  it("la création d'une AG est atomique : si une résolution est refusée par la base, aucune AG n'est créée", async () => {
    await expect(
      agRepository.creerAvecResolutions(immeuble.id, new Date('2026-10-15'), [
        { libelle: 'valide', typeMajorite: 'SIMPLE' },
        { libelle: 'x'.repeat(501), typeMajorite: 'SIMPLE' }, // dépasse VARCHAR(500)
      ]),
    ).rejects.toThrow();
    expect(await prisma.aG.count()).toBe(0);
    expect(await prisma.resolution.count()).toBe(0);
  });

  it("la clôture est atomique : si le calcul échoue en cours de route, l'AG reste ouverte et aucun résultat n'est écrit", async () => {
    const ag = await creerAg(immeuble.id, 'OUVERTE', [
      { libelle: 'R1', typeMajorite: 'SIMPLE' },
      { libelle: 'R2', typeMajorite: 'SIMPLE' },
      { libelle: 'R3', typeMajorite: 'SIMPLE' },
    ]);
    let appels = 0;

    await expect(
      agRepository.cloturerAvecResultats(ag.id, () => {
        appels += 1;
        if (appels === 2) throw new Error('panne simulée au milieu du calcul');
        return 'ADOPTEE';
      }),
    ).rejects.toThrow('panne simulée');

    expect((await prisma.aG.findUniqueOrThrow({ where: { id: ag.id } })).statut).toBe('OUVERTE');
    const resolutions = await prisma.resolution.findMany({ where: { idAg: ag.id } });
    expect(resolutions.every((r) => r.statutResultat === 'EN_ATTENTE')).toBe(true);
  });
});
