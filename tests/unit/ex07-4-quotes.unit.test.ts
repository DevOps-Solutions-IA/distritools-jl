import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatNextQuoteNumber } from 'src/modules/admin-operations/application/quote-transaction';

// Pure boundary checks for scenario 1; PostgreSQL locking is covered by E2E.
describe('EX-07.4 quote number formatting', () => {
  it('keeps six minimum digits and advances the maximum across gaps', () => {
    assert.equal(formatNextQuoteNumber('0'), 'QTE-000001');
    assert.equal(formatNextQuoteNumber('3'), 'QTE-000004');
    assert.equal(formatNextQuoteNumber('999999'), 'QTE-1000000');
  });

  it('does not round a PostgreSQL numeric maximum through a JS number', () => {
    assert.equal(formatNextQuoteNumber('9007199254740992'), 'QTE-9007199254740993');
  });
});
