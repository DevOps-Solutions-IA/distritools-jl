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
    return {
      id: this.state.id,
      eventName: this.state.eventName,
      channel: this.state.channel,
      recipient: maskRecipient(this.state.recipient),
      subject: this.state.subject ? '[PROTECTED]' : null,
      provider: this.state.provider,
      status: this.state.status,
      attempts: this.state.attempts,
      lastError: this.safeErrorCode(this.state.lastError),
      sentAt: this.state.sentAt,
      failedAt: this.state.failedAt,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
    };
  }

  private safeErrorCode(value: string | null): string | null {
    if (!value) return null;
    return /^[A-Z][A-Z0-9_-]{0,79}$/.test(value) ? value : '[DETAILS_REDACTED]';
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
