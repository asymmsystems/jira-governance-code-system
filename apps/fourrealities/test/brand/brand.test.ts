/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Brand constants, contrast table, and status mapping tests.
 */

import * as fs from 'fs';
import * as path from 'path';
import { LIGHT_PALETTE, SPACE, STRONG_PALETTE, TEXT_PALETTE, TEXT_ROLE, TOKENS, statusToAppearance } from '../../src/brand/brand';

describe('brand palette and token mappings', () => {
  it('contains strong brand colours with contrast >= 3:1 for large text or non-text', () => {
    expect(STRONG_PALETTE.teal.hex).toBe('#5295A3');
    expect(STRONG_PALETTE.rose.hex).toBe('#BA6E8F');
    expect(STRONG_PALETTE.teal.contrastOnWhite).toBeGreaterThanOrEqual(3.0);
    expect(STRONG_PALETTE.rose.contrastOnWhite).toBeGreaterThanOrEqual(3.0);
    expect(STRONG_PALETTE.sage.contrastOnWhite).toBe(2.60);
  });

  it('contains light background colours with contrast >= 6:1 against ink primary', () => {
    expect(LIGHT_PALETTE.neutralSurface.hex).toBe('#F9F7F6');
    expect(LIGHT_PALETTE.neutralSurface.contrastWithInk).toBeGreaterThanOrEqual(15.0);
    expect(LIGHT_PALETTE.tealLight.contrastWithInk).toBeGreaterThan(9.0);
    expect(LIGHT_PALETTE.roseLight.contrastWithInk).toBeGreaterThan(6.0);
  });

  it('contains text shades that satisfy WCAG AA 4.5:1 minimum on white', () => {
    expect(TEXT_PALETTE.inkPrimary.contrastOnWhite).toBeGreaterThan(16.0);
    expect(TEXT_PALETTE.inkSecondary.contrastOnWhite).toBeGreaterThan(12.0);
    expect(TEXT_PALETTE.tealText.contrastOnWhite).toBeGreaterThanOrEqual(4.5);
    expect(TEXT_PALETTE.roseText.contrastOnWhite).toBeGreaterThanOrEqual(4.5);
    expect(TEXT_PALETTE.sageText.contrastOnWhite).toBeGreaterThanOrEqual(4.5);
  });

  it('maps semantic roles, spacing, and typography roles to native Atlassian design tokens', () => {
    expect(TOKENS.surfaceApp).toBe('elevation.surface.sunken');
    expect(TOKENS.surfaceSection).toBe('elevation.surface');
    expect(TOKENS.surfaceNote).toBe('color.background.neutral');
    expect(TOKENS.borderSection).toBe('color.border');
    expect(TOKENS.spaceSection).toBe('space.200');
    expect(TOKENS.radiusSection).toBe('radius.medium');
    expect(SPACE.page).toBe('space.250');
    expect(SPACE.section).toBe('space.200');
    expect(SPACE.group).toBe('space.150');
    expect(SPACE.item).toBe('space.100');
    expect(SPACE.sub).toBe('space.050');
    expect(TEXT_ROLE.primary).toBe('color.text');
    expect(TEXT_ROLE.secondary).toBe('color.text.subtle');
    expect(TEXT_ROLE.muted).toBe('color.text.subtlest');
  });

  it('maps gate verification and states to lozenge appearances', () => {
    expect(statusToAppearance('FOUND', 'VERIFIED')).toBe('success');
    expect(statusToAppearance('FOUND', 'NOT_VERIFIED')).toBe('inprogress');
    expect(statusToAppearance('MISSING')).toBe('removed');
    expect(statusToAppearance('EXCEPTED')).toBe('moved');
    expect(statusToAppearance('NEEDS_RECHECK')).toBe('inprogress');
    expect(statusToAppearance('NOT_APPLICABLE')).toBe('default');
    expect(statusToAppearance('UNKNOWN')).toBe('default');
  });

  it('includes a standalone README documenting semantic roles and shared components', () => {
    const readme = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'brand', 'README.md'), 'utf8');
    expect(readme).toContain('AppSurface');
    expect(readme).toContain('StatusBanner');
    expect(readme).toContain('TableCard');
    expect(readme).toContain('ModalContent');
  });
});

