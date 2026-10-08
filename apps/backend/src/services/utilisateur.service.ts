import { utilisateurRepository } from '../repositories/utilisateur.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { randomBytes } from 'node:crypto';
import { motDePasseService } from './mot-de-passe.service.js';

/**
 * Business Layer — T-06 (F-03, US-10) : le syndic ajoute un copropriétaire
 * et le rattache à un ou plusieurs lots. Distinct de `authService.inscrire`
 * (auto-inscription publique) : ici c'est le syndic qui agit pour un tiers,
 * l'autorisation (réservée au rôle SYNDIC) est vérifiée par le controller
 * avant d'appeler ce service.
 */

export class EmailDejaUtiliseError extends Error {
  constructor() {
    super('Un compte existe déjà avec cet email.');
    this.name = 'EmailDejaUtiliseError';
  }
}

export class LotIntrouvableError extends Error {
  constructor() {
    super('Lot introuvable.');
    this.name = 'LotIntrouvableError';
  }
}

export class UtilisateurIntrouvableError extends Error {
  constructor() {
    super('Utilisateur introuvable.');
    this.name = 'UtilisateurIntrouvableError';
  }
}

export class RattachementConcurrentError extends Error {
  constructor() {
    super("Le lot vient d'être rattaché par une autre requête, réessayez.");
    this.name = 'RattachementConcurrentError';
  }
}

/** `date_debut` est une DATE (sans heure) : on compare des jours calendaires UTC, comme Prisma les écrit. */
function debuteAvantAujourdhui(dateDebut: Date): boolean {
  const jour = (date: Date) => date.toISOString().slice(0, 10);
  return jour(dateDebut) < jour(new Date());
}

export class CompteNonCoproprietaireError extends Error {
  constructor() {
    super('Seul un copropriétaire peut être membre du conseil syndical.');
    this.name = 'CompteNonCoproprietaireError';
  }
}

export class LotsEncoreRattachesError extends Error {
  constructor() {
    super("Ce copropriétaire possède encore des lots : transférez-les avant d'anonymiser le compte.");
    this.name = 'LotsEncoreRattachesError';
  }
}

/** Nom affiché à la place de celui d'un copropriétaire anonymisé. */
export const NOM_ANONYMISE = 'Copropriétaire anonymisé';

/** Domaine réservé (RFC 2606) : aucun e-mail ne peut y être délivré. */
const DOMAINE_ANONYMISE = 'anonymise.invalid';

export const utilisateurService = {
  async listerSyndics() {
    return utilisateurRepository.listerSyndics();
  },

  /**
   * Création d'un compte SYNDIC supplémentaire, par un syndic déjà connecté
   * (jamais par l'inscription publique, anti-élévation de privilèges).
   */
  async creerSyndic(donnees: { nom: string; email: string; motDePasseClair: string }) {
    if (await utilisateurRepository.parEmail(donnees.email)) {
      throw new EmailDejaUtiliseError();
    }
    const motDePasseHash = await motDePasseService.hacher(donnees.motDePasseClair);
    const utilisateur = await utilisateurRepository.creer({
      nom: donnees.nom,
      email: donnees.email,
      motDePasseHash,
      typeCompte: 'SYNDIC',
    });
    if (!utilisateur) {
      throw new EmailDejaUtiliseError();
    }
    return utilisateur;
  },

  /** Le conseil syndical est un droit de regard supplémentaire d'un copropriétaire (RM-07, RM-12) : le syndic le désigne ou le retire. */
  async definirConseilSyndical(idUtilisateur: string, estMembre: boolean) {
    const utilisateur = await utilisateurRepository.parId(idUtilisateur);
    if (!utilisateur) {
      throw new UtilisateurIntrouvableError();
    }
    if (utilisateur.typeCompte !== 'COPROPRIETAIRE') {
      throw new CompteNonCoproprietaireError();
    }
    const modifie = await utilisateurRepository.definirMembreConseilSyndical(idUtilisateur, estMembre);
    if (!modifie) {
      throw new UtilisateurIntrouvableError();
    }
    return modifie;
  },

  async listerCoproprietaires() {
    return utilisateurRepository.listerCoproprietaires();
  },

  async creerCoproprietaire(donnees: { nom: string; email: string; motDePasseClair: string }) {
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
      // Création concurrente avec le même email : la base a tranché.
      throw new EmailDejaUtiliseError();
    }
    return utilisateur;
  },

  /**
   * Rattache un lot à un copropriétaire. Si le lot a déjà un rattachement
   * actif vers quelqu'un d'autre, celui-ci est clôturé (date_fin = maintenant)
   * plutôt que supprimé, pour conserver l'historique (US-10, critère
   * d'acceptation). L'index unique partiel du MPD
   * (`idx_rattachement_actif_unique`) garantit qu'il ne peut jamais exister
   * deux rattachements actifs simultanés pour le même lot, même en cas de
   * bug applicatif — dernière ligne de défense en base.
   */
  async rattacherLot(idLot: string, idUtilisateur: string) {
    const lot = await lotRepository.parId(idLot);
    if (!lot) {
      throw new LotIntrouvableError();
    }
    const utilisateur = await utilisateurRepository.parId(idUtilisateur);
    if (!utilisateur) {
      throw new UtilisateurIntrouvableError();
    }

    const rattachementActif = await lotRepository.rattachementActif(idLot);
    if (rattachementActif && rattachementActif.idUtilisateur === idUtilisateur) {
      return rattachementActif; // déjà rattaché à cet utilisateur, opération idempotente
    }

    // L'ancien rattachement est clôturé (historique conservé). Sauf s'il a
    // débuté aujourd'hui : le MPD exige date_fin > date_debut, et une durée
    // nulle n'a rien à historiser, on le supprime alors (correction de saisie).
    const ancien = rattachementActif
      ? {
          id: rattachementActif.id,
          action: debuteAvantAujourdhui(rattachementActif.dateDebut)
            ? ('CLOTURER' as const)
            : ('SUPPRIMER' as const),
        }
      : null;

    const cree = await lotRepository.transfererRattachement(idLot, idUtilisateur, ancien);
    if (!cree) {
      throw new RattachementConcurrentError();
    }
    return cree;
  },

  /**
   * Droit à l'effacement (RGPD) : le syndic anonymise un ancien
   * copropriétaire. Le nom et l'e-mail sont remplacés, le mot de passe
   * devient une empreinte d'un secret aléatoire jamais conservé et toutes
   * les sessions sont invalidées : le compte ne peut plus servir. Les votes
   * sont conservés, sans lien avec une personne identifiable, car ils
   * fondent les résultats des AG déjà clôturées. Un copropriétaire qui
   * possède encore un lot ne peut pas être anonymisé (409) : le lot doit
   * d'abord être rattaché à son nouveau propriétaire.
   */
  async anonymiserCoproprietaire(idUtilisateur: string) {
    const utilisateur = await utilisateurRepository.parId(idUtilisateur);
    if (!utilisateur) {
      throw new UtilisateurIntrouvableError();
    }
    if (utilisateur.typeCompte !== 'COPROPRIETAIRE') {
      throw new CompteNonCoproprietaireError();
    }
    const lots = await lotRepository.lotsRattachesAUtilisateur(idUtilisateur);
    if (lots.length > 0) {
      throw new LotsEncoreRattachesError();
    }
    const motDePasseHash = await motDePasseService.hacher(randomBytes(32).toString('hex'));
    const anonymise = await utilisateurRepository.anonymiser(idUtilisateur, {
      nom: NOM_ANONYMISE,
      email: `anonyme-${idUtilisateur}@${DOMAINE_ANONYMISE}`,
      motDePasseHash,
    });
    if (!anonymise) {
      throw new UtilisateurIntrouvableError();
    }
    return anonymise;
  },
};
