/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** The pure SHA-256 matches Node's crypto, including the padding edge cases and UTF-8 text. */
import { createHash } from 'crypto';
import { sha256Hex } from '../../src/domain/sha256';

describe('sha256Hex', () => {
  it('matches known vectors and Node crypto for many lengths', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    for (const n of [1, 55, 56, 63, 64, 65, 119, 120, 1000, 100000]) {
      const s = 'é,' + 'x'.repeat(n);
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
    }
  });
});
