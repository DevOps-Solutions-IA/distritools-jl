import { BadRequestException } from '@nestjs/common';

export function parseBoundedPositiveInteger(
  value: string | number | undefined,
  field: string,
  defaultValue: number,
  maximum: number,
): number {
  if (value === undefined) return defaultValue;
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    throw new BadRequestException(`${field} debe ser un entero positivo.`);
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new BadRequestException(`${field} debe estar entre 1 y ${maximum}.`);
  }
  return parsed;
}

export function parsePageSize(limit: string | number | undefined, defaultValue = 20): number {
  return parseBoundedPositiveInteger(limit, 'limit', defaultValue, 100);
}
