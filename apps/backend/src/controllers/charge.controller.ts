import { Router } from 'express';
import { z } from 'zod';
import { exigerAuthentification, exigerRoleSyndic } from '../middleware/session.middleware.js';
import {
  chargeService,
  ChargeIntrouvableError,
  AccesChargeRefuseError,
  ChargeDejaPayeeError,
  LotDeLaChargeIntrouvableError,
} from '../services/charge.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { journalService } from '../services/journal.service.js';
import { documentService } from '../services/document.service.js';

/**
 * Controller — T-14 (F-09, US-01, US-05). Authentification exigée ; la
 * portée (toutes les charges ou seulement les siennes) est décidée par le
 * service selon le rôle (RM-10, RM-14). Écritures (création, paiement) :
 * syndic uniquement (RM-14).
 */
export const chargeRouter = Router();
chargeRouter.use(exigerAuthentification);

function serialiser(charge: {
  id: string;
  idLot: string;
  montant: { toFixed(dp: number): string };
  periode: string;
  statut: string;
  dateEcheance?: Date | null;
}) {
  return {
    id: charge.id,
    idLot: charge.idLot,
    // Decimal (Doc 3, NUMERIC(10,2)) sérialisé en chaîne à 2 décimales fixes :
    // jamais un nombre flottant JS pour un montant financier, et jamais
    // `.toString()` seul, qui tronquerait les zéros de fin ("150" au lieu
    // de "150.00").
    montant: charge.montant.toFixed(2),
    periode: charge.periode,
    statut: charge.statut,
    dateEcheance: charge.dateEcheance ? charge.dateEcheance.toISOString().slice(0, 10) : null,
  };
}

chargeRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    // exigerAuthentification garantit req.utilisateur.
    const charges = await chargeService.lister(req.utilisateur!);
    res.status(200).json({ charges: charges.map(serialiser) });
  }),
);

/** Date calendaire réelle AAAA-MM-JJ (rejette 2026-02-30, que `new Date` corrigerait silencieusement). */
const dateCalendaire = z
  .string()
  // eslint-disable-next-line security/detect-unsafe-regex -- motif borné (4+2+2 chiffres, aucune répétition imbriquée) : pas de backtracking catastrophique possible.
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((valeur) => {
    const date = new Date(`${valeur}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(valeur);
  });

const creerChargeSchema = z.object({
  idLot: z.string().uuid(),
  // Montant en euros avec au plus 2 décimales, strictement positif (CHECK montant > 0 en base).
  montant: z
    .string()
    // eslint-disable-next-line security/detect-unsafe-regex -- motif borné (8 chiffres + 2 décimales max), pas de répétition imbriquée : pas de backtracking catastrophique possible.
    .regex(/^\d{1,8}(\.\d{1,2})?$/)
    .refine((valeur) => Number(valeur) > 0),
  periode: z.string().trim().min(1).max(20),
  dateEcheance: dateCalendaire.optional(),
});

chargeRouter.post(
  '/',
  exigerRoleSyndic,
  asyncHandler(async (req, res) => {
    const analyse = creerChargeSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const charge = await chargeService.creer({
        idLot: analyse.data.idLot,
        montant: analyse.data.montant,
        periode: analyse.data.periode,
        dateEcheance: analyse.data.dateEcheance
          ? new Date(`${analyse.data.dateEcheance}T00:00:00.000Z`)
          : null,
      });
      journalService.journaliser('CHARGE_CREEE', req.utilisateur!.id, charge.id);
      res.status(201).json({ charge: serialiser(charge) });
    } catch (erreur) {
      if (erreur instanceof LotDeLaChargeIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

const paramsChargeSchema = z.object({ idCharge: z.string().uuid() });

/**
 * F-13 : relevé de charges en PDF. Même portée que la liste (`chargeService.lister`) : tout pour le
 * syndic et le conseil syndical, seulement les charges de ses lots pour un copropriétaire (RM-10).
 * Déclaré avant `/:idCharge`, qui l'intercepterait sinon.
 */
chargeRouter.get(
  '/export.pdf',
  asyncHandler(async (req, res) => {
    const { pdf, nomFichier } = await documentService.releveCharges(req.utilisateur!);
    journalService.journaliser('RELEVE_CHARGES_EXPORTE', req.utilisateur!.id);
    res
      .status(200)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomFichier}"`,
        'Cache-Control': 'no-store',
      })
      .send(pdf);
  }),
);

chargeRouter.get(
  '/:idCharge',
  asyncHandler(async (req, res) => {
    const params = paramsChargeSchema.safeParse(req.params);
    if (!params.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const charge = await chargeService.voirUne(req.utilisateur!, params.data.idCharge);
      res.status(200).json({ charge: serialiser(charge) });
    } catch (erreur) {
      if (erreur instanceof ChargeIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof AccesChargeRefuseError) {
        res.status(403).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

/** Le syndic enregistre le paiement d'une charge (déclaratif au MVP, RM-09). 409 si elle est déjà payée. */
chargeRouter.patch(
  '/:idCharge/paiement',
  exigerRoleSyndic,
  asyncHandler(async (req, res) => {
    const params = paramsChargeSchema.safeParse(req.params);
    if (!params.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const charge = await chargeService.marquerPayee(params.data.idCharge);
      journalService.journaliser('CHARGE_PAYEE', req.utilisateur!.id, charge.id);
      res.status(200).json({ charge: serialiser(charge) });
    } catch (erreur) {
      if (erreur instanceof ChargeIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof ChargeDejaPayeeError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);
