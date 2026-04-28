import { Inject, Injectable } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { NotificationEntity } from 'src/modules/notifications/domain/entities/notification.entity';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from 'src/modules/notifications/domain/repositories/notification.repository';

@Injectable()
export class ListNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(actor: CurrentUser, limit?: number) {
    assertHasPermissions(actor.permissions, ['notifications.read']);

    const records = await this.notificationRepository.list(limit);

    return {
      data: records.map((record) => NotificationEntity.fromState(record).toResponse()),
    };
  }
}
