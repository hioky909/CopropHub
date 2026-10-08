import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CompteNonCoproprietaireError,
  LotsEncoreRattachesError,
  NOM_ANONYMISE,
  UtilisateurIntrouvableError,
  utilisateurService,
} from './utilisateur.service.js';
import { utilisateurRepository } from '../repositories/utilisateur.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { motDePasseService } from './mot-de-passe.service.js';

type Utilisateur = NonNullable<Awaited<ReturnType<typeof utilisateurRepository.parId>>>;

const ID = '6f1c2a4e-1b7d-4c55-9a51-0d3c9e7b2f10';

function utilisateur(surcharges: Partial<Utilisateur> = {}): Utilisateur {
  return {
    id: ID,
    nom: 'Alice Martin',
    email: 'alice@test.local',
    motDePasseHash: '$2b$12$ancien',
    typeCompte: 'COPROPRIETAIRE',
    estMembreConseilSyndical: true,
    dateCreation: new Date('2026-01-01T00:00:00Z'),
    themeTeinte: 145,
    themeIntensite: 60,
    sessionsValidesDepuis: null,
    notificationsEmail: true,
    ...surcharges,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('utilisateurService.anonymiserCoproprietaire (RGPD, droit à l’effacement)', () => {
  it('remplace nom, e-mail et mot de passe, sans rien de l’ancien compte', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(utilisateur());
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    vi.spyOn(motDePasseService, 'hacher').mockResolvedValue('$2b$12$nouveau');
    const anonymiser = vi
      .spyOn(utilisateurRepository, 'anonymiser')
      .mockResolvedValue(utilisateur({ nom: NOM_ANONYMISE }));

    const resultat = await utilisateurService.anonymiserCoproprietaire(ID);

    expect(resultat.nom).toBe(NOM_ANONYMISE);
    expect(anonymiser).toHaveBeenCalledWith(ID, {
      nom: NOM_ANONYMISE,
      email: `anonyme-${ID}@anonymise.invalid`,
      motDePasseHash: '$2b$12$nouveau',
    });
    const donnees = anonymiser.mock.calls[0]![1];
    expect(JSON.stringify(donnees)).not.toMatch(/alice/i);
  });

  it('le nouveau mot de passe est un secret aléatoire, différent à chaque anonymisation', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(utilisateur());
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([]);
    vi.spyOn(utilisateurRepository, 'anonymiser').mockResolvedValue(utilisateur());
    const hacher = vi.spyOn(motDePasseService, 'hacher').mockResolvedValue('$2b$12$x');

    await utilisateurService.anonymiserCoproprietaire(ID);
    await utilisateurService.anonymiserCoproprietaire(ID);

    const [premier, second] = hacher.mock.calls.map((appel) => appel[0]);
    expect(premier).toMatch(/^[0-9a-f]{64}$/);
    expect(premier).not.toBe(second);
  });

  it('404 métier si le compte n’existe pas', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(null);
    const anonymiser = vi.spyOn(utilisateurRepository, 'anonymiser');
    await expect(utilisateurService.anonymiserCoproprietaire(ID)).rejects.toBeInstanceOf(
      UtilisateurIntrouvableError,
    );
    expect(anonymiser).not.toHaveBeenCalled();
  });

  it('refuse d’anonymiser un compte syndic', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(utilisateur({ typeCompte: 'SYNDIC' }));
    const anonymiser = vi.spyOn(utilisateurRepository, 'anonymiser');
    await expect(utilisateurService.anonymiserCoproprietaire(ID)).rejects.toBeInstanceOf(
      CompteNonCoproprietaireError,
    );
    expect(anonymiser).not.toHaveBeenCalled();
  });

  it('refuse tant que le copropriétaire possède encore un lot', async () => {
    vi.spyOn(utilisateurRepository, 'parId').mockResolvedValue(utilisateur());
    vi.spyOn(lotRepository, 'lotsRattachesAUtilisateur').mockResolvedValue([
      { id: 'lot-a', idImmeuble: 'imm-1', numero: '7', typeLot: 'appartement' },
    ]);
    const anonymiser = vi.spyOn(utilisateurRepository, 'anonymiser');
    await expect(utilisateurService.anonymiserCoproprietaire(ID)).rejects.toBeInstanceOf(
      LotsEncoreRattachesError,
    );
    expect(anonymiser).not.toHaveBeenCalled();
  });
});
