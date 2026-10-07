export class NotificationDeliveryError extends Error {
  readonly deliveryOutcome = 'not_sent';

  constructor(readonly safeCode: string) {
    super(safeCode);
    this.name = 'NotificationDeliveryError';
  }
}
