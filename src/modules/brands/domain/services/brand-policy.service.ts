import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { BrandState } from 'src/modules/brands/domain/entities/brand.entity';

@Injectable()
export class BrandPolicyService {
  private readonly forbiddenMetadataKeys = new Set([
    'products',
    'skus',
    'prices',
    'stock',
    'inventory',
  ]);

  normalizeName(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('Brand name is required');
    }

    return normalized;
  }

  normalizeSlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Brand slug is required');
    }

    return normalized;
  }

  ensureExists(brand: BrandState | null): BrandState {
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  ensureSlugAvailable(existing: BrandState | null, currentBrandId?: string) {
    if (existing && existing.id !== currentBrandId) {
      throw new ConflictException('Brand slug already exists');
    }
  }

  normalizeMetadata(
    metadata?: Record<string, unknown> | null,
  ): Prisma.InputJsonValue | null | undefined {
    if (metadata === undefined) {
      return undefined;
    }

    if (metadata === null) {
      return null;
    }

    this.ensureMetadataDoesNotContainForbiddenKeys(metadata);
    return JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue;
  }

  private ensureMetadataDoesNotContainForbiddenKeys(value: unknown) {
    if (!value || typeof value !== 'object') {
      return;
    }

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (this.forbiddenMetadataKeys.has(key)) {
        throw new BadRequestException(
          `Brand metadata cannot include forbidden key "${key}"`,
        );
      }

      this.ensureMetadataDoesNotContainForbiddenKeys(nestedValue);
    }
  }
}
