import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { parseBoundedPositiveInteger, parsePageSize } from 'src/common/utils/pagination.util';

describe('bounded pagination parsing', () => {
  it('uses documented defaults and accepts bounded integer strings', () => {
    assert.equal(parsePageSize(undefined), 20);
    assert.equal(parsePageSize('100'), 100);
    assert.equal(parseBoundedPositiveInteger('50', 'limit', 10, 50), 50);
  });

  it('rejects malformed, unsafe, zero, negative and over-limit values', () => {
    for (const value of ['1.5', '1e3', '-1', '0', ' 2', '9007199254740992', '101']) {
      assert.throws(() => parsePageSize(value), BadRequestException, value);
    }
  });
});
