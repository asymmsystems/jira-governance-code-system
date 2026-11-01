/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Canonical JSON: sorted keys, no whitespace, stable output.
 *
 * @author Fahim Farook
 */

import { canonicalJson, hashWithout, sha256Hex } from '../src/domain/canonical-json';

describe('canonicalJson', () => {
  it('sorts keys at every level and writes no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { f: 1, e: 2 }], c: 'x' } })).toBe('{"a":{"c":"x","d":[3,{"e":2,"f":1}]},"b":1}');
  });

  it('writes null for null, undefined, non-finite numbers, functions and symbols, and drops undefined keys', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(undefined)).toBe('null');
    expect(canonicalJson([Infinity, NaN, () => 1, Symbol('s')])).toBe('[null,null,null,null]');
    expect(canonicalJson({ a: undefined, b: false })).toBe('{"b":false}');
  });

  it('gives the same bytes for the same content in any key order', () => {
    expect(canonicalJson({ x: 1, y: [1, 2] })).toBe(canonicalJson({ y: [1, 2], x: 1 }));
  });

  it('hashes with SHA-256 and can leave one field out', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hashWithout({ a: 1, h: 'ignored' }, 'h')).toBe(sha256Hex('{"a":1}'));
  });
});
