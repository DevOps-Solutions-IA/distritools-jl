import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisher,
} from "src/common/events/domain-event.publisher";
import {
  DOMAIN_EVENT_OUTBOX_REPOSITORY,
  DomainEventOutboxRepository,
} from "src/common/events/domain-event-outbox.port";
import { CurrentUser } from "src/common/interfaces/current-user.interface";
import { assertHasPermissions } from "src/common/utils/authorization.util";
import { PrismaService } from "src/infra/db/prisma/prisma.service";
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from "src/modules/auth/domain/repositories/audit.repository";
import { ProductEntity } from "src/modules/products/domain/entities/product.entity";
import { ProductImageApprovalService } from "src/modules/products/domain/services/product-image-approval.service";
import type { PrismaTransactionClient } from "src/modules/inventory/domain/repositories/inventory.repository";

interface ApproveProductImageInput {
  actor: CurrentUser;
  productId: string;
  assetPath: string;
  sha256: string;
  expectedUpdatedAt: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ApproveProductImageUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProductImageApprovalService)
    private readonly media: ProductImageApprovalService,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepository,
    @Inject(DOMAIN_EVENT_OUTBOX_REPOSITORY)
    private readonly outbox: DomainEventOutboxRepository,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly publisher: DomainEventPublisher,
  ) {}

  async execute(input: ApproveProductImageInput) {
    assertHasPermissions(input.actor.permissions, ["products.write"]);
    const resource = this.media.resource(input.assetPath);
    if (resource.sha256 !== input.sha256)
      throw new ConflictException(
        "Registered image content changed; reload resources",
      );
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 500)
      throw new UnprocessableEntityException("Approval reason is required");
    const { product, event } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id::text = ${input.productId} FOR UPDATE`;
      const current = await tx.product.findUnique({
        where: { id: input.productId },
      });
      if (!current) throw new NotFoundException("Product not found");
      const metadata =
        current.metadata &&
        typeof current.metadata === "object" &&
        !Array.isArray(current.metadata)
          ? current.metadata
          : {};
      const image =
        metadata.image &&
        typeof metadata.image === "object" &&
        !Array.isArray(metadata.image)
          ? metadata.image
          : {};
      if (
        current.updatedAt.toISOString() !== input.expectedUpdatedAt ||
        image.assetPath !== resource.assetPath
      ) {
        throw new ConflictException(
          "Product image changed; reload product before approving",
        );
      }
      const approvedAt = new Date();
      const product = await tx.product.update({
        where: { id: current.id },
        data: {
          metadata: {
            ...metadata,
            image: {
              status: "approved",
              assetPath: resource.assetPath,
              approval: {
                assetPath: resource.assetPath,
                sha256: resource.sha256,
                approvedBy: input.actor.sub,
                approvedAt: approvedAt.toISOString(),
                reason,
              },
            },
          } as Prisma.InputJsonValue,
          // Guarantee a changed CAS version even when two requests share a millisecond.
          updatedAt: new Date(
            Math.max(approvedAt.getTime(), current.updatedAt.getTime() + 1),
          ),
        },
        include: {
          brand: { select: { id: true, name: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      });
      await this.audit.write(
        {
          actorUserId: input.actor.sub,
          action: "product.image_approved",
          entityType: "product",
          entityId: current.id,
          beforeData: current,
          afterData: product,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
        tx,
      );
      const event = await this.outbox.captureHeld(
        tx as PrismaTransactionClient,
        {
          eventName: "product.updated",
          eventVersion: "v1",
          occurredAt: approvedAt.toISOString(),
          payload: {
            productId: current.id,
            slug: current.slug,
            isActive: current.isActive,
          },
        },
      );
      return { product, event };
    });
    await this.publisher.publish(event, event.route);
    return ProductEntity.fromState(product).toAdminResponse();
  }
}
