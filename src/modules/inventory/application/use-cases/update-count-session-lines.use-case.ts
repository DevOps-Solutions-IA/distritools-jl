import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { getSession } from './create-inventory-count-session.use-case';

@Injectable()
export class UpdateCountSessionLinesUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(sessionId: string, body: Record<string, unknown>) {
    const lines = Array.isArray(body.lines) ? body.lines as Array<Record<string, unknown>> : [];
    if (!lines.length) throw new BadRequestException('Debe enviar líneas de conteo.');
    const session = await this.prisma.inventoryCountSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status === 'closed') throw new ConflictException('Sesión de conteo no editable.');
    for (const line of lines) {
      const variantId = reqStr(line.variantId, 'variantId');
      const counted = nonNeg(line.countedQuantity, 'countedQuantity');
      const current = await this.prisma.inventoryCountLine.findUnique({
        where: { sessionId_variantId: { sessionId, variantId } },
      });
      if (!current) throw new NotFoundException('Línea de conteo no encontrada.');
      await this.prisma.inventoryCountLine.update({
        where: { sessionId_variantId: { sessionId, variantId } },
        data: { countedQuantity: counted, difference: counted - current.systemQuantity },
      });
    }
    return getSession(this.prisma, sessionId);
  }
}

function reqStr(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} es requerido.`);
  return value;
}
function nonNeg(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new BadRequestException(`${field} debe ser entero no negativo.`);
  return n;
}
