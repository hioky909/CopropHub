import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { evenementsService } from '../services/evenements.service.js';
import { mailService } from '../services/mail.service.js';
import { notificationService } from '../services/notification.service.js';
import { cookieSession, creerAg, creerCoproprietaireHabilite, creerImmeuble, creerUtilisateur, prisma, viderBase } from './support.js';

/**
 * F-12 sur une vraie base : les courriels partent vers les bonnes personnes seulement (habilités,
 * non désabonnés, concernés), sans divulguer de vote ni de montant, sans jamais bloquer ni faire
 * échouer l'action métier, et la préférence de chaque utilisateur est respectée et isolée.
 */
const app = createApp();
const sendMail = vi.fn();

let immeuble: Awaited<ReturnType<typeof creerImmeuble>>;
let syndic: Awaited<ReturnType<typeof creerUtilisateur>>;
let alice: Awaited<ReturnType<typeof creerUtilisateur>>;
let bob: Awaited<ReturnType<typeof creerUtilisateur>>;
let sansLot: Awaited<ReturnType<typeof creerUtilisateur>>;

beforeEach(async () => {
  await viderBase();
  immeuble = await creerImmeuble();
  syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
  alice = await creerCoproprietaireHabilite(immeuble.id, '1');
  bob = await creerCoproprietaireHabilite(immeuble.id, '2');
  sansLot = await creerUtilisateur({ email: 'sanslot@test.local' });
  sendMail.mockReset().mockResolvedValue(undefined);
  mailService.definirTransport({ sendMail } as never);
  evenementsService.reinitialiser();
  notificationService.abonner();
});
afterEach(() => {
  mailService.definirTransport();
  evenementsService.reinitialiser();
});

const destinataires = () => sendMail.mock.calls.map((c) => (c[0] as { to: string }).to).sort();
const mails = () => sendMail.mock.calls.map((c) => c[0] as { to: string; subject: string; text: string });
const cookieSyndic = () => cookieSession(syndic.id);

describe('assemblées', () => {
  it('l’ouverture prévient les copropriétaires habilités, pas les comptes sans lot ni le syndic', async () => {
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'R1', typeMajorite: 'SIMPLE' }]);
    const reponse = await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookieSyndic());
    expect(reponse.status).toBe(200);
    await evenementsService.attendreFin();

    expect(destinataires()).toEqual([alice.email, bob.email].sort());
    expect(mails()[0]!.subject).toContain('Vote ouvert');
    expect(mails()[0]!.text).toContain(`/assemblees/${ag.id}`);
    expect(destinataires()).not.toContain(sansLot.email);
    expect(destinataires()).not.toContain(syndic.email);
  });

  it('la clôture prévient à son tour, sans divulguer aucun résultat', async () => {
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'Travaux', typeMajorite: 'SIMPLE' }]);
    await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookieSyndic()).expect(200);
    await evenementsService.attendreFin();
    await prisma.vote.create({ data: { idResolution: ag.resolutions[0]!.id, idUtilisateur: alice.id, valeur: 'OUI' } });
    sendMail.mockClear();

    await request(app).post(`/ags/${ag.id}/cloture`).set('Cookie', cookieSyndic()).expect(200);
    await evenementsService.attendreFin();

    expect(destinataires()).toEqual([alice.email, bob.email].sort());
    expect(mails()[0]!.subject).toContain('Résultats disponibles');
    expect(mails().map((m) => m.text).join('\n')).not.toMatch(/adopt|rejet|oui|abstention|Travaux/i);
  });

  it('un copropriétaire désabonné ne reçoit rien, les autres si', async () => {
    await request(app)
      .put('/utilisateurs/moi/notifications')
      .set('Cookie', cookieSession(bob.id))
      .send({ actives: false })
      .expect(200);
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'R1', typeMajorite: 'SIMPLE' }]);
    await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookieSyndic()).expect(200);
    await evenementsService.attendreFin();
    expect(destinataires()).toEqual([alice.email]);
  });

  it('une ouverture refusée (déjà ouverte) n’envoie rien', async () => {
    const ag = await creerAg(immeuble.id, 'OUVERTE', [{ libelle: 'R1', typeMajorite: 'SIMPLE' }]);
    await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookieSyndic()).expect(409);
    await evenementsService.attendreFin();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('une panne du serveur d’envoi ne bloque ni ne fait échouer l’ouverture', async () => {
    const ecriture = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    sendMail.mockRejectedValue(new Error('SMTP indisponible'));
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'R1', typeMajorite: 'SIMPLE' }]);
    const reponse = await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookieSyndic());
    expect(reponse.status).toBe(200);
    await evenementsService.attendreFin();
    expect((await prisma.aG.findUniqueOrThrow({ where: { id: ag.id } })).statut).toBe('OUVERTE');
    ecriture.mockRestore();
  });
});

describe('incidents', () => {
  async function incidentDe(auteur: { id: string }) {
    return prisma.incident.create({
      data: { idImmeuble: immeuble.id, idUtilisateurDeclarant: auteur.id, titre: 'Fuite dans le couloir' },
    });
  }

  it('prévient seulement le déclarant, à chaque étape', async () => {
    const incident = await incidentDe(alice);
    await request(app).patch(`/incidents/${incident.id}/statut`).set('Cookie', cookieSyndic()).send({ statut: 'EN_COURS' }).expect(200);
    await evenementsService.attendreFin();
    expect(destinataires()).toEqual([alice.email]);
    expect(mails()[0]!.subject).toBe('Votre incident est en cours de traitement');
    expect(mails()[0]!.text).toContain('Fuite dans le couloir');

    sendMail.mockClear();
    await request(app).patch(`/incidents/${incident.id}/statut`).set('Cookie', cookieSyndic()).send({ statut: 'RESOLU' }).expect(200);
    await evenementsService.attendreFin();
    expect(mails()[0]!.subject).toBe('Votre incident est résolu');
  });

  it('respecte la préférence du déclarant', async () => {
    await prisma.utilisateur.update({ where: { id: alice.id }, data: { notificationsEmail: false } });
    const incident = await incidentDe(alice);
    await request(app).patch(`/incidents/${incident.id}/statut`).set('Cookie', cookieSyndic()).send({ statut: 'EN_COURS' }).expect(200);
    await evenementsService.attendreFin();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('une transition refusée n’envoie rien', async () => {
    const incident = await incidentDe(alice);
    await request(app).patch(`/incidents/${incident.id}/statut`).set('Cookie', cookieSyndic()).send({ statut: 'RESOLU' }).expect(422);
    await evenementsService.attendreFin();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('charges', () => {
  it('prévient le propriétaire du lot, sans écrire le montant, et personne d’autre', async () => {
    const rattachement = await prisma.rattachement.findFirstOrThrow({ where: { idUtilisateur: alice.id } });
    const reponse = await request(app)
      .post('/charges')
      .set('Cookie', cookieSyndic())
      .send({ idLot: rattachement.idLot, montant: '1234.50', periode: '2026-T4', dateEcheance: '2026-12-31' });
    expect(reponse.status).toBe(201);
    await evenementsService.attendreFin();

    expect(destinataires()).toEqual([alice.email]);
    expect(mails()[0]!.text).toContain('2026-T4');
    expect(mails()[0]!.text).not.toMatch(/1234|1 234|€/);
  });

  it('un lot sans propriétaire actif ne provoque aucun courriel', async () => {
    const lot = await prisma.lot.create({ data: { idImmeuble: immeuble.id, numero: '99', typeLot: 'cave' } });
    await request(app).post('/charges').set('Cookie', cookieSyndic()).send({ idLot: lot.id, montant: '10.00', periode: '2026-T4' }).expect(201);
    await evenementsService.attendreFin();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('sans abonnement (comportement par défaut des tests et du développement sans SMTP)', () => {
  it('aucun courriel n’est envoyé tant que personne ne s’est abonné', async () => {
    evenementsService.reinitialiser();
    const ag = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'R1', typeMajorite: 'SIMPLE' }]);
    await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookieSyndic()).expect(200);
    await evenementsService.attendreFin();
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('PUT /utilisateurs/moi/notifications', () => {
  it('enregistre la préférence, la renvoie via /auth/moi et n’affecte pas les autres comptes', async () => {
    const avant = await request(app).get('/auth/moi').set('Cookie', cookieSession(alice.id));
    expect(avant.body.utilisateur.notificationsEmail).toBe(true); // actif par défaut

    const reponse = await request(app)
      .put('/utilisateurs/moi/notifications')
      .set('Cookie', cookieSession(alice.id))
      .send({ actives: false });
    expect(reponse.status).toBe(200);
    expect(reponse.body).toEqual({ notificationsEmail: false });

    const apres = await request(app).get('/auth/moi').set('Cookie', cookieSession(alice.id));
    expect(apres.body.utilisateur.notificationsEmail).toBe(false);
    expect((await prisma.utilisateur.findUniqueOrThrow({ where: { id: bob.id } })).notificationsEmail).toBe(true);

    await request(app).put('/utilisateurs/moi/notifications').set('Cookie', cookieSession(alice.id)).send({ actives: true }).expect(200);
    expect((await prisma.utilisateur.findUniqueOrThrow({ where: { id: alice.id } })).notificationsEmail).toBe(true);
  });

  it('est ouverte à tout rôle authentifié, refuse un anonyme (401)', async () => {
    await request(app).put('/utilisateurs/moi/notifications').set('Cookie', cookieSyndic()).send({ actives: false }).expect(200);
    await request(app).put('/utilisateurs/moi/notifications').send({ actives: false }).expect(401);
  });

  it.each([
    ['corps vide', {}],
    ['texte au lieu d’un booléen', { actives: 'oui' }],
    ['nombre', { actives: 1 }],
    ['null', { actives: null }],
    ['champ en trop (identifiant)', { actives: false, idUtilisateur: '00000000-0000-0000-0000-000000000000' }],
    ['champ en trop (rôle)', { actives: false, typeCompte: 'SYNDIC' }],
  ])('refuse en 422 sans rien modifier : %s', async (_nom, corps) => {
    await request(app).put('/utilisateurs/moi/notifications').set('Cookie', cookieSession(alice.id)).send(corps).expect(422);
    expect((await prisma.utilisateur.findUniqueOrThrow({ where: { id: alice.id } })).notificationsEmail).toBe(true);
  });
});
