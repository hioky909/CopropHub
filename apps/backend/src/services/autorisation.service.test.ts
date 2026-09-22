import { describe, it, expect } from 'vitest';
import {
  autoriser,
  PERMISSIONS_RESSOURCE_LOT,
  type Action,
  type RessourceAutorisable,
} from './autorisation.service.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';

/**
 * T-07 — cas de référence exigés par Doc 5 § "Test de référence à
 * prévoir" : pour toute ressource identifiée par id, un utilisateur
 * authentifié mais non autorisé doit être refusé — jamais un 200 avec
 * des données filtrées côté client. Ces tests couvrent l'algorithme
 * générique ; les tests d'intégration par endpoint (charges, incidents…)
 * arriveront avec les tâches qui implémentent ces ressources.
 */

function utilisateur(partiel: Partial<UtilisateurAuthentifie>): UtilisateurAuthentifie {
  return {
    id: 'defaut',
    email: 'defaut@example.com',
    typeCompte: 'COPROPRIETAIRE',
    estMembreConseilSyndical: false,
    ...partiel,
  };
}

const syndic = utilisateur({ id: 'syndic-1', typeCompte: 'SYNDIC' });
const conseilSyndical = utilisateur({ id: 'conseil-1', estMembreConseilSyndical: true });
const coproprietaireA = utilisateur({ id: 'copro-a' });
const coproprietaireB = utilisateur({ id: 'copro-b' });

const ressourceDeA: RessourceAutorisable = {
  appartientA: (u) => u.id === 'copro-a',
};

describe('autoriser (RM-14)', () => {
  it('autorise toujours le syndic à lire et écrire, quelle que soit la ressource', () => {
    expect(autoriser(syndic, 'lire', ressourceDeA, PERMISSIONS_RESSOURCE_LOT)).toBe(true);
    expect(autoriser(syndic, 'ecrire', ressourceDeA, PERMISSIONS_RESSOURCE_LOT)).toBe(true);
  });

  it('autorise le conseil syndical en lecture sur une ressource qui ne lui appartient pas', () => {
    expect(autoriser(conseilSyndical, 'lire', ressourceDeA, PERMISSIONS_RESSOURCE_LOT)).toBe(true);
  });

  it("refuse l'écriture au conseil syndical sur la ligne 'lot' (lecture seule, cf. matrice Doc 5)", () => {
    expect(autoriser(conseilSyndical, 'ecrire', ressourceDeA, PERMISSIONS_RESSOURCE_LOT)).toBe(
      false,
    );
  });

  it('autorise un copropriétaire à lire sa propre ressource', () => {
    expect(autoriser(coproprietaireA, 'lire', ressourceDeA, PERMISSIONS_RESSOURCE_LOT)).toBe(true);
  });

  it("refuse à un copropriétaire l'accès à la ressource d'un autre (cas de référence IDOR/BOLA, Doc 5)", () => {
    expect(autoriser(coproprietaireB, 'lire', ressourceDeA, PERMISSIONS_RESSOURCE_LOT)).toBe(false);
  });

  it("refuse l'écriture à un copropriétaire même sur sa propre ressource (ligne 'lot' : lecture seule)", () => {
    expect(autoriser(coproprietaireA, 'ecrire', ressourceDeA, PERMISSIONS_RESSOURCE_LOT)).toBe(
      false,
    );
  });

  describe("cumul des droits pour un membre du conseil syndical (décision du 22/09)", () => {
    /** Ligne fictive où, contrairement à "lot", le copropriétaire a l'écriture sur SA ressource (ex. déclarer un incident sur son propre lot) mais pas le conseil syndical (lecture étendue seule). */
    const permissionsAvecEcritureCoproprietaire = {
      syndic: new Set<Action>(['lire', 'ecrire']),
      conseilSyndical: new Set<Action>(['lire']),
      coproprietaire: new Set<Action>(['lire', 'ecrire']),
    };

    const conseilSyndicalSurSaPropreRessource: RessourceAutorisable = {
      appartientA: (u) => u.id === conseilSyndical.id,
    };

    it("un membre du conseil syndical garde son droit d'écriture de copropriétaire sur SA PROPRE ressource (cumul, pas remplacement)", () => {
      expect(
        autoriser(
          conseilSyndical,
          'ecrire',
          conseilSyndicalSurSaPropreRessource,
          permissionsAvecEcritureCoproprietaire,
        ),
      ).toBe(true);
    });

    it("un membre du conseil syndical n'a PAS le droit d'écriture de copropriétaire sur la ressource d'un AUTRE (le cumul ne casse pas l'IDOR)", () => {
      expect(
        autoriser(conseilSyndical, 'ecrire', ressourceDeA, permissionsAvecEcritureCoproprietaire),
      ).toBe(false);
    });

    it('un membre du conseil syndical garde sa lecture étendue sur une ressource qui ne lui appartient pas, même avec cette nouvelle ligne', () => {
      expect(
        autoriser(conseilSyndical, 'lire', ressourceDeA, permissionsAvecEcritureCoproprietaire),
      ).toBe(true);
    });
  });
});
