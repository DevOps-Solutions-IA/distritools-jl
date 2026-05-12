import { NotificationChannel, NotificationStatus } from '@prisma/client';

export interface NotificationState {
  id: string;
  eventId: string;
  eventName: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string | null;
  content: string;
  provider: string;
  status: NotificationStatus;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  payload: unknown;
  sentAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationEntity {
  constructor(private readonly state: NotificationState) {}

  static fromState(state: NotificationState): NotificationEntity {
    return new NotificationEntity(state);
  }

  get id(): string {
    return this.state.id;
  }

  get status(): NotificationStatus {
    return this.state.status;
  }

  toResponse() {
    const payload =
      this.state.payload && typeof this.state.payload === 'object'
        ? sanitizeNotificationPayload(this.state.payload as Record<string, unknown>)
        : this.state.payload;

    return {
      ...this.state,
      recipient: maskRecipient(this.state.recipient),
      payload,
    };
  }
}

function maskRecipient(recipient: string): string {
  if (recipient.includes('@')) {
    const [localPart, domain] = recipient.split('@');
    if (!domain) {
      return '[redacted]';
    }

    return `${localPart.slice(0, 2)}***@${domain}`;
  }

  const digits = recipient.replace(/\D/g, '');
  if (digits.length < 6) {
    return '[redacted]';
  }

  return `${digits.slice(0, 3)}***${digits.slice(-2)}`;
}

function sanitizeNotificationPayload(payload: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = { ...payload };

  for (const key of ['customerEmail', 'customerPhone', 'email', 'phone', 'token', 'secret']) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = key.toLowerCase().includes('email')
        ? maskRecipient(sanitized[key])
        : '[redacted]';
    }
  }

  for (const key of ['orderId', 'customerId', 'userId', 'sessionId']) {
    if (key in sanitized) {
      delete sanitized[key];
    }
  }

  return sanitized;
}
