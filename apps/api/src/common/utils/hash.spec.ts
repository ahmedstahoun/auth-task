import { sha256 } from './hash';

describe('sha256', () => {
  it('is deterministic and hex encoded', () => {
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
