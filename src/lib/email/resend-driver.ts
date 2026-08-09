import type { EmailDriver, EmailMessage, SendResult } from './types';

/**
 * Resend — chosen over Postmark/SES for the simplest possible HTTP API: one
 * POST, no SDK needed.
 *
 * ⚠️ **UNVERIFIED against the live API** — there is no Resend key on this
 * deployment. The request shape follows their documented v1 API. Every other
 * integration built this week had a bug that only appeared on a real call, so
 * assume this does too until someone runs it with a key.
 */
export class ResendEmailDriver implements EmailDriver {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<SendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return { sent: false, error: `Resend refused the message: ${detail.slice(0, 200) || `HTTP ${response.status}`}` };
      }

      const body = (await response.json()) as { id?: string };
      return { sent: true, id: body.id };
    } catch {
      return { sent: false, error: 'Could not reach Resend.' };
    } finally {
      clearTimeout(timeout);
    }
  }
}
