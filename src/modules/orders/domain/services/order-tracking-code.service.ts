import { Injectable } from '@nestjs/common';

const TRACKING_PREFIX = 'DTJL-TRK';

@Injectable()
export class OrderTrackingCodeService {
  create(orderNumber: string): string {
    return `${TRACKING_PREFIX}-${orderNumber.replace(/^DTJL-/, '')}`;
  }

  resolveOrderNumber(query: string): string {
    const normalized = query.trim().toUpperCase();

    if (normalized.startsWith(`${TRACKING_PREFIX}-`)) {
      return `DTJL-${normalized.slice(`${TRACKING_PREFIX}-`.length)}`;
    }

    return normalized;
  }
}
