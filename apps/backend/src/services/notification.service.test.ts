import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { notificationService } from './notification.service.js';
import { evenementsService } from './evenements.service.js';
import { mailService } from './mail.service.js';
import { agRepository } from '../repositories/ag.repository.js';
import { chargeRepository } from '../repositories/charge.repository.js';
import { incidentRepository } from '../repositories/incident.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { utilisateurRepository } from '../repositories/utilisateur.repository.js';

const sendMail = vi.fn();

beforeEach(() => {
  vi.stubEnv('APP_URL', 'https://copro.example.org/');
  sendMail.mockReset().mockResolvedValue(undefined);
  mailService.definirTransport({ sendMail } as never);
});
afterEach(() => {
  mailService.definirTransport();
  evenementsService.reinitialiser();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const AG = { id: 'ag-1', idImmeuble: 'imm-1', dateAg: new Date('2026-11-14T00:00:00.000Z') };
const DESTINATAIRES = [
  { id: 'u-1', email: 'alice@test.local', nom: 'Alice' },
  { id: 'u-2', email: 'bob@test.local', nom: 'Bob' },
];
const envoyes = () => sendMail.mock.calls.map((c) => c[0] as { to: string; subject: string; text: string });

describe('ouverture et clôture d’une assemblée', () => {
  beforeEach(() => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(AG as never);
    vi.spyOn(utilisateurRepository, 'coproprietairesANotifier').mockResolvedValue(DESTINATAIRES as never);
  });

  it('prévient chaque copropriétaire habilité, avec la date et un lien vers l’assemblée', async () => {
    await notificationService.notifierOuvertureAg('ag-1');
    expect(utilisateurRepository.coproprietairesANotifier).toHaveBeenCalledWith('imm-1');
    const mails = envoyes();
    expect(mails.map((m) => m.to)).toEqual(['alice@test.local', 'bob@test.local']);
    expect(mails[0]!.subject).toBe('Vote ouvert — assemblée générale du 14 novembre 2026');
    expect(mails[0]!.text).toContain('Bonjour Alice');
    expect(mails[0]!.text).toContain('https://copro.example.org/assemblees/ag-1'); // pas de double barre
    expect(mails[0]!.text).toContain('https://copro.example.org/compte'); // moyen de se désabonner
  });

  it('à la clôture, annonce les résultats sans en divulguer aucun', async () => {
    await notificationService.notifierClotureAg('ag-1');
    const mail = envoyes()[0]!;
    expect(mail.subject).toBe('Résultats disponibles — assemblée générale du 14 novembre 2026');
    expect(mail.text).not.toMatch(/adopt|rejet|oui|non |abstention/i);
  });

  it('une assemblée introuvable ne déclenche aucun courriel', async () => {
    vi.spyOn(agRepository, 'parId').mockResolvedValue(null);
    await notificationService.notifierOuvertureAg('inconnue');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('l’échec d’un envoi n’empêche pas les suivants, et le journal ne contient aucune adresse', async () => {
    const ecriture = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    sendMail.mockRejectedValueOnce(new Error('550 boîte pleine alice@test.local'));
    await notificationService.notifierOuvertureAg('ag-1');
    expect(envoyes().map((m) => m.to)).toEqual(['alice@test.local', 'bob@test.local']);
    const ligne = String(ecriture.mock.calls[0]![0]);
    expect(JSON.parse(ligne)).toEqual({ type: 'notification_erreur', evenement: 'AG_OUVERTE', destinataires: 2, echecs: 1 });
    expect(ligne).not.toContain('@');
  });

  it('sans serveur SMTP configuré, se tait : pas d’erreur, pas de journal', async () => {
    mailService.definirTransport(); // aucun transport injecté
    vi.stubEnv('SMTP_HOST', '');
    const ecriture = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await expect(notificationService.notifierOuvertureAg('ag-1')).resolves.toBeUndefined();
    expect(ecriture).not.toHaveBeenCalled();
  });
});

describe('avancement d’un incident', () => {
  const INCIDENT = { id: 'i-1', titre: 'Fuite au 2e étage', statut: 'EN_COURS', idUtilisateurDeclarant: 'u-1' };
  const DECLARANT = { id: 'u-1', email: 'alice@test.local', nom: 'Alice', notificationsEmail: true };

  it('prévient le déclarant, avec le titre de son incident et le nouvel état', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(INCIDENT as never);
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(DECLARANT as never);
    await notificationService.notifierStatutIncident('i-1');
    expect(envoyes()).toHaveLength(1);
    expect(envoyes()[0]).toMatchObject({ to: 'alice@test.local', subject: 'Votre incident est en cours de traitement' });
    expect(envoyes()[0]!.text).toContain('« Fuite au 2e étage »');

    sendMail.mockClear();
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue({ ...INCIDENT, statut: 'RESOLU' } as never);
    await notificationService.notifierStatutIncident('i-1');
    expect(envoyes()[0]!.subject).toBe('Votre incident est résolu');
  });

  it('respecte la préférence : déclarant désabonné, aucun courriel', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(INCIDENT as never);
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue({ ...DECLARANT, notificationsEmail: false } as never);
    await notificationService.notifierStatutIncident('i-1');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('incident ou déclarant introuvable : aucun courriel', async () => {
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(null);
    await notificationService.notifierStatutIncident('x');
    vi.spyOn(incidentRepository, 'parId').mockResolvedValue(INCIDENT as never);
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(null);
    await notificationService.notifierStatutIncident('i-1');
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('nouvelle charge', () => {
  const CHARGE = { id: 'c-1', idLot: 'lot-1', montant: new Prisma.Decimal('1234.56'), periode: '2026-T4', dateEcheance: new Date('2026-12-31T00:00:00.000Z') };
  const PROPRIETAIRE = { id: 'u-1', email: 'alice@test.local', nom: 'Alice', notificationsEmail: true };

  beforeEach(() => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue(CHARGE as never);
    vi.spyOn(lotRepository, 'parId').mockResolvedValue({ id: 'lot-1', numero: '12' } as never);
    vi.spyOn(lotRepository, 'rattachementActif').mockResolvedValue({ idUtilisateur: 'u-1' } as never);
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(PROPRIETAIRE as never);
  });

  it('prévient le seul propriétaire du lot, sans jamais écrire le montant', async () => {
    await notificationService.notifierChargeCreee('c-1');
    expect(envoyes()).toHaveLength(1);
    const mail = envoyes()[0]!;
    expect(mail).toMatchObject({ to: 'alice@test.local', subject: 'Nouvelle charge pour votre lot 12' });
    expect(mail.text).toContain('période 2026-T4');
    expect(mail.text).toContain('à régler avant le 31 décembre 2026');
    expect(mail.text).not.toMatch(/1234|1 234|€/);
  });

  it('sans échéance, ne mentionne pas de date', async () => {
    vi.spyOn(chargeRepository, 'parId').mockResolvedValue({ ...CHARGE, dateEcheance: null } as never);
    await notificationService.notifierChargeCreee('c-1');
    expect(envoyes()[0]!.text).not.toContain('à régler avant');
  });

  it('lot sans propriétaire actif, ou propriétaire désabonné : aucun courriel', async () => {
    vi.spyOn(lotRepository, 'rattachementActif').mockResolvedValue(null);
    await notificationService.notifierChargeCreee('c-1');
    vi.spyOn(lotRepository, 'rattachementActif').mockResolvedValue({ idUtilisateur: 'u-1' } as never);
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue({ ...PROPRIETAIRE, notificationsEmail: false } as never);
    await notificationService.notifierChargeCreee('c-1');
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('abonnement aux événements et préférence', () => {
  it('abonner relie chacun des 4 événements métier à sa notification', async () => {
    const espions = {
      ouverture: vi.spyOn(notificationService, 'notifierOuvertureAg').mockResolvedValue(),
      cloture: vi.spyOn(notificationService, 'notifierClotureAg').mockResolvedValue(),
      incident: vi.spyOn(notificationService, 'notifierStatutIncident').mockResolvedValue(),
      charge: vi.spyOn(notificationService, 'notifierChargeCreee').mockResolvedValue(),
    };
    notificationService.abonner();
    evenementsService.emettre('AG_OUVERTE', { idAg: 'a' });
    evenementsService.emettre('AG_CLOTUREE', { idAg: 'b' });
    evenementsService.emettre('INCIDENT_STATUT_MODIFIE', { idIncident: 'c' });
    evenementsService.emettre('CHARGE_CREEE', { idCharge: 'd' });
    await evenementsService.attendreFin();
    expect(espions.ouverture).toHaveBeenCalledWith('a');
    expect(espions.cloture).toHaveBeenCalledWith('b');
    expect(espions.incident).toHaveBeenCalledWith('c');
    expect(espions.charge).toHaveBeenCalledWith('d');
  });

  it('définit la préférence de l’utilisateur donné et la renvoie', async () => {
    const definir = vi.spyOn(utilisateurRepository, 'definirNotificationsEmail').mockResolvedValue();
    expect(await notificationService.definirPreference('u-1', false)).toBe(false);
    expect(definir).toHaveBeenCalledWith('u-1', false);
  });
});
