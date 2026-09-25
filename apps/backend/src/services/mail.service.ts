import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Business Layer — envoi d'emails par SMTP (serveur configurable, aucun
 * service tiers imposé). Configuration par variables d'environnement :
 * SMTP_HOST, SMTP_PORT (587 par défaut), SMTP_SECURE ("true" pour TLS
 * implicite), SMTP_USER / SMTP_PASS (facultatifs), MAIL_FROM.
 * En développement, le Docker Compose fournit Mailpit (SMTP sur mailpit:1025,
 * boîte de réception sur http://localhost:8025).
 */

export interface Courriel {
  a: string;
  sujet: string;
  texte: string;
}

export class SmtpNonConfigureError extends Error {
  constructor() {
    super('SMTP non configuré (variable SMTP_HOST absente) : aucun email ne peut être envoyé.');
    this.name = 'SmtpNonConfigureError';
  }
}

let transportInjecte: Pick<Transporter, 'sendMail'> | null = null;
let transportParDefaut: Transporter | null = null;

function transport(): Pick<Transporter, 'sendMail'> {
  if (transportInjecte) return transportInjecte;
  const hote = process.env.SMTP_HOST;
  if (!hote) throw new SmtpNonConfigureError();
  transportParDefaut ??= nodemailer.createTransport({
    host: hote,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' }
      : undefined,
  });
  return transportParDefaut;
}

export const mailService = {
  async envoyer(courriel: Courriel): Promise<void> {
    await transport().sendMail({
      from: process.env.MAIL_FROM ?? 'CopropHub <no-reply@coprophub.local>',
      to: courriel.a,
      subject: courriel.sujet,
      text: courriel.texte,
    });
  },

  /** Pour les tests : remplace le transport SMTP ; sans argument, rétablit la configuration par défaut. */
  definirTransport(nouveau?: Pick<Transporter, 'sendMail'>): void {
    transportInjecte = nouveau ?? null;
  },
};
