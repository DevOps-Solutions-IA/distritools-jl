import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsWindowService {
  normalizeWindow(windowFrom?: string, windowTo?: string) {
    return {
      windowFrom: windowFrom ? new Date(windowFrom) : undefined,
      windowTo: windowTo ? new Date(windowTo) : undefined,
    };
  }
}
