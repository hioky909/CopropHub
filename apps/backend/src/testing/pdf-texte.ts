/**
 * Utilitaire de test : extrait le texte d'un PDF produit par pdfkit non compressé (polices
 * standard, chaînes hexadécimales en WinAnsi). Permet de vérifier le contenu réel d'un document
 * plutôt que seulement son en-tête. Un bloc de texte devient une ligne.
 */
export function texteDuPdf(pdf: Buffer): string {
  const contenu = pdf.toString('latin1');
  const decodeur = new TextDecoder('windows-1252');
  const lignes: string[] = [];
  // eslint-disable-next-line security/detect-unsafe-regex -- utilitaire de TEST interne (parsing du PDF généré par pdfkit, jamais une entrée utilisateur) ; alternatives non ambiguës, pas de backtracking exponentiel réel.
  const motif = /\[((?:<[0-9a-fA-F]*>|\s|-?\d+(?:\.\d+)?)*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(contenu)) !== null) {
    const hexes = m[1] !== undefined ? [...m[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => x[1]!) : [m[2]!];
    const octets = Uint8Array.from(hexes.join('').match(/../g)?.map((h) => parseInt(h, 16)) ?? []);
    lignes.push(decodeur.decode(octets));
  }
  return lignes.join('\n');
}

export function estUnPdf(pdf: Buffer): boolean {
  return pdf.subarray(0, 5).toString('latin1') === '%PDF-' && pdf.toString('latin1').trimEnd().endsWith('%%EOF');
}

export function nombreDePages(pdf: Buffer): number {
  return (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;
}
