import { BadRequestException } from '@nestjs/common';

export interface StockLine {
  variantId: string;
  warehouseId: string;
  quantity: number;
}

export function normalizeStockLines<T extends StockLine>(lines: T[]): T[] {
  const quantities = new Map<string, T>();

  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive safe integer');
    }

    const key = `${line.variantId}:${line.warehouseId}`;
    const existing = quantities.get(key);
    const quantity = (existing?.quantity ?? 0) + line.quantity;

    if (!Number.isSafeInteger(quantity)) {
      throw new BadRequestException('Combined quantity exceeds the safe integer range');
    }

    quantities.set(key, { ...line, quantity });
  }

  return [...quantities.values()].sort((left, right) =>
    `${left.variantId}:${left.warehouseId}`.localeCompare(
      `${right.variantId}:${right.warehouseId}`,
    ),
  );
}
