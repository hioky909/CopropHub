import { afterEach, describe, expect, it, vi } from 'vitest';
import { evenementsService } from './evenements.service.js';

afterEach(() => {
  evenementsService.reinitialiser();
  vi.restoreAllMocks();
});

describe('evenementsService', () => {
  it('prévient tous les abonnés de l’événement, avec ses données, et seulement eux', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const autre = vi.fn();
    evenementsService.abonner('AG_OUVERTE', a);
    evenementsService.abonner('AG_OUVERTE', b);
    evenementsService.abonner('AG_CLOTUREE', autre);

    evenementsService.emettre('AG_OUVERTE', { idAg: 'ag-1' });
    await evenementsService.attendreFin();

    expect(a).toHaveBeenCalledWith({ idAg: 'ag-1' });
    expect(b).toHaveBeenCalledWith({ idAg: 'ag-1' });
    expect(autre).not.toHaveBeenCalled();
  });

  it('sans abonné, ne fait rien et ne lance rien', async () => {
    expect(() => evenementsService.emettre('CHARGE_CREEE', { idCharge: 'c-1' })).not.toThrow();
    await evenementsService.attendreFin();
  });

  it('n’attend pas les abonnés : un abonné lent ne retarde pas l’émetteur', async () => {
    let termine = false;
    evenementsService.abonner('AG_OUVERTE', async () => {
      await new Promise((r) => setTimeout(r, 30));
      termine = true;
    });
    evenementsService.emettre('AG_OUVERTE', { idAg: 'ag-1' });
    expect(termine).toBe(false); // la fonction est déjà revenue
    await evenementsService.attendreFin();
    expect(termine).toBe(true);
  });

  it('l’échec d’un abonné n’empêche pas les autres et ne remonte pas ; il est journalisé sans donnée', async () => {
    const ecriture = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const bon = vi.fn();
    evenementsService.abonner('INCIDENT_STATUT_MODIFIE', async () => {
      throw new Error('panne SMTP');
    });
    evenementsService.abonner('INCIDENT_STATUT_MODIFIE', bon);

    expect(() => evenementsService.emettre('INCIDENT_STATUT_MODIFIE', { idIncident: 'i-1' })).not.toThrow();
    await evenementsService.attendreFin();

    expect(bon).toHaveBeenCalled();
    const ligne = String(ecriture.mock.calls[0]![0]);
    expect(JSON.parse(ligne)).toEqual({ type: 'evenement_erreur', evenement: 'INCIDENT_STATUT_MODIFIE', message: 'panne SMTP' });
    expect(ligne).not.toContain('i-1');
  });

  it('un abonné qui lance une erreur synchrone est traité de la même façon', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    evenementsService.abonner('CHARGE_CREEE', () => {
      throw new Error('boom');
    });
    expect(() => evenementsService.emettre('CHARGE_CREEE', { idCharge: 'c-1' })).not.toThrow();
    await evenementsService.attendreFin();
  });
});
