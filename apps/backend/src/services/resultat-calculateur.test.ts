import { describe, expect, it } from 'vitest';
import type { TypeMajorite } from '@prisma/client';
import { calculerResultat } from './resultat-calculateur.js';

type Cas = [
  libelle: string,
  oui: number,
  non: number,
  abstention: number,
  inscrits: number,
  attendu: 'ADOPTEE' | 'REJETEE',
];

function verifier(type: TypeMajorite, cas: Cas[]) {
  it.each(cas)('%s', (_libelle, oui, non, abstention, inscrits, attendu) => {
    expect(calculerResultat(type, { oui, non, abstention }, inscrits)).toBe(attendu);
  });
}

describe('calculerResultat — majorité simple (oui > non, abstentions exclues)', () => {
  verifier('SIMPLE', [
    ['3 oui contre 2 non : adoptée', 3, 2, 0, 10, 'ADOPTEE'],
    ['égalité 2 contre 2 : rejetée', 2, 2, 0, 10, 'REJETEE'],
    ['UT-02 (Doc 6) : 2 oui / 2 non / 1 abstention : rejetée (égalité, abstention exclue)', 2, 2, 1, 10, 'REJETEE'],
    ['plus de non que de oui : rejetée', 1, 4, 0, 10, 'REJETEE'],
    ['1 oui, 0 non, 10 abstentions : adoptée (abstentions exclues)', 1, 0, 10, 20, 'ADOPTEE'],
    ['aucune voix exprimée : rejetée', 0, 0, 0, 10, 'REJETEE'],
    ['seulement des abstentions : rejetée', 0, 0, 5, 10, 'REJETEE'],
  ]);
});

describe('calculerResultat — majorité absolue (oui > moitié des inscrits)', () => {
  verifier('ABSOLUE', [
    ['N=10, 6 oui : adoptée', 6, 0, 0, 10, 'ADOPTEE'],
    ['N=10, 5 oui = exactement la moitié : rejetée', 5, 0, 0, 10, 'REJETEE'],
    ['N=9, 5 oui (> 4,5) : adoptée', 5, 0, 0, 9, 'ADOPTEE'],
    ['N=9, 4 oui (< 4,5) : rejetée', 4, 0, 0, 9, 'REJETEE'],
    ['N=10, 5 oui contre 0 non : les non-votants comptent contre, rejetée', 5, 0, 0, 10, 'REJETEE'],
    ['N=10, 6 oui malgré 4 non : adoptée', 6, 4, 0, 10, 'ADOPTEE'],
    ['N=1, 1 oui : adoptée', 1, 0, 0, 1, 'ADOPTEE'],
  ]);
});

describe('calculerResultat — double majorité (oui ≥ 2/3 des inscrits)', () => {
  verifier('DOUBLE_MAJORITE', [
    ['N=9, 6 oui = exactement 2/3 : adoptée', 6, 0, 0, 9, 'ADOPTEE'],
    ['N=9, 5 oui : rejetée', 5, 0, 0, 9, 'REJETEE'],
    ['N=10, 7 oui (≥ 6,67) : adoptée', 7, 0, 0, 10, 'ADOPTEE'],
    ['N=10, 6 oui (< 6,67) : rejetée', 6, 0, 0, 10, 'REJETEE'],
    ['N=3, 2 oui = 2/3 : adoptée', 2, 1, 0, 3, 'ADOPTEE'],
    ['N=1, 1 oui : adoptée', 1, 0, 0, 1, 'ADOPTEE'],
  ]);
});

describe('calculerResultat — unanimité (tous les inscrits votent oui)', () => {
  verifier('UNANIMITE', [
    ['N=4, 4 oui : adoptée', 4, 0, 0, 4, 'ADOPTEE'],
    ['N=4, 3 oui + 1 abstention : rejetée', 3, 0, 1, 4, 'REJETEE'],
    ['N=4, 3 oui + 1 non : rejetée', 3, 1, 0, 4, 'REJETEE'],
    ['N=4, 3 oui + 1 non-votant : rejetée', 3, 0, 0, 4, 'REJETEE'],
    ['UT-05 (Doc 6) : 9 oui sur 10 copropriétaires (1 absent) : rejetée (RM-03, tous doivent voter oui)', 9, 0, 0, 10, 'REJETEE'],
    ['N=1, 1 oui : adoptée', 1, 0, 0, 1, 'ADOPTEE'],
  ]);
});

describe('calculerResultat — cas dégénérés', () => {
  it.each(['SIMPLE', 'ABSOLUE', 'DOUBLE_MAJORITE', 'UNANIMITE'] as const)(
    'aucun copropriétaire habilité : %s ne peut pas être adoptée, même sans aucune voix',
    (type) => {
      expect(calculerResultat(type, { oui: 0, non: 0, abstention: 0 }, 0)).toBe('REJETEE');
    },
  );

  it("un nombre d'inscrits négatif est traité comme aucun inscrit", () => {
    expect(calculerResultat('DOUBLE_MAJORITE', { oui: 0, non: 0, abstention: 0 }, -1)).toBe(
      'REJETEE',
    );
  });
});
