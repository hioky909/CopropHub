import type { StatutResolution, TypeMajorite } from '@prisma/client';

/**
 * Business Layer — T-10 (F-06, RM-03) : calcul du résultat d'une résolution
 * selon son type de majorité. Fonction pure, sans accès aux données.
 *
 * `nombreInscrits` = nombre de copropriétaires habilités à voter (rattachés
 * à au moins un lot, RM-06) figé à l'ouverture du vote (`ag.nombre_inscrits_geles`), votants ET non-votants.
 * Une voix par copropriétaire (RM-02).
 *
 * Arithmétique entière uniquement (jamais de division) : les seuils « la
 * moitié » et « deux tiers » se jouent à une voix près et un arrondi
 * flottant les fausserait.
 */
export interface ComptesVotes {
  oui: number;
  non: number;
  abstention: number;
}

export function calculerResultat(
  type: TypeMajorite,
  comptes: ComptesVotes,
  nombreInscrits: number,
): Extract<StatutResolution, 'ADOPTEE' | 'REJETEE'> {
  // Aucun copropriétaire habilité : aucune décision valable ne peut être
  // prise (et sans ce garde-fou, « oui ≥ 2/3 de 0 » adopterait à vide).
  if (nombreInscrits <= 0) {
    return 'REJETEE';
  }

  const { oui, non } = comptes;
  let adoptee: boolean;

  switch (type) {
    case 'SIMPLE':
      // Abstentions exclues du calcul ; une égalité ne suffit pas.
      adoptee = oui > non;
      break;
    case 'ABSOLUE':
      // oui > N / 2 ; abstentions et non-votants comptent contre.
      adoptee = oui * 2 > nombreInscrits;
      break;
    case 'DOUBLE_MAJORITE':
      // oui ≥ 2N / 3 ; pile deux tiers suffit.
      adoptee = oui * 3 >= nombreInscrits * 2;
      break;
    case 'UNANIMITE':
      // Tous les inscrits ont voté « oui » : ni non, ni abstention, ni absent.
      adoptee = oui === nombreInscrits;
      break;
  }

  return adoptee ? 'ADOPTEE' : 'REJETEE';
}

/**
 * Art. 25-1 de la loi du 10 juillet 1965 : une résolution de l'art. 25 qui échoue mais recueille
 * au moins le tiers des voix de tous les copropriétaires peut faire l'objet, dans la même
 * assemblée, d'un second vote immédiat à la majorité simple (art. 24).
 *
 * Volontairement un simple indicateur : la clôture reste définitive (RM-04) et le second vote se
 * tient sous forme d'une nouvelle résolution de majorité simple — l'application ne rouvre jamais
 * une AG. Une voix par copropriétaire (RM-02), donc le « tiers des voix » est un tiers des inscrits.
 */
export function secondVoteArt251Possible(
  type: TypeMajorite,
  statut: StatutResolution | null,
  comptes: ComptesVotes,
  nombreInscrits: number | null,
): boolean {
  if (type !== 'ABSOLUE' || statut !== 'REJETEE' || nombreInscrits === null || nombreInscrits <= 0) {
    return false;
  }
  return comptes.oui * 3 >= nombreInscrits;
}
