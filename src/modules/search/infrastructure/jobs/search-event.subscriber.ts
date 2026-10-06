import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { ReindexContentUseCase } from 'src/modules/search/application/use-cases/reindex-content.use-case';
import { ReindexVariantsUseCase } from 'src/modules/search/application/use-cases/reindex-variants.use-case';

export const SEARCH_CONTENT_DOMAIN_EVENT_NAMES = [
  'content.published',
  'content.unpublished',
] as const;

export const SEARCH_ENTITY_DOMAIN_EVENT_NAMES = [
  'brand.created',
  'brand.updated',
  'brand.status_changed',
  'category.created',
  'category.updated',
  'category.tree_updated',
  'product.created',
  'product.updated',
  'product.status_changed',
] as const;

export const SEARCH_VARIANT_DOMAIN_EVENT_NAMES = [
  'variant.created',
  'variant.updated',
  'variant.status_changed',
] as const;

export const SEARCH_DOMAIN_EVENT_NAMES = [
  ...SEARCH_CONTENT_DOMAIN_EVENT_NAMES,
  ...SEARCH_ENTITY_DOMAIN_EVENT_NAMES,
  ...SEARCH_VARIANT_DOMAIN_EVENT_NAMES,
] as const;

@Injectable()
export class SearchEventSubscriber implements OnModuleInit {
  constructor(
    @Inject(InMemoryDomainEventPublisher)
    private readonly eventPublisher: InMemoryDomainEventPublisher,
    @Inject(ReindexContentUseCase)
    private readonly reindexContentUseCase: ReindexContentUseCase,
    @Inject(ReindexVariantsUseCase)
    private readonly reindexVariantsUseCase: ReindexVariantsUseCase,
  ) {}

  onModuleInit(): void {
    const reindexAllVariants = async () => {
      await this.reindexVariantsUseCase.execute();
    };

    const reindexVariantFromPayload = async (payload: Record<string, unknown>) => {
      const variantId =
        typeof payload.variantId === 'string' ? payload.variantId : null;

      if (variantId) {
        await this.reindexVariantsUseCase.execute([variantId]);
        return;
      }

      await reindexAllVariants();
    };

    for (const eventName of SEARCH_CONTENT_DOMAIN_EVENT_NAMES) {
      this.eventPublisher.subscribe(eventName, async (event) => {
      const payload = event.payload as Record<string, unknown>;
      const contentId =
        typeof payload.contentId === 'string' ? payload.contentId : null;
      if (contentId) {
        await this.reindexContentUseCase.execute([contentId]);
      }
      });
    }

    for (const eventName of SEARCH_ENTITY_DOMAIN_EVENT_NAMES) {
      this.eventPublisher.subscribe(eventName, async () => {
        await reindexAllVariants();
      });
    }

    for (const eventName of SEARCH_VARIANT_DOMAIN_EVENT_NAMES) {
      this.eventPublisher.subscribe(eventName, async (event) => {
        const payload = event.payload as Record<string, unknown>;
        await reindexVariantFromPayload(payload);
      });
    }
  }
}
