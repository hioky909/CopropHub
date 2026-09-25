/**
 * Business Layer — petit bus d'événements interne. Les services métier annoncent ce qui vient
 * d'arriver (« AG ouverte »…) sans savoir qui s'y intéresse ; les abonnés (notifications par email)
 * réagissent EN DEHORS de la requête : un abonné lent ou en erreur ne retarde ni ne fait jamais
 * échouer l'action métier. Aucun abonné n'est enregistré par défaut (les tests unitaires et
 * d'intégration restent silencieux tant qu'ils ne s'abonnent pas explicitement).
 */

export interface EvenementsMetier {
  AG_OUVERTE: { idAg: string };
  AG_CLOTUREE: { idAg: string };
  INCIDENT_STATUT_MODIFIE: { idIncident: string };
  CHARGE_CREEE: { idCharge: string };
}

export type NomEvenement = keyof EvenementsMetier;
type Abonne<N extends NomEvenement> = (donnees: EvenementsMetier[N]) => Promise<void> | void;

const abonnes = new Map<NomEvenement, Abonne<never>[]>();
const enCours = new Set<Promise<void>>();

function journaliserErreur(evenement: string, erreur: unknown): void {
  // Sans donnée personnelle : seulement le nom de l'événement et le message technique.
  process.stderr.write(
    `${JSON.stringify({ type: 'evenement_erreur', evenement, message: erreur instanceof Error ? erreur.message : 'erreur inconnue' })}\n`,
  );
}

export const evenementsService = {
  abonner<N extends NomEvenement>(nom: N, abonne: Abonne<N>): void {
    const liste = abonnes.get(nom) ?? [];
    liste.push(abonne as Abonne<never>);
    abonnes.set(nom, liste);
  },

  /** Ne lance jamais d'exception et n'attend pas les abonnés : à appeler sans `await` depuis un service. */
  emettre<N extends NomEvenement>(nom: N, donnees: EvenementsMetier[N]): void {
    for (const abonne of (abonnes.get(nom) ?? []) as Abonne<N>[]) {
      const travail = (async () => {
        try {
          await abonne(donnees);
        } catch (erreur) {
          journaliserErreur(nom, erreur);
        }
      })();
      enCours.add(travail);
      void travail.finally(() => enCours.delete(travail));
    }
  },

  /** Pour les tests : attend la fin de tous les traitements d'abonnés déclenchés. */
  async attendreFin(): Promise<void> {
    while (enCours.size > 0) {
      await Promise.all([...enCours]);
    }
  },

  /** Pour les tests : retire tous les abonnés. */
  reinitialiser(): void {
    abonnes.clear();
  },
};
