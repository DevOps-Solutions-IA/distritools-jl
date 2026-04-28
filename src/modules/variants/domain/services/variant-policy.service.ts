import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VariantState } from 'src/modules/variants/domain/entities/variant.entity';

@Injectable()
export class VariantPolicyService {
  normalizeSku(sku: string) {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Variant SKU is required');
    }

    return normalized;
  }

  normalizeName(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('Variant name is required');
    }

    return normalized;
  }

  ensurePrice(value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new BadRequestException('Variant price must be greater than zero');
    }

    return numeric.toFixed(2);
  }

  ensureTaxRate(value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new BadRequestException('Variant tax rate must be non-negative');
    }

    return numeric.toFixed(2);
  }

  ensureExists(variant: VariantState | null): VariantState {
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return variant;
  }

  ensureSkuAvailable(existing: VariantState | null, currentVariantId?: string) {
    if (existing && existing.id !== currentVariantId) {
      throw new ConflictException('Variant SKU already exists');
    }
  }

  ensureSellable(variant: VariantState) {
    if (!variant.isActive) {
      throw new BadRequestException('Variant is not active');
    }

    if (variant.product && !variant.product.isActive) {
      throw new BadRequestException('Variant product is not active');
    }
  }
}
