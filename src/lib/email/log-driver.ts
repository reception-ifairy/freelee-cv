import type { EmailDriver, EmailMessage, SendResult } from './types';

/**
 * Writes the email to the server log instead of sending it.
 *
 * The default when no provider is configured, and deliberately not a silent
 * no-op: a password-reset link that vanishes without trace is much worse to
 * debug than one printed where an admin can find it. On a single-admin box
 * this is genuinely usable — you can read the link out of `pm2 logs` — which
 * makes the reset flow work end to end before anyone signs up for Resend.
 */
export class LogEmailDriver implements EmailDriver {
  readonly name = 'log';

  async send(message: EmailMessage): Promise<SendResult> {
    console.log(
      `\n[email:log] No email provider configured — printing instead of sending.\n` +
        `  to:      ${message.to}\n  subject: ${message.subject}\n` +
        `${message.text.split('\n').map((l) => `  | ${l}`).join('\n')}\n`,
    );
    return { sent: true, id: 'logged' };
  }
}
