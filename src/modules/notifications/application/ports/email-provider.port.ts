export interface EmailProviderSendInput {
  to: string;
  subject: string;
  content: string;
}

export interface EmailProviderPort {
  send(input: EmailProviderSendInput): Promise<{ providerMessageId: string }>;
}

export const EMAIL_PROVIDER_PORT = Symbol('EMAIL_PROVIDER_PORT');
