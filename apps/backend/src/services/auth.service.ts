import { createHash, randomBytes } from 'node:crypto';
import { utilisateurRepository } from '../repositories/utilisateur.repository.js';
import { reinitialisationRepository } from '../repositories/reinitialisation.repository.js';
import { mailService, urlApplication } from './mail.service.js';
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

export class MotDePasseActuelIncorrectError extends Error {
  constructor() {
    super('Le mot de passe actuel est incorrect.');
    this.name = 'MotDePasseActuelIncorrectError';
  }
}

export class NouveauMotDePasseIdentiqueError extends Error {
  constructor() {
    super('Le nouveau mot de passe doit être différent de l’actuel.');
    this.name = 'NouveauMotDePasseIdentiqueError';
  }
}

export class LienReinitialisationInvalideError extends Error {
  constructor() {
    // Même message pour un lien inconnu, déjà utilisé ou expiré : n'aide pas à deviner.
    super('Ce lien de réinitialisation est invalide ou a expiré.');
    this.name = 'LienReinitialisationInvalideError';
  }
}

const DUREE_LIEN_MS = 60 * 60 * 1000; // 1 heure

/** Empreinte SHA-256 du jeton : seule elle est stockée en base. */
function empreinte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

function versUtilisateurAuthentifie(utilisateur: {
  id: string;
  email: string;
  typeCompte: TypeCompte;
  estMembreConseilSyndical: boolean;
  themeTeinte: number | null;
  themeIntensite: number | null;
  notificationsEmail: boolean;
}): UtilisateurAuthentifie {
  return {
    id: utilisateur.id,
    email: utilisateur.email,
    typeCompte: utilisateur.typeCompte,
    estMembreConseilSyndical: utilisateur.estMembreConseilSyndical,
    notificationsEmail: utilisateur.notificationsEmail,
    theme:
      utilisateur.themeTeinte !== null && utilisateur.themeIntensite !== null
        ? { teinte: utilisateur.themeTeinte, intensite: utilisateur.themeIntensite }
        : null,
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
    if (!utilisateur) {
      // Inscription concurrente avec le même email : la base a tranché.
      throw new EmailDejaUtiliseError();
    }

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

  /**
   * Changement de mot de passe par l'utilisateur connecté : exige le mot de
   * passe ACTUEL (une session volée ne suffit pas à prendre le compte) et
   * applique la même politique que l'inscription. Les autres jetons déjà
   * émis restent valides jusqu'à leur expiration (sessions sans état).
   */
  /**
   * Change le mot de passe. Toutes les sessions ouvertes sont invalidées ; retourne un nouveau jeton
   * pour la session qui vient d'agir, qui reste ainsi connectée.
   */
  async changerMotDePasse(utilisateurId: string, actuel: string, nouveau: string): Promise<string> {
    const utilisateur = await utilisateurRepository.parId(utilisateurId);
    if (!utilisateur) {
      throw new MotDePasseActuelIncorrectError();
    }
    if (!(await motDePasseService.verifier(actuel, utilisateur.motDePasseHash))) {
      throw new MotDePasseActuelIncorrectError();
    }
    if (nouveau === actuel) {
      throw new NouveauMotDePasseIdentiqueError();
    }
    const nouveauHash = await motDePasseService.hacher(nouveau); // applique la politique
    const depuis = await utilisateurRepository.mettreAJourMotDePasse(utilisateurId, nouveauHash);
    return sessionService.emettreJeton(utilisateurId, depuis + 1);
  },

  /**
   * Mot de passe oublié. Retourne l'identifiant de l'utilisateur si un email a
   * été émis, sinon `null` — l'appelant répond pourtant IDENTIQUEMENT dans les
   * deux cas (aucune énumération de comptes). Un échec d'envoi SMTP est
   * journalisé sans donnée personnelle mais n'est jamais renvoyé au client,
   * pour la même raison.
   */
  async demanderReinitialisation(email: string): Promise<string | null> {
    const utilisateur = await utilisateurRepository.parEmail(email);
    if (!utilisateur) {
      return null;
    }

    const jeton = randomBytes(32).toString('base64url');
    await reinitialisationRepository.creer(
      utilisateur.id,
      empreinte(jeton),
      new Date(Date.now() + DUREE_LIEN_MS),
    );

    const base = urlApplication();
    try {
      await mailService.envoyer({
        a: utilisateur.email,
        sujet: 'CopropHub — réinitialisation de votre mot de passe',
        texte: [
          `Bonjour ${utilisateur.nom},`,
          '',
          'Vous avez demandé à réinitialiser votre mot de passe CopropHub.',
          `Cliquez sur ce lien (valable 1 heure, à usage unique) : ${base}/reinitialisation?jeton=${jeton}`,
          '',
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
        ].join('\n'),
      });
    } catch (erreur) {
      process.stderr.write(
        `${JSON.stringify({ type: 'erreur', evenement: 'reinitialisation-email-echec', cause: erreur instanceof Error ? erreur.name : 'inconnue' })}\n`,
      );
    }
    return utilisateur.id;
  },

  /** Applique un nouveau mot de passe grâce au jeton reçu par email (politique de mot de passe appliquée AVANT de consommer le jeton). */
  async reinitialiserMotDePasse(jeton: string, nouveauMotDePasse: string): Promise<string> {
    const nouveauHash = await motDePasseService.hacher(nouveauMotDePasse);
    const idUtilisateur = await reinitialisationRepository.consommerEtChangerMotDePasse(
      empreinte(jeton),
      nouveauHash,
    );
    if (!idUtilisateur) {
      throw new LienReinitialisationInvalideError();
    }
    return idUtilisateur;
  },

  /**
   * `emisLe` : instant d'émission du jeton de session. Un jeton émis avant (ou à l'instant de) la
   * dernière invalidation de sessions du compte est refusé : `null`, comme un compte inconnu.
   */
  async utilisateurCourant(utilisateurId: string, emisLe?: number): Promise<UtilisateurAuthentifie | null> {
    const utilisateur = await utilisateurRepository.parId(utilisateurId);
    if (!utilisateur) return null;
    if (emisLe !== undefined && utilisateur.sessionsValidesDepuis && emisLe <= utilisateur.sessionsValidesDepuis.getTime()) {
      return null;
    }
    return versUtilisateurAuthentifie(utilisateur);
  },
};
