import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

@Injectable()
export class UpdateCountSessionLinesUseCase {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: AuditRepository,
  ) {}

  async execute(sessionId: string, body: { lines: Array<{ variantId: string; countedQuantity: number }> }, actor: CurrentUser, ipAddress?: string, userAgent?: string) {
    assertHasPermissions(actor.permissions, ['inventory.count.write']);
    if (!body.lines?.length) throw new BadRequestException('Debe enviar líneas de conteo.');
    for (const line of body.lines) {
      if (!Number.isInteger(line.countedQuantity) || line.countedQuantity < 0 || line.countedQuantity > 2147483647)
        throw new BadRequestException('countedQuantity debe ser entero no negativo dentro del rango de almacenamiento.');
    }
    const ids = body.lines.map((line) => line.variantId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('No se admiten variantes duplicadas.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM inventory_count_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
      const session = await tx.inventoryCountSession.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Sesión de conteo no encontrada.');
      if (session.status === 'closed') throw new ConflictException('Sesión de conteo no editable.');
      const before = await tx.inventoryCountLine.findMany({
        where: { sessionId, variantId: { in: ids } }, orderBy: { id: 'asc' },
      });
      if (before.length !== ids.length) throw new NotFoundException('Línea de conteo no encontrada.');
      for (const line of body.lines) {
        const current = before.find((row) => row.variantId === line.variantId)!;
        await tx.inventoryCountLine.update({
          where: { id: current.id },
          data: { countedQuantity: line.countedQuantity, difference: line.countedQuantity - current.systemQuantity },
        });
      }
      const after = await tx.inventoryCountSession.findUniqueOrThrow({
        where: { id: sessionId }, include: { warehouse: true, lines: { orderBy: [{ sku: 'asc' }, { id: 'asc' }] } },
      });
      await this.auditRepository.write({
        actorUserId: actor.sub, action: 'inventory.count_lines_updated',
        entityType: 'inventory_count_session', entityId: sessionId,
        beforeData: before, afterData: after.lines.filter((line) => ids.includes(line.variantId)),
        ipAddress, userAgent,
      }, tx);
      return after;
    });
  }
}
