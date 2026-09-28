import PDFDocument from 'pdfkit';
import { immeubleRepository } from '../repositories/immeuble.repository.js';
import { lotRepository } from '../repositories/lot.repository.js';
import type { UtilisateurAuthentifie } from '../types/auth.js';
import { agService } from './ag.service.js';
import { chargeService } from './charge.service.js';
import { secondVoteArt251Possible } from './resultat-calculateur.js';

/**
 * Business Layer — F-13 : exports PDF. Le procès-verbal des résolutions d'une AG clôturée et le
 * relevé de charges. Les documents sont produits à la volée à partir de données déjà lues par les
 * services métier : ils obéissent donc exactement aux mêmes règles d'accès que l'affichage
 * (résultats anonymes uniquement, jamais l'identité d'un votant ; un copropriétaire ne voit que
 * ses charges). Rien n'est stocké.
 */

export interface DonneesProcesVerbal {
  immeuble: { nom: string; adresse: string } | null;
  dateAg: Date;
  nombreInscrits: number | null;
  resolutions: {
    libelle: string;
    typeMajorite: 'SIMPLE' | 'ABSOLUE' | 'DOUBLE_MAJORITE' | 'UNANIMITE';
    statutResultat: 'ADOPTEE' | 'REJETEE' | 'EN_ATTENTE';
    decomptes: { oui: number; non: number; abstention: number };
  }[];
  genereLe: Date;
}

export interface DonneesReleveCharges {
  immeuble: { nom: string; adresse: string } | null;
  perimetre: 'immeuble' | 'lots';
  lignes: {
    lot: string;
    periode: string;
    montant: string; // « 150.00 »
    echeance: Date | null;
    statut: 'A_PAYER' | 'PAYEE' | 'EN_RETARD';
  }[];
  genereLe: Date;
}

const MAJORITE: Record<DonneesProcesVerbal['resolutions'][number]['typeMajorite'], string> = {
  SIMPLE: 'Majorité simple (art. 24)',
  ABSOLUE: 'Majorité absolue (art. 25)',
  DOUBLE_MAJORITE: 'Double majorité (art. 26)',
  UNANIMITE: 'Unanimité',
};

const STATUT_CHARGE = { A_PAYER: 'À payer', PAYEE: 'Payée', EN_RETARD: 'En retard' } as const;

export function dateLongue(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** 123450 → « 1 234,50 € » (espaces ordinaires : les espaces insécables fines ne sont pas dans le jeu de caractères des PDF standards). */
export function formaterEuros(centimes: number): string {
  const signe = centimes < 0 ? '-' : '';
  const absolu = Math.abs(centimes);
  // eslint-disable-next-line security/detect-unsafe-regex -- motif classique de séparation par milliers, chaîne source bornée (un nombre), pas d'entrée utilisateur.
  const entier = String(Math.floor(absolu / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${signe}${entier},${String(absolu % 100).padStart(2, '0')} €`;
}

function versCentimes(montant: string): number {
  return Math.round(Number(montant) * 100);
}

const GRIS = '#5C5C5C';
const NOIR = '#1A1A1A';
const BLEU = '#1E4B8F';
const TRAIT = '#E0E0E0';

/** Crée un document A4 avec pied de page, exécute `dessiner`, et retourne le PDF complet. Non compressé : le texte reste inspectable et les fichiers restent petits. */
function construire(
  titre: string,
  genereLe: Date,
  dessiner: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 64, left: 50, right: 50 },
      compress: false,
      bufferPages: true,
      info: { Title: titre, Author: 'CopropHub', Creator: 'CopropHub', CreationDate: genereLe },
    });
    const morceaux: Buffer[] = [];
    doc.on('data', (m: Buffer) => morceaux.push(m));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);

    dessiner(doc);

    // Pied de page sur chaque page (une fois le nombre de pages connu).
    const { start, count } = doc.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      doc.switchToPage(i);
      const bas = doc.page.height - 44;
      doc.page.margins.bottom = 0; // évite un saut de page en écrivant dans la marge basse
      doc
        .fontSize(8)
        .fillColor(GRIS)
        .text(
          `Document généré par CopropHub le ${dateLongue(genereLe)} — récapitulatif ; ne remplace pas un procès-verbal signé.`,
          50,
          bas,
          { width: doc.page.width - 100, align: 'left', lineBreak: false },
        )
        .text(`Page ${i - start + 1} / ${count}`, 50, bas, {
          width: doc.page.width - 100,
          align: 'right',
          lineBreak: false,
        });
    }
    doc.end();
  });
}

function enTete(
  doc: PDFKit.PDFDocument,
  immeuble: { nom: string; adresse: string } | null,
  titre: string,
  sousTitre: string,
) {
  doc.fontSize(9).fillColor(BLEU).font('Helvetica-Bold').text('CopropHub');
  if (immeuble) {
    doc.font('Helvetica').fillColor(GRIS).text(`${immeuble.nom} — ${immeuble.adresse}`);
  }
  doc.moveDown(1.2);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(NOIR).text(titre);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(12).fillColor(GRIS).text(sousTitre);
  doc.moveDown(1);
  doc
    .strokeColor(TRAIT)
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .stroke();
  doc.moveDown(1);
}

export function pdfProcesVerbal(d: DonneesProcesVerbal): Promise<Buffer> {
  const date = dateLongue(d.dateAg);
  return construire(
    `Procès-verbal des résolutions — assemblée générale du ${date}`,
    d.genereLe,
    (doc) => {
      enTete(doc, d.immeuble, 'Procès-verbal des résolutions', `Assemblée générale du ${date}`);
      if (d.nombreInscrits !== null) {
        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor(NOIR)
          .text(`Copropriétaires inscrits au vote : ${d.nombreInscrits}`);
        doc.moveDown(0.8);
      }
      d.resolutions.forEach((r, i) => {
        if (doc.y > doc.page.height - 200) doc.addPage();
        const votants = r.decomptes.oui + r.decomptes.non + r.decomptes.abstention;
        const adoptee = r.statutResultat === 'ADOPTEE';
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(NOIR)
          .text(`Résolution ${i + 1} — ${r.libelle}`);
        doc.font('Helvetica').fontSize(10).fillColor(GRIS).text(MAJORITE[r.typeMajorite]);
        doc.moveDown(0.3);
        doc
          .fillColor(NOIR)
          .text(
            `Pour : ${r.decomptes.oui}    Contre : ${r.decomptes.non}    Abstentions : ${r.decomptes.abstention}` +
              (d.nombreInscrits !== null
                ? `    Non-votants : ${Math.max(0, d.nombreInscrits - votants)}`
                : ''),
          );
        doc.moveDown(0.2);
        doc
          .font('Helvetica-Bold')
          .fillColor(adoptee ? '#1E7A4C' : '#B3261E')
          .text(`Résultat : ${adoptee ? 'ADOPTÉE' : 'REJETÉE'}`);
        if (
          secondVoteArt251Possible(
            r.typeMajorite,
            r.statutResultat === 'EN_ATTENTE' ? null : r.statutResultat,
            r.decomptes,
            d.nombreInscrits,
          )
        ) {
          doc
            .font('Helvetica-Oblique')
            .fontSize(9)
            .fillColor(GRIS)
            .text(
              'Cette résolution a recueilli au moins un tiers des voix sans atteindre la majorité absolue : un second vote à la majorité simple (art. 25-1) pouvait être organisé séance tenante.',
            );
        }
        doc.moveDown(1);
      });
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(GRIS)
        .text(
          'Décomptes anonymes : l’identité des votants n’est jamais consignée dans ce document.',
        );
    },
  );
}

export function pdfReleveCharges(d: DonneesReleveCharges): Promise<Buffer> {
  return construire('Relevé de charges', d.genereLe, (doc) => {
    enTete(
      doc,
      d.immeuble,
      'Relevé de charges',
      d.perimetre === 'immeuble' ? 'Toutes les charges de l’immeuble' : 'Charges de vos lots',
    );
    const colonnes = [
      { titre: 'Lot', x: 50, largeur: 70, droite: false },
      { titre: 'Période', x: 120, largeur: 110, droite: false },
      { titre: 'Montant', x: 230, largeur: 110, droite: true },
      { titre: 'Échéance', x: 350, largeur: 100, droite: false },
      { titre: 'Statut', x: 450, largeur: 95, droite: false },
    ];
    const ligneTitres = () => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRIS);
      colonnes.forEach((c) =>
        doc.text(c.titre.toUpperCase(), c.x, y, {
          width: c.largeur - 8,
          align: c.droite ? 'right' : 'left',
          lineBreak: false,
        }),
      );
      doc.y = y + 16;
      doc.strokeColor(TRAIT).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.y += 6;
    };
    ligneTitres();

    let total = 0;
    let paye = 0;
    let retard = 0;
    for (const l of d.lignes) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        ligneTitres();
      }
      const centimes = versCentimes(l.montant);
      total += centimes;
      if (l.statut === 'PAYEE') paye += centimes;
      if (l.statut === 'EN_RETARD') retard += centimes;
      const y = doc.y;
      const cellules = [
        l.lot,
        l.periode,
        formaterEuros(centimes),
        l.echeance ? dateLongue(l.echeance) : '—',
        STATUT_CHARGE[l.statut],
      ];
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(l.statut === 'EN_RETARD' ? '#B3261E' : NOIR);
      colonnes.forEach((c, i) =>
        // eslint-disable-next-line security/detect-object-injection -- `i` est l'index de boucle sur `colonnes`, tableau littéral fixe défini plus haut dans ce fichier.
        doc.text(cellules[i]!, c.x, y, {
          width: c.largeur - 8,
          align: c.droite ? 'right' : 'left',
          lineBreak: false,
        }),
      );
      doc.y = y + 18;
    }
    if (d.lignes.length === 0) {
      doc.font('Helvetica').fontSize(11).fillColor(GRIS).text('Aucune charge.', 50);
    }

    doc.moveDown(1);
    doc.strokeColor(TRAIT).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.6);
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(NOIR)
      .text(`Total : ${formaterEuros(total)}`, 50);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(GRIS)
      .text(
        `Payé : ${formaterEuros(paye)}    En retard : ${formaterEuros(retard)}    Restant dû : ${formaterEuros(total - paye)}`,
        50,
      );
  });
}

function nomFichier(prefixe: string, date: Date): string {
  return `${prefixe}-${date.toISOString().slice(0, 10)}.pdf`;
}

export const documentService = {
  /** Refuse tant que l'AG n'est pas clôturée (RM-04) — mêmes erreurs que la consultation des résultats. */
  async procesVerbalAg(idAg: string): Promise<{ pdf: Buffer; nomFichier: string }> {
    const ag = await agService.consulterResolutions(idAg);
    const immeuble = await immeubleRepository.unique();
    const genereLe = new Date();
    const pdf = await pdfProcesVerbal({
      immeuble: immeuble ? { nom: immeuble.nom, adresse: immeuble.adresse } : null,
      dateAg: ag.dateAg,
      nombreInscrits: ag.nombreInscritsGeles,
      resolutions: ag.resolutions.map((r) => ({
        libelle: r.libelle,
        typeMajorite: r.typeMajorite,
        statutResultat: r.statutResultat,
        decomptes: r.decomptes,
      })),
      genereLe,
    });
    return { pdf, nomFichier: nomFichier('proces-verbal-ag', ag.dateAg) };
  },

  /** La portée (toutes les charges ou seulement celles de ses lots) est décidée par `chargeService.lister` selon le rôle (RM-10). */
  async releveCharges(
    utilisateur: UtilisateurAuthentifie,
  ): Promise<{ pdf: Buffer; nomFichier: string }> {
    const charges = await chargeService.lister(utilisateur);
    const lots = await lotRepository.parIds([...new Set(charges.map((c) => c.idLot))]);
    const numeros = new Map(lots.map((l) => [l.id, l.numero]));
    const immeuble = await immeubleRepository.unique();
    const genereLe = new Date();
    const pdf = await pdfReleveCharges({
      immeuble: immeuble ? { nom: immeuble.nom, adresse: immeuble.adresse } : null,
      perimetre:
        utilisateur.typeCompte === 'SYNDIC' || utilisateur.estMembreConseilSyndical
          ? 'immeuble'
          : 'lots',
      lignes: charges
        .map((c) => ({
          lot: numeros.get(c.idLot) ?? '—',
          periode: c.periode,
          montant: c.montant.toFixed(2),
          echeance: c.dateEcheance ?? null,
          statut: c.statut as 'A_PAYER' | 'PAYEE' | 'EN_RETARD',
        }))
        .sort(
          (a, b) =>
            a.lot.localeCompare(b.lot, 'fr', { numeric: true }) ||
            b.periode.localeCompare(a.periode),
        ),
      genereLe,
    });
    return { pdf, nomFichier: nomFichier('releve-charges', genereLe) };
  },
};
