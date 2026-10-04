import { describe, expect, it } from 'vitest';
import { cantorPairing } from '../src/utils/contorPairing';
import { zigZagEncode } from '../src/utils/zigZagEncode';

describe('zigZagEncode', () => {
  it('maps integers onto non-negative values', () => {
    expect(zigZagEncode(0)).toBe(0);
    expect(zigZagEncode(1)).toBe(2);
    expect(zigZagEncode(-1)).toBe(1);
    expect(zigZagEncode(2)).toBe(4);
    expect(zigZagEncode(-2)).toBe(3);
  });
});

describe('cantorPairing', () => {
  it('produces distinct keys for nearby cell coordinates', () => {
    const keys = new Set([
      cantorPairing(0, 0),
      cantorPairing(1, 0),
      cantorPairing(0, 1),
      cantorPairing(1, 1),
      cantorPairing(2, 3),
      cantorPairing(3, 2),
    ]);

    expect(keys.size).toBe(6);
  });
});
