import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderRequestIdentity } from 'src/modules/orders/application/services/order-request-idempotency';

describe('order request idempotency identity', () => {
  it('hashes the key and canonical request without persisting request values', () => {
    const identity = createOrderRequestIdentity('orders:create', 'ex062-key-00001', {
      customer: { email: 'buyer@example.com', name: 'Buyer' },
      items: [{ variantId: 'v1', quantity: 2 }],
    });

    assert.ok(identity);
    assert.notEqual(identity.keyHash, 'ex062-key-00001');
    assert.equal(JSON.stringify(identity).includes('buyer@example.com'), false);
    assert.equal(JSON.stringify(identity).includes('ex062-key-00001'), false);
  });

  it('produces the same fingerprint for objects with different property insertion order', () => {
    const left = createOrderRequestIdentity('checkout:guest', 'ex062-key-00002', {
      customer: { name: 'Buyer', email: 'buyer@example.com' },
      items: [{ productId: 'p1', quantity: 1 }],
    });
    const right = createOrderRequestIdentity('checkout:guest', 'ex062-key-00002', {
      items: [{ quantity: 1, productId: 'p1' }],
      customer: { email: 'buyer@example.com', name: 'Buyer' },
    });

    assert.equal(left?.keyHash, right?.keyHash);
    assert.equal(left?.fingerprint, right?.fingerprint);
  });

  it('rejects malformed or ambiguous keys', () => {
    for (const key of ['', 'short', 'contains space', 'bad\nvalue', 'x'.repeat(129)]) {
      assert.throws(() => createOrderRequestIdentity('orders:create', key, {}), /Invalid Idempotency-Key/);
    }
  });

  it('keeps legacy callers without a key unchanged', () => {
    assert.equal(createOrderRequestIdentity('orders:create', undefined, {}), undefined);
  });
});
