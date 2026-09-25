import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  dateLongue,
  documentService,
  formaterEuros,
  pdfProcesVerbal,
  pdfReleveCharges,
  type DonneesProcesVerbal,
  type DonneesReleveCharges,
} from './document.service.js';
import { agService, ResolutionsNonDisponiblesError } from './ag.service.js';
import { chargeService } from './charge.service.js';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import { estUnPdf, nombreDePages, texteDuPdf } from '../testing/pdf-texte.js';

afterEach(() => vi.restoreAllMocks());

const IMMEUBLE = { nom: 'Résidence des Tilleuls', adresse: '12 rue des Lilas, 75011 Paris' };
const GENERE_LE = new Date('2026-11-15T10:00:00.000Z');

describe('formaterEuros et dateLongue', () => {
  it.each([
    [0, '0,00 €'],
    [5, '0,05 €'],
    [123450, '1 234,50 €'],
    [100000000, '1 000 000,00 €'],
    [-2550, '-25,50 €'],
  ])('%s centimes → « %s »', (centimes, attendu) => {
    expect(formaterEuros(centimes)).toBe(attendu);
  });

  it('écrit une date calendaire sans décalage de fuseau', () => {
    expect(dateLongue(new Date('2026-11-14T00:00:00.000Z'))).toBe('14 novembre 2026');
    expect(dateLongue(new Date('2026-01-01T00:00:00.000Z'))).toBe('1 janvier 2026');
  });
});

describe('pdfProcesVerbal', () => {
  const donnees: DonneesProcesVerbal = {
    immeuble: IMMEUBLE,
    dateAg: new Date('2026-11-14T00:00:00.000Z'),
    nombreInscrits: 12,
    genereLe: GENERE_LE,
    resolutions: [
      { libelle: 'Approbation des comptes de l’exercice', typeMajorite: 'SIMPLE', statutResultat: 'ADOPTEE', decomptes: { oui: 8, non: 2, abstention: 1 } },
      { libelle: 'Ravalement de façade', typeMajorite: 'ABSOLUE', statutResultat: 'REJETEE', decomptes: { oui: 4, non: 6, abstention: 0 } },
      { libelle: 'Vidéosurveillance', typeMajorite: 'DOUBLE_MAJORITE', statutResultat: 'REJETEE', decomptes: { oui: 1, non: 9, abstention: 2 } },
    ],
  };

  it('produit un vrai PDF A4 d’une page, avec titre et métadonnées', async () => {
    const pdf = await pdfProcesVerbal(donnees);
    expect(estUnPdf(pdf)).toBe(true);
    expect(nombreDePages(pdf)).toBe(1);
    expect(pdf.toString('latin1')).toContain('/Title');
    expect(pdf.length).toBeLessThan(50_000);
  });

  it('contient l’immeuble, la date, chaque résolution avec sa majorité, ses décomptes et son résultat', async () => {
    const texte = texteDuPdf(await pdfProcesVerbal(donnees));
    expect(texte).toContain('Résidence des Tilleuls — 12 rue des Lilas, 75011 Paris');
    expect(texte).toContain('Assemblée générale du 14 novembre 2026');
    expect(texte).toContain('Copropriétaires inscrits au vote : 12');
    expect(texte).toContain('Résolution 1 — Approbation des comptes de l’exercice');
    expect(texte).toContain('Majorité simple (art. 24)');
    expect(texte).toContain('Pour : 8    Contre : 2    Abstentions : 1    Non-votants : 1');
    expect(texte).toContain('Résultat : ADOPTÉE');
    expect(texte).toContain('Résolution 3 — Vidéosurveillance');
    expect(texte).toContain('Double majorité (art. 26)');
    expect(texte).toContain('Résultat : REJETÉE');
  });

  it('signale le second vote possible (art. 25-1) seulement pour la résolution concernée', async () => {
    const texte = texteDuPdf(await pdfProcesVerbal(donnees));
    expect(texte.match(/art\. 25-1/g)).toHaveLength(1); // « Ravalement » : 4 oui sur 12 = un tiers
  });

  it('n’expose que des décomptes anonymes et le précise', async () => {
    const texte = texteDuPdf(await pdfProcesVerbal(donnees));
    expect(texte).toContain('l’identité des votants n’est jamais consignée');
  });

  it('sans électorat connu (AG ouverte avant la migration), omet les non-votants et l’art. 25-1', async () => {
    const texte = texteDuPdf(await pdfProcesVerbal({ ...donnees, nombreInscrits: null }));
    expect(texte).not.toContain('Non-votants');
    expect(texte).not.toContain('Copropriétaires inscrits');
    expect(texte).not.toContain('art. 25-1');
  });

  it('sans immeuble connu, s’imprime quand même', async () => {
    const texte = texteDuPdf(await pdfProcesVerbal({ ...donnees, immeuble: null }));
    expect(texte).toContain('Procès-verbal des résolutions');
  });

  it('reste lisible avec beaucoup de résolutions : plusieurs pages, pied de page « Page n / N » sur chacune', async () => {
    const beaucoup = { ...donnees, resolutions: Array.from({ length: 30 }, (_, i) => ({ ...donnees.resolutions[0]!, libelle: `Résolution numéro ${i + 1}` })) };
    const pdf = await pdfProcesVerbal(beaucoup);
    const pages = nombreDePages(pdf);
    expect(pages).toBeGreaterThan(1);
    const texte = texteDuPdf(pdf);
    for (let p = 1; p <= pages; p++) expect(texte).toContain(`Page ${p} / ${pages}`);
    expect(texte).toContain('Résolution 30 — Résolution numéro 30');
  });

  it('est déterministe à date de génération égale', async () => {
    expect((await pdfProcesVerbal(donnees)).equals(await pdfProcesVerbal(donnees))).toBe(true);
  });
});

describe('pdfReleveCharges', () => {
  const ligne = (lot: string, statut: 'A_PAYER' | 'PAYEE' | 'EN_RETARD', montant: string, echeance: Date | null = null) => ({ lot, periode: '2026-T4', montant, echeance, statut });
  const donnees: DonneesReleveCharges = {
    immeuble: IMMEUBLE,
    perimetre: 'lots',
    genereLe: GENERE_LE,
    lignes: [
      ligne('1', 'PAYEE', '1000.00'),
      ligne('1', 'A_PAYER', '234.50', new Date('2026-12-31T00:00:00.000Z')),
      ligne('2', 'EN_RETARD', '80.05', new Date('2026-01-31T00:00:00.000Z')),
    ],
  };

  it('affiche chaque ligne, les statuts et les totaux exacts (arithmétique en centimes)', async () => {
    const pdf = await pdfReleveCharges(donnees);
    const texte = texteDuPdf(pdf);
    expect(estUnPdf(pdf)).toBe(true);
    expect(texte).toContain('Charges de vos lots');
    expect(texte).toContain('1 000,00 €');
    expect(texte).toContain('234,50 €');
    expect(texte).toContain('31 décembre 2026');
    expect(texte).toContain('En retard');
    expect(texte).toContain('Total : 1 314,55 €'); // 1000 + 234,50 + 80,05
    expect(texte).toContain('Payé : 1 000,00 €');
    expect(texte).toContain('En retard : 80,05 €');
    expect(texte).toContain('Restant dû : 314,55 €');
  });

  it('indique la portée : toutes les charges de l’immeuble pour le syndic et le conseil', async () => {
    const texte = texteDuPdf(await pdfReleveCharges({ ...donnees, perimetre: 'immeuble' }));
    expect(texte).toContain('Toutes les charges de l’immeuble');
  });

  it('une liste vide donne un relevé « Aucune charge » avec un total à zéro', async () => {
    const texte = texteDuPdf(await pdfReleveCharges({ ...donnees, lignes: [] }));
    expect(texte).toContain('Aucune charge.');
    expect(texte).toContain('Total : 0,00 €');
  });

  it('se répartit sur plusieurs pages, avec les titres de colonnes répétés et le total à la fin', async () => {
    const lignes = Array.from({ length: 120 }, (_, i) => ligne(String(i + 1), 'A_PAYER', '10.00'));
    const pdf = await pdfReleveCharges({ ...donnees, lignes });
    const pages = nombreDePages(pdf);
    expect(pages).toBeGreaterThan(2);
    const texte = texteDuPdf(pdf);
    expect(texte.match(/PÉRIODE/g)).toHaveLength(pages);
    expect(texte).toContain('Total : 1 200,00 €');
  });
});

describe('documentService', () => {
  it('le procès-verbal réutilise la consultation des résultats : une AG non clôturée est refusée (RM-04)', async () => {
    vi.spyOn(agService, 'consulterResolutions').mockRejectedValue(new ResolutionsNonDisponiblesError());
    await expect(documentService.procesVerbalAg('ag-1')).rejects.toBeInstanceOf(ResolutionsNonDisponiblesError);
  });

  it('construit le procès-verbal depuis les résultats figés, et nomme le fichier d’après la date de l’AG', async () => {
    vi.spyOn(agService, 'consulterResolutions').mockResolvedValue({
      id: 'ag-1',
      dateAg: new Date('2026-11-14T00:00:00.000Z'),
      nombreInscritsGeles: 3,
      resolutions: [{ libelle: 'Travaux', typeMajorite: 'SIMPLE', statutResultat: 'ADOPTEE', decomptes: { oui: 2, non: 1, abstention: 0 } }],
    } as never);
    vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(IMMEUBLE as never);
    const { pdf, nomFichier } = await documentService.procesVerbalAg('ag-1');
    expect(nomFichier).toBe('proces-verbal-ag-2026-11-14.pdf');
    expect(texteDuPdf(pdf)).toContain('Résolution 1 — Travaux');
  });

  it('le relevé suit la portée de la liste des charges selon le rôle, et trie par lot puis période', async () => {
    const charge = (id: string, idLot: string, periode: string, montant: string) => ({ id, idLot, periode, montant: new Prisma.Decimal(montant), statut: 'A_PAYER', dateEcheance: null });
    const lister = vi.spyOn(chargeService, 'lister').mockResolvedValue([
      charge('c1', 'lot-b', '2026-T1', '10.00'),
      charge('c2', 'lot-a', '2026-T1', '20.00'),
      charge('c3', 'lot-a', '2026-T4', '30.00'),
    ] as never);
    vi.spyOn(lotRepository, 'parIds').mockResolvedValue([{ id: 'lot-a', numero: '2' }, { id: 'lot-b', numero: '10' }] as never);
    vi.spyOn(immeubleRepository, 'unique').mockResolvedValue(IMMEUBLE as never);

    const copro = { id: 'u-1', email: 'a@test.local', typeCompte: 'COPROPRIETAIRE' as const, estMembreConseilSyndical: false };
    const { pdf, nomFichier } = await documentService.releveCharges(copro);
    expect(lister).toHaveBeenCalledWith(copro);
    expect(nomFichier).toMatch(/^releve-charges-\d{4}-\d{2}-\d{2}\.pdf$/);
    const texte = texteDuPdf(pdf);
    expect(texte).toContain('Charges de vos lots');
    // Tri numérique par lot (2 avant 10), puis période décroissante.
    expect(texte.indexOf('2026-T4')).toBeLessThan(texte.indexOf('2026-T1'));
    expect(texte).toContain('Total : 60,00 €');

    const syndic = { ...copro, typeCompte: 'SYNDIC' as const };
    expect(texteDuPdf((await documentService.releveCharges(syndic)).pdf)).toContain('Toutes les charges de l’immeuble');
    const conseil = { ...copro, estMembreConseilSyndical: true };
    expect(texteDuPdf((await documentService.releveCharges(conseil)).pdf)).toContain('Toutes les charges de l’immeuble');
  });
});
