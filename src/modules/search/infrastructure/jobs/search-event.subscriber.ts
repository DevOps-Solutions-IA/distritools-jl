import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from 'src/common/events/domain-event.publisher';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { PrismaDomainEventInboxRepository } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { ReindexContentUseCase } from 'src/modules/search/application/use-cases/reindex-content.use-case';
import { ReindexVariantsUseCase } from 'src/modules/search/application/use-cases/reindex-variants.use-case';

export const SEARCH_CONTENT_DOMAIN_EVENT_NAMES = ['content.published', 'content.unpublished'] as const;
export const SEARCH_ENTITY_DOMAIN_EVENT_NAMES = [
  'brand.created', 'brand.updated', 'brand.status_changed', 'category.created', 'category.updated',
  'category.tree_updated', 'product.created', 'product.updated', 'product.status_changed',
] as const;
export const SEARCH_VARIANT_DOMAIN_EVENT_NAMES = ['variant.created', 'variant.updated', 'variant.status_changed'] as const;
export const SEARCH_DOMAIN_EVENT_NAMES = [...SEARCH_CONTENT_DOMAIN_EVENT_NAMES, ...SEARCH_ENTITY_DOMAIN_EVENT_NAMES, ...SEARCH_VARIANT_DOMAIN_EVENT_NAMES] as const;

@Injectable()
export class SearchEventSubscriber implements OnModuleInit {
  constructor(
    @Inject(InMemoryDomainEventPublisher) private readonly eventPublisher: InMemoryDomainEventPublisher,
    @Inject(ReindexContentUseCase) private readonly content: ReindexContentUseCase,
    @Inject(ReindexVariantsUseCase) private readonly variants: ReindexVariantsUseCase,
    @Inject(DomainEventHandlerRegistry) private readonly handlers: DomainEventHandlerRegistry,
    @Inject(PrismaDomainEventInboxRepository) private readonly inbox: PrismaDomainEventInboxRepository,
  ) {}

  onModuleInit(): void {
    for (const eventName of SEARCH_DOMAIN_EVENT_NAMES) {
      const consumerKey = 'search-projection.v1';
      const handler = (event: DomainEvent<Record<string, unknown>>) => {
        const payload = event.payload as Record<string, unknown>;
        if ((SEARCH_CONTENT_DOMAIN_EVENT_NAMES as readonly string[]).includes(event.eventName)) {
          const contentId = typeof payload.contentId === 'string' ? payload.contentId : null;
          const ids = contentId ? [contentId] : [];
          return this.inbox.runBatches(consumerKey, event as never,
            (tx) => this.content.upperBound(tx, ids),
            (tx, cursor, upper) => this.content.batch(tx, cursor, upper, ids));
        }
        if ((SEARCH_VARIANT_DOMAIN_EVENT_NAMES as readonly string[]).includes(event.eventName)) {
          const variantId = typeof payload.variantId === 'string' ? payload.variantId : null;
          const ids = variantId ? [variantId] : undefined;
          return this.inbox.runBatches(consumerKey, event as never,
            (tx) => this.variants.upperBound(tx, ids),
            (tx, cursor, upper) => this.variants.batch(tx, cursor, upper, ids));
        }
        return this.inbox.runBatches(consumerKey, event as never,
          (tx) => this.variants.upperBound(tx),
          (tx, cursor, upper) => this.variants.batch(tx, cursor, upper));
      };
      this.handlers.register(eventName, consumerKey, handler as never);
      this.eventPublisher.subscribe(eventName, handler as never);
    }
  }
}
