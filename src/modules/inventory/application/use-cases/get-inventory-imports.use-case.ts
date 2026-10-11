import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { INVENTORY_OPERATION_READ_REPOSITORY, InventoryOperationReadQuery, InventoryOperationReadRepository } from 'src/modules/inventory/domain/repositories/inventory-operation-read.repository';

@Injectable()
export class GetInventoryImportsUseCase {
  constructor(@Inject(INVENTORY_OPERATION_READ_REPOSITORY) private readonly repository: InventoryOperationReadRepository) {}

  async list(actor: CurrentUser, query: InventoryOperationReadQuery) {
    assertHasPermissions(actor.permissions, ['inventory.import']);
    const { data, total } = await this.repository.listImports(query);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async get(actor: CurrentUser, id: string) {
    assertHasPermissions(actor.permissions, ['inventory.import']);
    const resource = await this.repository.findImport(id);
    if (!resource) throw new NotFoundException('Recurso de inventario no encontrado.');
    return resource;
  }
}
