import { Router } from 'express';
import { z } from 'zod';
import { exigerAuthentification, exigerRoleSyndic } from '../middleware/session.middleware.js';
import {
  utilisateurService,
  EmailDejaUtiliseError,
  LotIntrouvableError,
  UtilisateurIntrouvableError,
  RattachementConcurrentError,
  CompteNonCoproprietaireError,
} from '../services/utilisateur.service.js';
import {
  lotService,
  LotDejaExistantError,
  ImmeubleNonInitialiseError,
} from '../services/lot.service.js';
import { MotDePasseInvalideError } from '../services/mot-de-passe.service.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { journalService } from '../services/journal.service.js';

/**
 * Controller — T-06 (F-02, F-03, US-10). Toutes les routes sont réservées
 * au syndic (`exigerRoleSyndic`, RM-14 niveau 1 : rôle). Liste blanche
 * stricte des champs acceptés à chaque endpoint — les champs de rôle
 * (`typeCompte`, `estMembreConseilSyndical`) ne sont jamais acceptés
 * depuis une requête utilisateur, conformément à Doc 5 § Mass assignment.
 */
export const utilisateursRouter = Router();

/**
 * Lots rattachés à l'utilisateur courant — ouvert à tout compte
 * authentifié (contrairement au reste de ce routeur, réservé au syndic) :
 * c'est toujours SA propre donnée, jamais celle d'un autre utilisateur
 * (anti-IDOR : aucun paramètre `idUtilisateur` n'est accepté ici).
 */
utilisateursRouter.get(
  '/moi/lots',
  exigerAuthentification,
  asyncHandler(async (req, res) => {
    const lots = await lotService.mesLots(req.utilisateur!.id);
    res.status(200).json({
      lots: lots.map((lot) => ({ id: lot.id, numero: lot.numero, typeLot: lot.typeLot })),
    });
  }),
);

utilisateursRouter.use(exigerAuthentification, exigerRoleSyndic);

const creerCoproprietaireSchema = z.object({
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  motDePasse: z.string(),
});

utilisateursRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const coproprietaires = await utilisateurService.listerCoproprietaires();
    res.status(200).json({
      coproprietaires: coproprietaires.map((u: (typeof coproprietaires)[number]) => ({
        id: u.id,
        nom: u.nom,
        email: u.email,
        estMembreConseilSyndical: u.estMembreConseilSyndical,
      })),
    });
  }),
);

utilisateursRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const analyse = creerCoproprietaireSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const coproprietaire = await utilisateurService.creerCoproprietaire({
        nom: analyse.data.nom,
        email: analyse.data.email,
        motDePasseClair: analyse.data.motDePasse,
      });
      journalService.journaliser('COPROPRIETAIRE_CREE', req.utilisateur!.id, coproprietaire.id);
      res.status(201).json({
        utilisateur: {
          id: coproprietaire.id,
          nom: coproprietaire.nom,
          email: coproprietaire.email,
        },
      });
    } catch (erreur) {
      if (erreur instanceof EmailDejaUtiliseError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof MotDePasseInvalideError) {
        res.status(422).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

utilisateursRouter.get(
  '/lots',
  asyncHandler(async (_req, res) => {
    res.status(200).json({ lots: await lotService.listerLots() });
  }),
);

const creerLotSchema = z.object({
  numero: z.string().trim().min(1).max(20),
  typeLot: z.string().trim().min(1).max(50),
});

utilisateursRouter.post(
  '/lots',
  asyncHandler(async (req, res) => {
    const analyse = creerLotSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const lot = await lotService.creerLot(analyse.data);
      journalService.journaliser('LOT_CREE', req.utilisateur!.id, lot.id);
      res.status(201).json({ lot });
    } catch (erreur) {
      if (erreur instanceof LotDejaExistantError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof ImmeubleNonInitialiseError) {
        res.status(500).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

const rattacherLotSchema = z.object({
  idLot: z.string().uuid(),
  idUtilisateur: z.string().uuid(),
});

utilisateursRouter.post(
  '/lots/rattachement',
  asyncHandler(async (req, res) => {
    const analyse = rattacherLotSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const rattachement = await utilisateurService.rattacherLot(
        analyse.data.idLot,
        analyse.data.idUtilisateur,
      );
      journalService.journaliser('LOT_RATTACHE', req.utilisateur!.id, analyse.data.idLot, {
        idUtilisateur: analyse.data.idUtilisateur,
      });
      res.status(201).json({ rattachement });
    } catch (erreur) {
      if (erreur instanceof LotIntrouvableError || erreur instanceof UtilisateurIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof RattachementConcurrentError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

/** Équipe du syndic : liste et création de comptes SYNDIC supplémentaires (réservé au syndic, comme tout ce routeur). */
utilisateursRouter.get(
  '/syndics',
  asyncHandler(async (_req, res) => {
    const syndics = await utilisateurService.listerSyndics();
    res.status(200).json({
      syndics: syndics.map((u) => ({ id: u.id, nom: u.nom, email: u.email })),
    });
  }),
);

utilisateursRouter.post(
  '/syndics',
  asyncHandler(async (req, res) => {
    const analyse = creerCoproprietaireSchema.safeParse(req.body);
    if (!analyse.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const syndic = await utilisateurService.creerSyndic({
        nom: analyse.data.nom,
        email: analyse.data.email,
        motDePasseClair: analyse.data.motDePasse,
      });
      journalService.journaliser('SYNDIC_CREE', req.utilisateur!.id, syndic.id);
      res.status(201).json({ utilisateur: { id: syndic.id, nom: syndic.nom, email: syndic.email } });
    } catch (erreur) {
      if (erreur instanceof EmailDejaUtiliseError) {
        res.status(409).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof MotDePasseInvalideError) {
        res.status(422).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);

const conseilSyndicalSchema = z.object({ estMembre: z.boolean() });
const paramsUtilisateurSchema = z.object({ idUtilisateur: z.string().uuid() });

/** Désigner ou retirer un membre du conseil syndical. Seul un copropriétaire peut l'être (422 sinon). */
utilisateursRouter.patch(
  '/:idUtilisateur/conseil-syndical',
  asyncHandler(async (req, res) => {
    const params = paramsUtilisateurSchema.safeParse(req.params);
    const corps = conseilSyndicalSchema.safeParse(req.body);
    if (!params.success || !corps.success) {
      res.status(422).json({ erreur: 'Requête invalide.' });
      return;
    }

    try {
      const utilisateur = await utilisateurService.definirConseilSyndical(
        params.data.idUtilisateur,
        corps.data.estMembre,
      );
      journalService.journaliser('CONSEIL_SYNDICAL_MODIFIE', req.utilisateur!.id, utilisateur.id, {
        estMembre: utilisateur.estMembreConseilSyndical,
      });
      res.status(200).json({
        utilisateur: { id: utilisateur.id, estMembreConseilSyndical: utilisateur.estMembreConseilSyndical },
      });
    } catch (erreur) {
      if (erreur instanceof UtilisateurIntrouvableError) {
        res.status(404).json({ erreur: erreur.message });
        return;
      }
      if (erreur instanceof CompteNonCoproprietaireError) {
        res.status(422).json({ erreur: erreur.message });
        return;
      }
      throw erreur;
    }
  }),
);
