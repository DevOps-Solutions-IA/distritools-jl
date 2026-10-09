import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';
import { isProductionOrStaging } from 'src/common/security/env-check';

export function assertMockNotificationProviderAllowed(): void {
  if (isProductionOrStaging()) {
    throw new NotificationDeliveryError('PROVIDER_BLOCKED');
  }
}
