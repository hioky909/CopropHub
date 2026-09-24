import { afterEach, describe, expect, it } from 'vitest';
import { journalService } from './journal.service.js';

afterEach(() => {
  journalService.definirSortie();
});

describe('journalService', () => {
  it("écrit une ligne JSON d'audit horodatée avec l'action, l'utilisateur et la cible", () => {
    const lignes: string[] = [];
    journalService.definirSortie((ligne) => lignes.push(ligne));

    journalService.journaliser('AG_CLOTUREE', 'u-syndic', 'ag-1');

    expect(lignes).toHaveLength(1);
    const entree = JSON.parse(lignes[0]!);
    expect(entree).toMatchObject({ type: 'audit', action: 'AG_CLOTUREE', utilisateurId: 'u-syndic', cible: 'ag-1' });
    expect(new Date(entree.horodatage).toISOString()).toBe(entree.horodatage);
  });

  it('omet la cible et les détails quand ils ne sont pas fournis, et inclut les détails sinon', () => {
    const lignes: string[] = [];
    journalService.definirSortie((ligne) => lignes.push(ligne));

    journalService.journaliser('CONNEXION', 'u-1');
    journalService.journaliser('LOT_RATTACHE', 'u-syndic', 'lot-1', { idUtilisateur: 'u-2' });

    expect(JSON.parse(lignes[0]!)).not.toHaveProperty('cible');
    expect(JSON.parse(lignes[0]!)).not.toHaveProperty('details');
    expect(JSON.parse(lignes[1]!).details).toEqual({ idUtilisateur: 'u-2' });
  });
});
