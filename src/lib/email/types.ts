/** No server-only guard: templates and types are shared, drivers are not. */
export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain text is required; HTML is optional. A text-only email always renders. */
  text: string;
  html?: string;
};

export type SendResult = { sent: true; id?: string } | { sent: false; error: string };

export interface EmailDriver {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
}
