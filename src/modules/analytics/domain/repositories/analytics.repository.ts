export interface SalesSummary {
  orderCount: number;
  grossRevenue: string;
  discountTotal: string;
  netRevenue: string;
}

export interface TopProductRecord {
  variantId: string;
  variantName: string;
  quantitySold: number;
  revenue: string;
}

export interface AnalyticsRepository {
  getSalesSummary(windowFrom?: Date, windowTo?: Date): Promise<SalesSummary>;
  getTopProducts(limit: number, windowFrom?: Date, windowTo?: Date): Promise<TopProductRecord[]>;
  getOrderStatusCounts(): Promise<Record<string, number>>;
  getPaymentStatusCounts(): Promise<Record<string, number>>;
  getInventoryStatus(): Promise<{ lowStock: number; totalTracked: number }>;
  refreshSnapshot(
    reportKey: string,
    payload: unknown,
    windowFrom?: Date,
    windowTo?: Date,
  ): Promise<void>;
  getSnapshot(reportKey: string, windowFrom?: Date, windowTo?: Date): Promise<unknown | null>;
}

export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY');
