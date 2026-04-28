export interface WebhookReceiptState {
  id: string;
  gateway: string;
  externalEventId: string;
  signature: string | null;
  payload: unknown;
  processedAt: Date | null;
  createdAt: Date;
}

export class WebhookReceiptEntity {
  constructor(private readonly state: WebhookReceiptState) {}

  static fromState(state: WebhookReceiptState): WebhookReceiptEntity {
    return new WebhookReceiptEntity(state);
  }

  get processedAt(): Date | null {
    return this.state.processedAt;
  }

  toResponse() {
    return this.state;
  }
}
