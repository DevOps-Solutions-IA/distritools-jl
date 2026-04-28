export interface WebhookSignaturePort {
  verify(input: {
    gateway: string;
    signature: string | undefined;
    payload: string;
  }): boolean;
}

export const WEBHOOK_SIGNATURE_PORT = Symbol('WEBHOOK_SIGNATURE_PORT');
