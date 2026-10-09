import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from 'src/modules/analytics/application/services/csv-cell-sanitizer';

describe('CSV cell formula protection', () => {
  it('neutralizes formula prefixes after whitespace and control characters', () => {
    assert.equal(csvCell('=HYPERLINK("https://evil.invalid","open")'), '"\'=HYPERLINK(""https://evil.invalid"",""open"")"');
    assert.equal(csvCell('\t+SUM(1,1)'), '"\'\t+SUM(1,1)"');
    assert.equal(csvCell('\u0001@cmd'), '"\'\u0001@cmd"');
  });

  it('preserves legitimate numeric values, including negative totals', () => {
    assert.equal(csvCell(-1250.5), '"-1250.5"');
    assert.equal(csvCell('-1250.50'), '"-1250.50"');
    assert.equal(csvCell('0.00'), '"0.00"');
  });

  it('quotes separators and doubles embedded quotes', () => {
    assert.equal(csvCell('item, "one"'), '"item, ""one"""');
  });
});
