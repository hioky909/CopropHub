import type { StatutResolution, TypeMajorite } from '@prisma/client';

/**
 * Business Layer — T-10 (F-06, RM-03) : calcul du résultat d'une résolution
 * selon son type de majorité. Fonction pure, sans accès aux données.
 *
 * `nombreInscrits` = nombre de copropriétaires habilités à voter (rattachés
 * à au moins un lot, RM-06) au moment de la clôture, votants ET non-votants.
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
