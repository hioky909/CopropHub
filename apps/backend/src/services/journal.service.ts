/**
 * Business Layer — journalisation des actions sensibles (F-11, STRIDE
 * « Repudiation », Doc 5) : un syndic ne peut pas nier avoir clôturé une AG,
 * un copropriétaire avoir voté, etc.
 *
 * Une ligne JSON par action sur la sortie standard (`type: 'audit'`), à
 * collecter par la plateforme de déploiement. Volontairement absent du
 * journal : mots de passe, jetons, emails et — surtout — la VALEUR d'un vote,
 * dont l'anonymat (US-04) prime ; on journalise seulement QU'un utilisateur a
 * voté ou modifié son vote, jamais dans quel sens.
 */

export type ActionJournal =
  | 'INSCRIPTION'
  | 'CONNEXION'
  | 'DECONNEXION'
  | 'MOT_DE_PASSE_MODIFIE'
  | 'COPROPRIETAIRE_CREE'
  | 'SYNDIC_CREE'
  | 'CONSEIL_SYNDICAL_MODIFIE'
  | 'LOT_CREE'
  | 'LOT_RATTACHE'
  | 'AG_CREEE'
  | 'AG_OUVERTE'
  | 'AG_CLOTUREE'
  | 'VOTE_ENREGISTRE'
  | 'VOTE_MODIFIE'
  | 'INCIDENT_DECLARE'
  | 'INCIDENT_STATUT_MODIFIE'
  | 'CHARGE_CREEE'
  | 'CHARGE_PAYEE';

type Sortie = (ligne: string) => void;

const sortieStandard: Sortie = (ligne) => {
  process.stdout.write(`${ligne}\n`);
};
// Silencieux sous test (NODE_ENV=test posé par Vitest) pour ne pas polluer la sortie des suites.
const sortieParDefaut: Sortie = process.env.NODE_ENV === 'test' ? () => undefined : sortieStandard;
let sortie: Sortie = sortieParDefaut;

export const journalService = {
  journaliser(
    action: ActionJournal,
    utilisateurId: string,
    cible?: string,
    details?: Record<string, string | number | boolean>,
  ): void {
    sortie(
      JSON.stringify({
        type: 'audit',
        horodatage: new Date().toISOString(),
        action,
        utilisateurId,
        ...(cible ? { cible } : {}),
        ...(details ? { details } : {}),
      }),
    );
  },

  /** Pour les tests : capture les lignes au lieu de les écrire ; sans argument, rétablit la sortie par défaut. */
  definirSortie(nouvelleSortie?: Sortie): void {
    sortie = nouvelleSortie ?? sortieParDefaut;
  },
};
