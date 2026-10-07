import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import type { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { DomainEventReplayService } from 'src/infra/events/domain-event-replay.service';
import { DomainEventQueueReconciler } from 'src/infra/events/domain-event-queue-reconciler';
import { DomainEventCutoverReadinessService } from 'src/infra/events/domain-event-cutover-readiness.service';

@ApiTags('admin-domain-events')
@ApiBearerAuth()
@Controller('admin/domain-events')
export class DomainEventOperationsController {
  constructor(
    @Inject(DomainEventReplayService) private readonly replayService: DomainEventReplayService,
    @Inject(DomainEventQueueReconciler) private readonly reconciler: DomainEventQueueReconciler,
    @Inject(DomainEventCutoverReadinessService) private readonly cutoverReadiness: DomainEventCutoverReadinessService,
  ) {}

  @Permissions('domain_events.cutover.read')
  @Get('cutover-readiness')
  readiness(@Query('limit') rawLimit?: string, @Query('cursor') cursor?: string) {
    const limit = rawLimit === undefined ? 25 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Invalid cutover page limit');
    return this.cutoverReadiness.evaluate({ limit, cursor });
  }

  @Permissions('domain_events.reconcile')
  @Post('reconcile')
  @HttpCode(200)
  reconcile(@Body() body: { limit?: number; cursor?: string }) {
    const limit = body?.limit ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new BadRequestException('Invalid reconciliation limit');
    let after: { createdAt: Date; eventId: string } | undefined;
    if (body?.cursor !== undefined) {
      const match = /^([^|]{1,40})\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(body.cursor);
      const createdAt = match ? new Date(match[1]) : new Date(Number.NaN);
      if (!match || Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== match[1]) {
        throw new BadRequestException('Invalid reconciliation cursor');
      }
      after = { createdAt, eventId: match[2] };
    }
    return this.reconciler.reconcile(limit, after).then((result) => ({ mode: 'operator_requested', ...result }));
  }

  @Permissions('domain_events.replay')
  @Get(':eventId/replay-preview')
  preview(
    @CurrentUserDecorator() actor: CurrentUser,
    @Param('eventId') eventId: string,
    @Query('consumerKey') consumerKey: string,
  ) {
    this.validateIdentity(eventId, consumerKey);
    return this.replayService.preview(actor, eventId, consumerKey);
  }

  @Permissions('domain_events.replay')
  @Post(':eventId/replay')
  @HttpCode(202)
  replay(
    @CurrentUserDecorator() actor: CurrentUser,
    @Param('eventId') eventId: string,
    @Query('consumerKey') consumerKey: string,
  ) {
    this.validateIdentity(eventId, consumerKey);
    return this.replayService.replay(actor, eventId, consumerKey);
  }

  private validateIdentity(eventId: string, consumerKey: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId) ||
        typeof consumerKey !== 'string' || consumerKey.trim().length === 0 || consumerKey.length > 120) {
      throw new BadRequestException('Invalid durable event identity');
    }
  }
}
