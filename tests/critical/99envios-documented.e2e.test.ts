import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NinetyNineEnviosAdapter, NinetyNineEnviosError } from 'src/modules/shipping/infrastructure/providers/ninety-nine-envios.adapter';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function configure99Envios() {
  process.env.NINETY_NINE_ENVIOS_API_BASE_URL = 'https://integration.99envios.app';
  process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL = 'api-user@example.com';
  process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD = 'super-secret-password';
  process.env.NINETY_NINE_ENVIOS_INTEGRATION_TOKEN = 'integration-secret-token';
  process.env.NINETY_NINE_ENVIOS_INTEGRATION_ID = 'distritools';
  process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE = '58732';
  process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE = '76001000';
  process.env.NINETY_NINE_ENVIOS_ENABLE_COD = 'true';
}

function queueFetch(responses: Response[], calls: Array<{ url: string; init?: RequestInit }> = []) {
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const response = responses.shift();
    if (!response) throw new Error(`Unexpected fetch: ${String(input)}`);
    return response;
  }) as typeof fetch;
  return calls;
}

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
  });
}

function quoteInput(overrides: Record<string, unknown> = {}) {
  return {
    destination: {
      country: 'CO',
      department: 'Valle del Cauca',
      city: 'Cali',
      daneCode: '76001000',
      addressLine1: 'Calle 1 # 2-3',
      recipientName: 'Cliente Prueba',
      recipientPhone: '3000000000',
    },
    packages: [{
      weightKg: 1,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      declaredValue: '50000',
      contentDescription: 'Herramientas',
    }],
    idempotencyKey: 'idem-doc-99',
    cashOnDelivery: { enabled: true, amount: '50000' },
    ...overrides,
  };
}

describe('99 Envios documented OpenAPI contract', () => {
  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('blocks real provider when documented credentials are missing', async () => {
    process.env.NINETY_NINE_ENVIOS_API_BASE_URL = 'https://integration.99envios.app';
    delete process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL;
    delete process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD;
    const adapter = new NinetyNineEnviosAdapter();
    const capabilities = await adapter.getCapabilities();
    assert.equal(capabilities.ready, false);
    assert.equal(capabilities.mode, 'pending_provider');
    await assert.rejects(() => adapter.testConnection(), /blocked_missing_credentials/);
  });

  it('authenticates with documented login and never returns JWT to admin status', async () => {
    configure99Envios();
    const calls = queueFetch([jsonResponse(200, { token: 'jwt-secret-token' })]);
    const adapter = new NinetyNineEnviosAdapter();
    const status = await adapter.testConnection();
    assert.equal(status.ok, true);
    assert.equal(status.tokenPresent, true);
    assert.equal(JSON.stringify(status).includes('jwt-secret-token'), false);
    assert.equal(calls[0].url, 'https://integration.99envios.app/api/integration/v1/login');
    assert.equal(JSON.stringify(calls[0].init?.body).includes('super-secret-password'), true);
  });

  it('quotes documented carriers and preserves unavailable carriers', async () => {
    configure99Envios();
    const calls = queueFetch([
      jsonResponse(200, { token: 'jwt-quote-token' }),
      jsonResponse(200, {
        interrapidisimo: { mensaje: 'cotizacion exitosa', valor: 12880, valor_contrapago: 2500, comision_interna: 0, sobreflete: 600, dias: '-29', IdServicio: 3, fecha_entrega: '2025-09-02T18:00:00', seguro99: 0, exito: true },
        tcc: { mensaje: 'cotizacion exitosa', valor: 11130, valor_contrapago: 3000, valor_interna: 0, sobreflete: 600, dias: '0', IdServicio: 2, fecha_entrega: null, seguro99: 0, exito: true },
        servientrega: { mensaje: 'sin cobertura', valor: null, valor_contrapago: null, comision_interna: 0, sobreflete: 0, dias: '0', IdServicio: 2, fecha_entrega: null, seguro99: 0, exito: false },
        coordinadora: { mensaje: 'cotizacion exitosa', valor: 13100, valor_contrapago: 3000, comision_interna: 0, sobreflete: 600, dias: '0', IdServicio: 2, fecha_entrega: '2025-10-08', seguro99: 0, exito: true },
        envia: { mensaje: 'cotizacion exitosa', valor: 13368, valor_contrapago: 3000, comision_interna: 0, sobreflete: 600, dias: 1, IdServicio: 12, fecha_entrega: null, seguro99: 0, exito: true },
      }),
    ]);
    const adapter = new NinetyNineEnviosAdapter();
    const quote = await adapter.quoteShipment(quoteInput());
    assert.equal(calls[1].url, 'https://integration.99envios.app/api/integration/v1/cotizar');
    assert.equal(calls[1].init?.headers && (calls[1].init.headers as Record<string, string>).Authorization, 'Bearer jwt-quote-token');
    assert.equal(quote.carrierOptions?.length, 5);
    assert.equal(quote.carrierOptions?.find((carrier) => carrier.carrier === 'servientrega')?.success, false);
  });

  it('blocks invalid DANE and invalid package before calling the API', async () => {
    configure99Envios();
    const calls = queueFetch([]);
    const adapter = new NinetyNineEnviosAdapter();
    await assert.rejects(() => adapter.quoteShipment(quoteInput({
      destination: { ...(quoteInput().destination), daneCode: '7600100' },
    })), /DANE de 8 dígitos/);
    await assert.rejects(() => adapter.quoteShipment(quoteInput({
      packages: [{ ...(quoteInput().packages[0]), weightKg: 0 }],
    })), /peso debe ser mayor/);
    assert.equal(calls.length, 0);
  });

  it('reauthenticates once on documented 401 and fails controlled on second 401', async () => {
    configure99Envios();
    const calls = queueFetch([
      jsonResponse(200, { token: 'jwt-old' }),
      jsonResponse(401, { error: 'Token JWT inválido, expirado o no proporcionado.' }),
      jsonResponse(200, { token: 'jwt-new' }),
      jsonResponse(401, { error: 'Token JWT inválido, expirado o no proporcionado.' }),
    ]);
    const adapter = new NinetyNineEnviosAdapter();
    await assert.rejects(() => adapter.quoteShipment(quoteInput()), (error) => {
      assert.equal(error instanceof NinetyNineEnviosError, true);
      assert.equal((error as NinetyNineEnviosError).status, 401);
      return true;
    });
    assert.equal(calls.filter((call) => call.url.endsWith('/api/integration/v1/login')).length, 2);
  });

  it('creates documented preenvio with integration headers and maps numeroPreenvio', async () => {
    configure99Envios();
    const calls = queueFetch([
      jsonResponse(200, { token: 'jwt-preenvio-token' }),
      jsonResponse(200, {
        numeroPreenvio: '954101306101',
        fechaVencimiento: null,
        fechaCreacion: '2025-10-01 15:18:07',
        valorFlete: 11596,
        estadoRecogida: false,
        numeroRecogida: 0,
        mensaje: 'preenvio envia creado con exito',
      }),
    ]);
    const adapter = new NinetyNineEnviosAdapter();
    const shipment = await adapter.createShipment({
      ...quoteInput({ service: { carrier: 'envia', idTipoEntrega: 1, idServicio: 1, creationOrigin: 1 } }),
      recipient: { documentType: 'CC', documentNumber: '123456789', firstName: 'Juan', firstLastName: 'Perez', email: 'juan@example.com' },
    });
    assert.equal(calls[1].url, 'https://integration.99envios.app/api/integration/v1/preenvio');
    assert.equal((calls[1].init?.headers as Record<string, string>)['X-Integration-Token'], 'integration-secret-token');
    assert.equal((calls[1].init?.headers as Record<string, string>)['X-Integration-Id'], 'distritools');
    assert.equal(shipment.trackingNumber, '954101306101');
    assert.equal(shipment.quotedAmount, '11596');
    assert.equal(shipment.status, 'guide_generated');
  });

  it('downloads documented PDF normal/sticker and maps binary safely', async () => {
    configure99Envios();
    const calls = queueFetch([
      jsonResponse(200, { token: 'jwt-pdf-token' }),
      new Response(Buffer.from('%PDF test'), { status: 200, headers: { 'content-type': 'application/pdf' } }),
    ]);
    const adapter = new NinetyNineEnviosAdapter();
    const label = await adapter.generateLabel({
      guideNumber: '954101306101',
      carrier: 'servientrega',
      pdfType: 1,
      cashOnDelivery: true,
    });
    assert.equal(calls[1].url, 'https://integration.99envios.app/api/integration/v1/pdf/1');
    assert.equal(label.labelFormat, 'PDF_STICKER');
    assert.equal(label.contentType, 'application/pdf');
    assert.equal(Boolean(label.pdfBase64), true);
  });

  it('syncs and updates documented novedades with PII masked', async () => {
    configure99Envios();
    const calls = queueFetch([
      jsonResponse(200, { token: 'jwt-issues-token' }),
      jsonResponse(200, {
        message: 'Novedades encontradas.',
        codigo_sucursal: 58732,
        novedades: [{
          id: 1,
          codigo_sucursal: 58732,
          numero_preenvio: 250000266,
          id_transportadora: 3,
          novedad: 'nuevo intento de entrega',
          tipo_novedad: 'nuevo intento de entrega',
          nombre_destinatario: 'Juan Carlos',
          direccion_destinatario: 'Avenida Calle 3 # 41',
          telefono_destinatario: '3012884943',
          ciudad_destinatario: 'ARMENIA/ARMENIA',
          observaciones: 'nuevo intento',
          reclamo_oficina: true,
          created_at: '2025-03-31',
          updated_at: '2025-03-31',
        }],
      }),
      jsonResponse(200, { message: 'Novedad registrada con éxito', novedad_id: '1', updated_data: { numero_preenvio: '250000266' } }),
    ]);
    const adapter = new NinetyNineEnviosAdapter();
    const issues = await adapter.getBranchIssues('58732');
    assert.equal(calls[1].url, 'https://integration.99envios.app/api/integration/sucursal/novedades/58732');
    assert.equal(JSON.stringify(issues).includes('3012884943'), false);
    assert.equal(String(issues.data[0].phoneMasked).startsWith('30'), true);
    const updated = await adapter.updateBranchIssue('1', { guideNumber: '250000266', issue: 'Paquete retrasado' });
    assert.equal(calls[2].url, 'https://integration.99envios.app/api/integration/sucursal/novedades/1');
    assert.equal(updated.message, 'Novedad registrada con éxito');
  });

  it('maps documented provider errors without leaking secrets', async () => {
    configure99Envios();
    const codes = [403, 404, 422, 429, 500];
    for (const status of codes) {
      process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE = `58732${status}`;
      queueFetch([
        jsonResponse(200, { token: `jwt-${status}` }),
        jsonResponse(status, { error: 'provider error', password: 'must-not-leak', token: 'must-not-leak' }),
      ]);
      const adapter = new NinetyNineEnviosAdapter();
      await assert.rejects(() => adapter.quoteShipment(quoteInput()), (error) => {
        assert.equal(error instanceof NinetyNineEnviosError, true);
        assert.equal((error as NinetyNineEnviosError).status, status);
        assert.equal(JSON.stringify((error as NinetyNineEnviosError).safeDetails).includes('must-not-leak'), false);
        return true;
      });
    }
  });

  it('enforces documented 300 quotes/hour local guard before calling API again', async () => {
    configure99Envios();
    process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE = 'rate-limit-branch';
    const responses = [
      jsonResponse(200, { token: 'jwt-rate-token' }),
      ...Array.from({ length: 300 }, () => jsonResponse(200, {
        interrapidisimo: { mensaje: 'cotizacion exitosa', valor: 10000, valor_contrapago: 0, comision_interna: 0, sobreflete: 0, dias: '1', IdServicio: 1, fecha_entrega: null, seguro99: 0, exito: true },
      })),
    ];
    const calls = queueFetch(responses);
    const adapter = new NinetyNineEnviosAdapter();
    for (let index = 0; index < 300; index += 1) {
      await adapter.quoteShipment(quoteInput({ idempotencyKey: `rate-${index}` }));
    }
    await assert.rejects(() => adapter.quoteShipment(quoteInput({ idempotencyKey: 'rate-301' })), (error) => {
      assert.equal(error instanceof NinetyNineEnviosError, true);
      assert.equal((error as NinetyNineEnviosError).status, 429);
      return true;
    });
    assert.equal(calls.length, 301);
  });
});
