import { afterEach, describe, expect, it } from 'vitest';
import { mailService, SmtpNonConfigureError } from './mail.service.js';

afterEach(() => {
  mailService.definirTransport();
});

describe('mailService', () => {
  it("échoue clairement quand SMTP_HOST n'est pas configuré, au lieu d'ignorer l'envoi en silence", async () => {
    const ancien = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    try {
      await expect(mailService.envoyer({ a: 'a@test.local', sujet: 's', texte: 't' })).rejects.toBeInstanceOf(
        SmtpNonConfigureError,
      );
    } finally {
      if (ancien !== undefined) process.env.SMTP_HOST = ancien;
    }
  });

  it("transmet l'expéditeur, le destinataire, le sujet et le texte au transport", async () => {
    const messages: Record<string, unknown>[] = [];
    mailService.definirTransport({
      sendMail: ((message: Record<string, unknown>) => {
        messages.push(message);
        return Promise.resolve({});
      }) as never,
    });

    await mailService.envoyer({ a: 'dest@test.local', sujet: 'Sujet', texte: 'Corps' });

    expect(messages[0]).toMatchObject({ to: 'dest@test.local', subject: 'Sujet', text: 'Corps' });
    expect(String(messages[0]!.from)).toContain('CopropHub');
  });
});
