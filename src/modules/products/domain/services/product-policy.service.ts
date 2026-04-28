import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProductState } from 'src/modules/products/domain/entities/product.entity';

@Injectable()
export class ProductPolicyService {
  normalizeName(name: string) {
    const normalized = name.trim();
    if (!normalized) {
      throw new BadRequestException('Product name is required');
    }

    return normalized;
  }

  normalizeSlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      throw new BadRequestException('Product slug is required');
    }

    return normalized;
  }

  ensureExists(product: ProductState | null): ProductState {
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  ensureSlugAvailable(existing: ProductState | null, currentProductId?: string) {
    if (existing && existing.id !== currentProductId) {
      throw new ConflictException('Product slug already exists');
    }
  }

  ensureCategoryAllowedForBrand(input: {
    brand:
      | {
          slug: string;
          metadata: Prisma.JsonValue | null;
        }
      | null;
    category:
      | {
          slug: string;
        }
      | null;
  }) {
    const metadata =
      input.brand?.metadata && typeof input.brand.metadata === 'object' && !Array.isArray(input.brand.metadata)
        ? (input.brand.metadata as Record<string, unknown>)
        : null;
    const allowedCategorySlugs = Array.isArray(metadata?.categorySlugs)
      ? metadata.categorySlugs.filter((value): value is string => typeof value === 'string')
      : [];

    if (!input.brand || !input.category || allowedCategorySlugs.length === 0) {
      return;
    }

    if (!allowedCategorySlugs.includes(input.category.slug)) {
      throw new UnprocessableEntityException(
        `Category "${input.category.slug}" is outside the allowed taxonomy for brand "${input.brand.slug}"`,
      );
    }
  }
}
