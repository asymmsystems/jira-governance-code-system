/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: WCAG 2.2 contrast ratio (pure). Used for colours that axe cannot check, such as
 * canvas pixels (B-13, B-17, UR-10). Colours with an alpha channel are blended over the background.
 */

type Rgb = [number, number, number];

function parse(hex: string): { rgb: Rgb; alpha: number } {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 || h.length === 4 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return { rgb: [n(0), n(2), n(4)], alpha: full.length === 8 ? n(6) / 255 : 1 };
}

function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Colour after blending a translucent foreground over an opaque background. */
export function blend(fg: string, bg: string): Rgb {
  const f = parse(fg);
  const b = parse(bg);
  return [0, 1, 2].map(i => Math.round(f.rgb[i] * f.alpha + b.rgb[i] * (1 - f.alpha))) as Rgb;
}

/** WCAG contrast ratio of a foreground over a background, rounded to two decimals. */
export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(blend(fg, bg));
  const b = luminance(parse(bg).rgb);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
