import { isDuplicateKeyError } from './mongo-errors';

describe('isDuplicateKeyError', () => {
  it.each([
    [{ code: 11000 }, true],
    [{ code: 11001 }, false],
    [new Error('x'), false],
    [null, false],
    ['11000', false],
  ])('%p → %p', (value, expected) => {
    expect(isDuplicateKeyError(value)).toBe(expected);
  });
});
