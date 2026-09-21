import { utilisateurRepository } from '../repositories/utilisateur.repository.js';
import { motDePasseService } from './mot-de-passe.service.js';
import { sessionService } from './session.service.js';
import type { TypeCompte, UtilisateurAuthentifie } from '../types/auth.js';

/**
 * Business Layer — T-05 : inscription et connexion sécurisées (F-01).
 * Aucun accès direct à Prisma ici : uniquement via utilisateurRepository.
 */

export class EmailDejaUtiliseError extends Error {
  constructor() {
    super('Un compte existe déjà avec cet email.');
    this.name = 'EmailDejaUtiliseError';
  }
}

export class IdentifiantsInvalidesError extends Error {
  constructor() {
    // Message volontairement générique : ne révèle jamais si c'est l'email
    // ou le mot de passe qui est incorrect (Doc 5 § Spoofing / message
    // d'erreur générique).
    super('Email ou mot de passe incorrect.');
    this.name = 'IdentifiantsInvalidesError';
  }
}

function versUtilisateurAuthentifie(utilisateur: {
  id: string;
  email: string;
  typeCompte: TypeCompte;
  estMembreConseilSyndical: boolean;
}): UtilisateurAuthentifie {
  return {
    id: utilisateur.id,
    email: utilisateur.email,
    typeCompte: utilisateur.typeCompte,
    estMembreConseilSyndical: utilisateur.estMembreConseilSyndical,
  };
}

export const authService = {
  /**
   * Inscription. Le type de compte n'est accepté ici que pour permettre
   * l'auto-inscription d'un copropriétaire (F-01) ; la création d'un
   * compte SYNDIC ou l'élévation vers le conseil syndical ne passent
   * jamais par cet endpoint public (anti mass assignment, cf. Doc 5).
   */
  async inscrire(donnees: {
    nom: string;
    email: string;
    motDePasseClair: string;
  }): Promise<{ utilisateur: UtilisateurAuthentifie; jeton: string }> {
    const existant = await utilisateurRepository.parEmail(donnees.email);
    if (existant) {
      throw new EmailDejaUtiliseError();
    }

    const motDePasseHash = await motDePasseService.hacher(donnees.motDePasseClair);
    const utilisateur = await utilisateurRepository.creer({
      nom: donnees.nom,
      email: donnees.email,
      motDePasseHash,
      typeCompte: 'COPROPRIETAIRE',
    });

    const jeton = sessionService.emettreJeton(utilisateur.id);
    return { utilisateur: versUtilisateurAuthentifie(utilisateur), jeton };
  },

  async connecter(donnees: {
    email: string;
    motDePasseClair: string;
  }): Promise<{ utilisateur: UtilisateurAuthentifie; jeton: string }> {
    const utilisateur = await utilisateurRepository.parEmail(donnees.email);
    if (!utilisateur) {
      // Même erreur que "mot de passe incorrect" : ne pas révéler
      // l'existence du compte (Doc 5 § Spoofing).
      throw new IdentifiantsInvalidesError();
    }

    const motDePasseValide = await motDePasseService.verifier(
      donnees.motDePasseClair,
      utilisateur.motDePasseHash,
    );
    if (!motDePasseValide) {
      throw new IdentifiantsInvalidesError();
    }

    const jeton = sessionService.emettreJeton(utilisateur.id);
    return { utilisateur: versUtilisateurAuthentifie(utilisateur), jeton };
  },

  async utilisateurCourant(utilisateurId: string): Promise<UtilisateurAuthentifie | null> {
    const utilisateur = await utilisateurRepository.parId(utilisateurId);
    return utilisateur ? versUtilisateurAuthentifie(utilisateur) : null;
  },
};
