import { Router } from 'express';
import { z } from 'zod';
import { exigerAuthentification } from '../middleware/session.middleware.js';
import {
  chargeService,
  ChargeIntrouvableError,
  AccesChargeRefuseError,
} from '../services/charge.service.js';
import { asyncHandler } from '../middleware/async-handler.js';

/**
 * Controller — T-14 (F-09, US-01, US-05). Authentification exigée ; la
 * portée (toutes les charges ou seulement les siennes) est décidée par le
 * service selon le rôle (RM-10, RM-14). Consultation seule : aucune route
 * d'écriture ici (cf. `charge.service.ts`).
 */
export const chargeRouter = Router();
chargeRouter.use(exigerAuthentification);

function serialiser(charge: {
  id: string;
  idLot: string;
  montant: { toFixed(dp: number): string };
  periode: string;
  statut: string;
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

const paramsChargeSchema = z.object({ idCharge: z.string().uuid() });

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
