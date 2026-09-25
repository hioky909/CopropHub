import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { estUnPdf, texteDuPdf } from '../testing/pdf-texte.js';
import { cookieSession, creerAg, creerCoproprietaireHabilite, creerImmeuble, creerUtilisateur, prisma, viderBase } from './support.js';

/**
 * F-13 sur une vraie base : le procès-verbal d'une AG clôturée et le relevé de charges, en PDF.
 * Mêmes règles d'accès que l'affichage : résultats anonymes seulement, AG clôturée seulement,
 * chacun ne voit que les charges de sa portée.
 */
const app = createApp();

let immeuble: Awaited<ReturnType<typeof creerImmeuble>>;
let syndic: Awaited<ReturnType<typeof creerUtilisateur>>;
let alice: Awaited<ReturnType<typeof creerUtilisateur>>;
let bob: Awaited<ReturnType<typeof creerUtilisateur>>;
let conseil: Awaited<ReturnType<typeof creerUtilisateur>>;
let sansLot: Awaited<ReturnType<typeof creerUtilisateur>>;

beforeEach(async () => {
  await viderBase();
  immeuble = await creerImmeuble();
  syndic = await creerUtilisateur({ typeCompte: 'SYNDIC', email: 'syndic@test.local' });
  alice = await creerCoproprietaireHabilite(immeuble.id, '1');
  bob = await creerCoproprietaireHabilite(immeuble.id, '2');
  conseil = await creerUtilisateur({ conseilSyndical: true, email: 'conseil@test.local' });
  sansLot = await creerUtilisateur({ email: 'sanslot@test.local' });
});

function telecharger(chemin: string, utilisateur?: { id: string }) {
  const requete = request(app)
    .get(chemin)
    .buffer(true)
    .parse((res, fin) => {
      const morceaux: Buffer[] = [];
      res.on('data', (m: Buffer) => morceaux.push(m));
      res.on('end', () => fin(null, Buffer.concat(morceaux)));
    });
  return utilisateur ? requete.set('Cookie', cookieSession(utilisateur.id)) : requete;
}

async function agCloturee() {
  const ag = await creerAg(immeuble.id, 'PLANIFIEE', [
    { libelle: 'Ravalement de la façade', typeMajorite: 'SIMPLE' },
    { libelle: 'Réfection de la toiture', typeMajorite: 'ABSOLUE' },
  ]);
  await request(app).post(`/ags/${ag.id}/ouverture`).set('Cookie', cookieSession(syndic.id)).expect(200);
  const [r1, r2] = ag.resolutions.map((r) => r.id);
  await prisma.vote.createMany({
    data: [
      { idResolution: r1!, idUtilisateur: alice.id, valeur: 'OUI' },
      { idResolution: r1!, idUtilisateur: bob.id, valeur: 'OUI' },
      { idResolution: r2!, idUtilisateur: alice.id, valeur: 'OUI' },
      { idResolution: r2!, idUtilisateur: bob.id, valeur: 'NON' },
    ],
  });
  await request(app).post(`/ags/${ag.id}/cloture`).set('Cookie', cookieSession(syndic.id)).expect(200);
  return ag;
}

describe('GET /ags/:idAg/proces-verbal.pdf', () => {
  it('livre un vrai PDF téléchargeable à tout compte authentifié, avec les résultats figés', async () => {
    const ag = await agCloturee();
    for (const utilisateur of [alice, syndic, conseil]) {
      const reponse = await telecharger(`/ags/${ag.id}/proces-verbal.pdf`, utilisateur);
      expect(reponse.status).toBe(200);
      expect(reponse.headers['content-type']).toBe('application/pdf');
      expect(reponse.headers['content-disposition']).toBe('attachment; filename="proces-verbal-ag-2026-10-15.pdf"');
      expect(reponse.headers['cache-control']).toBe('no-store');
      expect(estUnPdf(reponse.body as Buffer)).toBe(true);
    }
    const texte = texteDuPdf((await telecharger(`/ags/${ag.id}/proces-verbal.pdf`, alice)).body as Buffer);
    expect(texte).toContain('Résidence Test — 1 rue du Test, 75000 Paris');
    expect(texte).toContain('Assemblée générale du 15 octobre 2026');
    expect(texte).toContain('Copropriétaires inscrits au vote : 2');
    expect(texte).toContain('Résolution 1 — Ravalement de la façade');
    expect(texte).toContain('Pour : 2    Contre : 0    Abstentions : 0    Non-votants : 0');
    expect(texte).toContain('Résultat : ADOPTÉE');
    expect(texte).toContain('Résolution 2 — Réfection de la toiture');
    expect(texte).toContain('Pour : 1    Contre : 1    Abstentions : 0    Non-votants : 0');
    expect(texte).toContain('Résultat : REJETÉE');
  });

  it('ne contient jamais l’identité d’un votant ni le sens de son vote', async () => {
    const ag = await agCloturee();
    const brut = ((await telecharger(`/ags/${ag.id}/proces-verbal.pdf`, syndic)).body as Buffer).toString('latin1');
    const texte = texteDuPdf(Buffer.from(brut, 'latin1'));
    for (const secret of [alice.email, bob.email, alice.id, bob.id, alice.nom, bob.nom]) {
      expect(texte).not.toContain(secret);
      expect(brut).not.toContain(secret);
    }
  });

  it('refuse tant que l’AG n’est pas clôturée (409, RM-04) : ni planifiée ni ouverte', async () => {
    const planifiee = await creerAg(immeuble.id, 'PLANIFIEE', [{ libelle: 'R', typeMajorite: 'SIMPLE' }]);
    const ouverte = await creerAg(immeuble.id, 'OUVERTE', [{ libelle: 'R', typeMajorite: 'SIMPLE' }]);
    for (const ag of [planifiee, ouverte]) {
      const reponse = await request(app).get(`/ags/${ag.id}/proces-verbal.pdf`).set('Cookie', cookieSession(syndic.id));
      expect(reponse.status).toBe(409);
      expect(reponse.body.erreur).toBeTruthy();
    }
  });

  it('404 pour une AG inconnue, 422 pour un identifiant invalide, 401 sans session', async () => {
    await request(app).get('/ags/00000000-0000-4000-8000-000000000000/proces-verbal.pdf').set('Cookie', cookieSession(syndic.id)).expect(404);
    await request(app).get('/ags/pas-un-uuid/proces-verbal.pdf').set('Cookie', cookieSession(syndic.id)).expect(422);
    await request(app).get('/ags/00000000-0000-4000-8000-000000000000/proces-verbal.pdf').expect(401);
  });
});

describe('GET /charges/export.pdf', () => {
  async function chargesDeTest() {
    const lotAlice = await prisma.rattachement.findFirstOrThrow({ where: { idUtilisateur: alice.id } });
    const lotBob = await prisma.rattachement.findFirstOrThrow({ where: { idUtilisateur: bob.id } });
    await prisma.charge.create({ data: { idLot: lotAlice.idLot, montant: '100.00', periode: 'ALPHA-1' } });
    await prisma.charge.create({ data: { idLot: lotBob.idLot, montant: '200.00', periode: 'BRAVO-2' } });
    await prisma.charge.create({
      data: { idLot: lotBob.idLot, montant: '50.50', periode: 'CHARLIE-3', dateEcheance: new Date('2020-01-31T00:00:00.000Z') },
    });
  }

  it('un copropriétaire n’obtient que les charges de ses lots', async () => {
    await chargesDeTest();
    const reponse = await telecharger('/charges/export.pdf', alice);
    expect(reponse.status).toBe(200);
    expect(reponse.headers['content-disposition']).toMatch(/^attachment; filename="releve-charges-\d{4}-\d{2}-\d{2}\.pdf"$/);
    expect(reponse.headers['cache-control']).toBe('no-store');
    const texte = texteDuPdf(reponse.body as Buffer);
    expect(texte).toContain('Charges de vos lots');
    expect(texte).toContain('ALPHA-1');
    expect(texte).toContain('100,00 €');
    expect(texte).not.toContain('BRAVO-2');
    expect(texte).not.toContain('CHARLIE-3');
    expect(texte).toContain('Total : 100,00 €');
  });

  it('le syndic et le conseil syndical obtiennent toutes les charges de l’immeuble, avec le statut « en retard » dérivé', async () => {
    await chargesDeTest();
    for (const utilisateur of [syndic, conseil]) {
      const texte = texteDuPdf((await telecharger('/charges/export.pdf', utilisateur)).body as Buffer);
      expect(texte).toContain('Toutes les charges de l’immeuble');
      for (const periode of ['ALPHA-1', 'BRAVO-2', 'CHARLIE-3']) expect(texte).toContain(periode);
      expect(texte).toContain('En retard'); // échéance 2020 dépassée, jamais stockée en base
      expect(texte).toContain('Total : 350,50 €');
      expect(texte).toContain('En retard : 50,50 €');
    }
  });

  it('un compte sans lot obtient un relevé vide, pas une erreur', async () => {
    await chargesDeTest();
    const texte = texteDuPdf((await telecharger('/charges/export.pdf', sansLot)).body as Buffer);
    expect(texte).toContain('Aucune charge.');
    expect(texte).not.toContain('ALPHA-1');
  });

  it('401 sans session ; la route d’une charge par identifiant reste intacte', async () => {
    await request(app).get('/charges/export.pdf').expect(401);
    await chargesDeTest();
    const lot = await prisma.rattachement.findFirstOrThrow({ where: { idUtilisateur: alice.id } });
    const charge = await prisma.charge.findFirstOrThrow({ where: { idLot: lot.idLot } });
    await request(app).get(`/charges/${charge.id}`).set('Cookie', cookieSession(alice.id)).expect(200);
  });
});
