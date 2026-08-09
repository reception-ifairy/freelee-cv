import 'server-only';
import { getSettingString } from '@/lib/settings';
import { LogEmailDriver } from './log-driver';
import { ResendEmailDriver } from './resend-driver';
import type { EmailDriver, EmailMessage, SendResult } from './types';

export type { EmailMessage, SendResult } from './types';

/**
 * Picks the driver per call rather than caching one, because the API key
 * lives in settings and is rotatable without a deploy — caching would keep a
 * revoked key alive until the next restart.
 */
async function driver(): Promise<EmailDriver> {
  const apiKey = (await getSettingString('resend_api_key')) || process.env.RESEND_API_KEY;
  const from = (await getSettingString('email_from')) || process.env.EMAIL_FROM;

  if (apiKey && from) return new ResendEmailDriver(apiKey, from);
  return new LogEmailDriver();
}

/** Never throws. A failed email must not take down the action that triggered it. */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  try {
    return await (await driver()).send(message);
  } catch (error) {
    console.error('[email] send failed', error);
    return { sent: false, error: 'Could not send the email.' };
  }
}

export async function emailProviderName(): Promise<string> {
  return (await driver()).name;
}
