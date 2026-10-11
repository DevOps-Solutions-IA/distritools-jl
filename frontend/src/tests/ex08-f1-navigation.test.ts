// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { adminModules } from '@/lib/admin/operations';
describe('EX08 F1 page read permissions', () => {
  it.each([
    ['productos', 'catalog.read'],
    ['marcas', 'catalog.read'],
    ['categorias', 'catalog.read'],
    ['precios', 'catalog.read'],
    ['inventario', 'inventory.read'],
    ['rastreo', 'shipping.read'],
    ['roles', 'permissions.read'],
  ])('matches %s entry GET permission %s', (key, permission) => {
    expect(adminModules.find((module) => module.key === key)?.permission).toBe(
      permission,
    );
  });
});
