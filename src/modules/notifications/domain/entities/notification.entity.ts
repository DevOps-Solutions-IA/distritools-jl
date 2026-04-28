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
      ...this.state,
    };
  }
}
