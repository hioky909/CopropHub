import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { cookieSession, creerImmeuble, creerUtilisateur, prisma, viderBase } from './support.js';

/**
 * T-13 (RM-11 à RM-13, US-09) sur une vraie base : machine à états incident.
 */
const app = createApp();

let syndic: Awaited<ReturnType<typeof creerUtilisateur>>;

beforeEach(async () => {
  await viderBase();
  await creerImmeuble(); // immeuble unique du MVP, requis par incidentService.declarer
  syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
});

async function declarer(idDeclarant: string) {
  const reponse = await request(app)
    .post('/incidents')
    .set('Cookie', cookieSession(idDeclarant))
    .send({ titre: 'Fuite dans le hall' });
  return reponse.body.incident.id as string;
}

describe('parcours complet : déclaration → en cours → résolu', () => {
  it('applique RM-11, RM-12, RM-13 avec de vraies transitions en base', async () => {
    const declarant = await creerUtilisateur({ email: 'declarant@test.local' });
    const autreCopro = await creerUtilisateur({ email: 'autre@test.local' });
    const idIncident = await declarer(declarant.id);

    // RM-12 : le déclarant voit son incident ; il porte sur une partie commune, donc un autre
    // copropriétaire le voit aussi, mais sans jamais savoir qui l'a déclaré.
    const listeDeclarant = await request(app)
      .get('/incidents')
      .set('Cookie', cookieSession(declarant.id));
    expect(listeDeclarant.body.incidents.map((i: { id: string }) => i.id)).toContain(idIncident);

    const listeAutre = await request(app)
      .get('/incidents')
      .set('Cookie', cookieSession(autreCopro.id));
    const vuParAutre = listeAutre.body.incidents.find((i: { id: string }) => i.id === idIncident);
    expect(vuParAutre).toBeDefined();
    expect(vuParAutre.idUtilisateurDeclarant).toBeNull();

    // RM-12 : le syndic voit tous les incidents.
    const listeSyndic = await request(app)
      .get('/incidents')
      .set('Cookie', cookieSession(syndic.id));
    expect(listeSyndic.body.incidents.map((i: { id: string }) => i.id)).toContain(idIncident);

    // RM-11 : DECLARE → EN_COURS
    const premiereTransition = await request(app)
      .patch(`/incidents/${idIncident}/statut`)
      .set('Cookie', cookieSession(syndic.id))
      .send({ statut: 'EN_COURS' });
    expect(premiereTransition.status).toBe(200);
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: idIncident } })).statut).toBe(
      'EN_COURS',
    );

    // RM-11 : saut d'étape refusé, statut inchangé en base.
    const sautEtape = await request(app)
      .patch(`/incidents/${await declarer(declarant.id)}/statut`)
      .set('Cookie', cookieSession(syndic.id))
      .send({ statut: 'RESOLU' });
    expect(sautEtape.status).toBe(422);

    // RM-11 : EN_COURS → RESOLU
    const secondeTransition = await request(app)
      .patch(`/incidents/${idIncident}/statut`)
      .set('Cookie', cookieSession(syndic.id))
      .send({ statut: 'RESOLU' });
    expect(secondeTransition.status).toBe(200);

    // RM-13 : terminal, jamais de retour en arrière.
    const retourArriere = await request(app)
      .patch(`/incidents/${idIncident}/statut`)
      .set('Cookie', cookieSession(syndic.id))
      .send({ statut: 'EN_COURS' });
    expect(retourArriere.status).toBe(422);
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: idIncident } })).statut).toBe(
      'RESOLU',
    );

    // RM-13 : l'incident résolu reste consultable (historique), pas filtré.
    const listeFinale = await request(app)
      .get('/incidents')
      .set('Cookie', cookieSession(declarant.id));
    const trouve = listeFinale.body.incidents.find((i: { id: string }) => i.id === idIncident);
    expect(trouve?.statut).toBe('RESOLU');
  });

  it('un membre du conseil syndical voit tous les incidents mais ne peut pas les faire progresser', async () => {
    const declarant = await creerUtilisateur({ email: 'declarant@test.local' });
    const membre = await creerUtilisateur({ email: 'membre@test.local', conseilSyndical: true });
    const idIncident = await declarer(declarant.id);

    const liste = await request(app).get('/incidents').set('Cookie', cookieSession(membre.id));
    expect(liste.body.incidents.map((i: { id: string }) => i.id)).toContain(idIncident);

    const transition = await request(app)
      .patch(`/incidents/${idIncident}/statut`)
      .set('Cookie', cookieSession(membre.id))
      .send({ statut: 'EN_COURS' });
    expect(transition.status).toBe(403);
    expect((await prisma.incident.findUniqueOrThrow({ where: { id: idIncident } })).statut).toBe(
      'DECLARE',
    );
  });

  it('404 pour un incident inconnu, 401 sans session', async () => {
    const inconnu = '99999999-9999-4999-8999-999999999999';
    expect(
      (
        await request(app)
          .patch(`/incidents/${inconnu}/statut`)
          .set('Cookie', cookieSession(syndic.id))
          .send({ statut: 'EN_COURS' })
      ).status,
    ).toBe(404);
    expect((await request(app).get('/incidents')).status).toBe(401);
  });
});
