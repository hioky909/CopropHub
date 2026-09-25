export type TypeCompte = 'SYNDIC' | 'COPROPRIETAIRE';

export interface Utilisateur {
  id: string;
  email: string;
  typeCompte: TypeCompte;
  estMembreConseilSyndical: boolean;
  /** Thème de couleur personnalisé ; `null` ou absent = thème CopropHub d'origine. */
  theme?: { teinte: number; intensite: number } | null;
}

export type StatutAg = 'PLANIFIEE' | 'OUVERTE' | 'CLOTUREE';
export type TypeMajorite = 'SIMPLE' | 'ABSOLUE' | 'DOUBLE_MAJORITE' | 'UNANIMITE';
export type StatutResultat = 'EN_ATTENTE' | 'ADOPTEE' | 'REJETEE';

export interface Ag {
  id: string;
  dateAg: string;
  statut: StatutAg;
  /** Présent dans la liste `GET /ags` uniquement. */
  nombreResolutions?: number;
}

export interface ResolutionOrdreDuJour {
  id: string;
  libelle: string;
  typeMajorite: TypeMajorite;
}

export interface ResolutionResultat extends ResolutionOrdreDuJour {
  statutResultat: StatutResultat;
  decomptes: { oui: number; non: number; abstention: number };
  /** Art. 25-1 : art. 25 rejeté avec au moins un tiers des voix — un second vote à la majorité simple est permis. */
  secondVoteArt251Possible?: boolean;
}

export type StatutIncident = 'DECLARE' | 'EN_COURS' | 'RESOLU';

export interface Incident {
  id: string;
  idLot: string | null;
  idUtilisateurDeclarant: string | null;
  titre: string;
  description: string | null;
  statut: StatutIncident;
  dateCreation: string;
}

export type StatutCharge = 'A_PAYER' | 'PAYEE' | 'EN_RETARD';

export interface Charge {
  id: string;
  idLot: string;
  montant: string;
  periode: string;
  statut: StatutCharge;
  dateEcheance: string | null;
}

export interface Lot {
  id: string;
  numero: string;
  typeLot: string;
}

export interface Coproprietaire {
  id: string;
  nom: string;
  email: string;
  estMembreConseilSyndical: boolean;
}

export interface LotAvecProprietaire extends Lot {
  proprietaire: { id: string; nom: string } | null;
}
