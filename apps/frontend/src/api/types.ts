export type TypeCompte = 'SYNDIC' | 'COPROPRIETAIRE';

export interface Utilisateur {
  id: string;
  email: string;
  typeCompte: TypeCompte;
  estMembreConseilSyndical: boolean;
}

export type StatutAg = 'PLANIFIEE' | 'OUVERTE' | 'CLOTUREE';
export type TypeMajorite = 'SIMPLE' | 'ABSOLUE' | 'DOUBLE_MAJORITE' | 'UNANIMITE';
export type StatutResultat = 'EN_ATTENTE' | 'ADOPTEE' | 'REJETEE';

export interface Ag {
  id: string;
  dateAg: string;
  statut: StatutAg;
}

export interface ResolutionOrdreDuJour {
  id: string;
  libelle: string;
  typeMajorite: TypeMajorite;
}

export interface ResolutionResultat extends ResolutionOrdreDuJour {
  statutResultat: StatutResultat;
  decomptes: { oui: number; non: number; abstention: number };
}

export type StatutIncident = 'DECLARE' | 'EN_COURS' | 'RESOLU';

export interface Incident {
  id: string;
  idLot: string | null;
  idUtilisateurDeclarant: string;
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
}

export interface Lot {
  id: string;
  numero: string;
  typeLot: string;
}
