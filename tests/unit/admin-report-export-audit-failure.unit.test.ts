import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AdminReportsController } from 'src/modules/analytics/infrastructure/http/controllers/admin-reports.controller';

describe('admin report export audit boundary', () => {
  it('does not return an export when audit persistence fails', async () => {
    let sent = false;
    const controller = new AdminReportsController(
      { async buildExport() { return { type: 'orders', format: 'csv', rows: [], csv: 'orders', pdf: null, filters: {}, range: {} }; } } as never,
      { async write() { throw new Error('audit storage unavailable'); } } as never,
    );
    const response = {
      setHeader() { return this; },
      send() { sent = true; return this; },
    } as never;

    await assert.rejects(
      controller.export(
        { sub: 'admin-id', email: 'admin@example.test', permissions: ['reports.export'] } as never,
        { type: 'orders', format: 'csv' },
        '127.0.0.1',
        'test-agent',
        response,
      ),
      /audit storage unavailable/,
    );
    assert.equal(sent, false);
  });
});
