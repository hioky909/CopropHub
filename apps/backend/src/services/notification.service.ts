import { agRepository } from '../repositories/ag.repository.js';
import { chargeRepository } from '../repositories/charge.repository.js';
import { incidentRepository } from '../repositories/incident.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { utilisateurRepository } from '../repositories/utilisateur.repository.js';
import { evenementsService } from './evenements.service.js';
import { mailService, SmtpNonConfigureError, urlApplication } from './mail.service.js';

/**
 * Business Layer — F-12 : notifications par email. Courriels de service (ouverture ou clôture d'une
 * assemblée, avancement d'un incident, nouvelle charge), envoyés par SMTP après l'action, jamais
 * pendant la requête. Chaque utilisateur peut les désactiver (`notificationsEmail`).
 *
 * Confidentialité : aucun courriel ne contient de valeur de vote ni de résultat détaillé, ni le
 * montant d'une charge ; chaque destinataire ne reçoit que ce qui le concerne. Les échecs d'envoi
 * sont journalisés sans adresse ni nom et ne remontent jamais à l'utilisateur.
 */

interface Destinataire {
  email: string;
  nom: string;
}

interface Message {
  sujet: string;
  texte: string;
}

function dateLongue(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function pied(): string {
  return `\n\nVous recevez ce message car les notifications par email sont activées sur votre compte CopropHub. Vous pouvez les désactiver dans « Mon compte » : ${urlApplication()}/compte\n`;
}

/** Envoie un message à chaque destinataire, un par un ; l'échec de l'un n'empêche pas les autres. */
async function envoyer(
  evenement: string,
  destinataires: Destinataire[],
  construire: (d: Destinataire) => Message,
): Promise<void> {
  let echecs = 0;
  for (const destinataire of destinataires) {
    const { sujet, texte } = construire(destinataire);
    try {
      await mailService.envoyer({ a: destinataire.email, sujet, texte });
    } catch (erreur) {
      if (erreur instanceof SmtpNonConfigureError) return; // pas de serveur d'envoi configuré : rien à faire
      echecs += 1;
    }
  }
  if (echecs > 0) {
    process.stderr.write(
      `${JSON.stringify({ type: 'notification_erreur', evenement, destinataires: destinataires.length, echecs })}\n`,
    );
  }
}

export const notificationService = {
  async notifierOuvertureAg(idAg: string): Promise<void> {
    const ag = await agRepository.parId(idAg);
    if (!ag) return;
    const destinataires = await utilisateurRepository.coproprietairesANotifier(ag.idImmeuble);
    const date = dateLongue(ag.dateAg);
    await envoyer('AG_OUVERTE', destinataires, ({ nom }) => ({
      sujet: `Vote ouvert — assemblée générale du ${date}`,
      texte: `Bonjour ${nom},\n\nLe vote de l'assemblée générale du ${date} est ouvert. Vous pouvez voter en ligne jusqu'à sa clôture par le syndic :\n${urlApplication()}/assemblees/${ag.id}${pied()}`,
    }));
  },

  async notifierClotureAg(idAg: string): Promise<void> {
    const ag = await agRepository.parId(idAg);
    if (!ag) return;
    const destinataires = await utilisateurRepository.coproprietairesANotifier(ag.idImmeuble);
    const date = dateLongue(ag.dateAg);
    await envoyer('AG_CLOTUREE', destinataires, ({ nom }) => ({
      sujet: `Résultats disponibles — assemblée générale du ${date}`,
      texte: `Bonjour ${nom},\n\nLe vote de l'assemblée générale du ${date} est clôturé. Les résultats sont consultables en ligne :\n${urlApplication()}/assemblees/${ag.id}${pied()}`,
    }));
  },

  /** Seul le déclarant est prévenu, et seulement s'il a gardé les notifications actives. */
  async notifierStatutIncident(idIncident: string): Promise<void> {
    const incident = await incidentRepository.parId(idIncident);
    if (!incident) return;
    const declarant = await utilisateurRepository.parId(incident.idUtilisateurDeclarant);
    if (!declarant || !declarant.notificationsEmail) return;
    const etat = incident.statut === 'RESOLU' ? 'résolu' : 'en cours de traitement';
    await envoyer('INCIDENT_STATUT_MODIFIE', [{ email: declarant.email, nom: declarant.nom }], ({ nom }) => ({
      sujet: `Votre incident est ${etat}`,
      texte: `Bonjour ${nom},\n\nVotre incident « ${incident.titre} » est ${etat}. Vous pouvez suivre son avancement :\n${urlApplication()}/incidents${pied()}`,
    }));
  },

  /** Seul le propriétaire actuel du lot est prévenu ; le montant n'est jamais écrit dans le courriel. */
  async notifierChargeCreee(idCharge: string): Promise<void> {
    const charge = await chargeRepository.parId(idCharge);
    if (!charge) return;
    const [lot, rattachement] = await Promise.all([
      lotRepository.parId(charge.idLot),
      lotRepository.rattachementActif(charge.idLot),
    ]);
    if (!lot || !rattachement) return;
    const proprietaire = await utilisateurRepository.parId(rattachement.idUtilisateur);
    if (!proprietaire || !proprietaire.notificationsEmail) return;
    const echeance = charge.dateEcheance ? `, à régler avant le ${dateLongue(charge.dateEcheance)}` : '';
    await envoyer('CHARGE_CREEE', [{ email: proprietaire.email, nom: proprietaire.nom }], ({ nom }) => ({
      sujet: `Nouvelle charge pour votre lot ${lot.numero}`,
      texte: `Bonjour ${nom},\n\nUne charge a été ajoutée pour votre lot ${lot.numero} (période ${charge.periode}${echeance}). Consultez le détail :\n${urlApplication()}/charges${pied()}`,
    }));
  },

  /** À appeler une fois au démarrage du serveur : relie les événements métier aux notifications. */
  abonner(): void {
    evenementsService.abonner('AG_OUVERTE', ({ idAg }) => this.notifierOuvertureAg(idAg));
    evenementsService.abonner('AG_CLOTUREE', ({ idAg }) => this.notifierClotureAg(idAg));
    evenementsService.abonner('INCIDENT_STATUT_MODIFIE', ({ idIncident }) => this.notifierStatutIncident(idIncident));
    evenementsService.abonner('CHARGE_CREEE', ({ idCharge }) => this.notifierChargeCreee(idCharge));
  },

  /** Préférence de l'utilisateur lui-même (la cible est toujours la session, jamais un identifiant reçu). */
  async definirPreference(idUtilisateur: string, actives: boolean): Promise<boolean> {
    await utilisateurRepository.definirNotificationsEmail(idUtilisateur, actives);
    return actives;
  },
};
