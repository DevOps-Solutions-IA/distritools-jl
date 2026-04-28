export interface WhatsAppProviderSendInput {
  to: string;
  content: string;
}

export interface WhatsAppProviderPort {
  send(input: WhatsAppProviderSendInput): Promise<{ providerMessageId: string }>;
}

export const WHATSAPP_PROVIDER_PORT = Symbol('WHATSAPP_PROVIDER_PORT');
