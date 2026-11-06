/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Asymm Systems In-Jira UI brand tokens, palette definitions, and Atlassian Design System mappings.
 * Pure definitions; zero external dependencies outside React and Forge UI Kit.
 */

export interface PaletteEntry {
  readonly hex: string;
  readonly contrastOnWhite: number;
  readonly contrastOnSunken: number;
  readonly role: string;
}

export const STRONG_PALETTE: Record<string, PaletteEntry> = {
  teal: { hex: '#5295A3', contrastOnWhite: 3.39, contrastOnSunken: 3.21, role: 'Large headings, icons, card borders' },
  rose: { hex: '#BA6E8F', contrastOnWhite: 3.67, contrastOnSunken: 3.47, role: 'Large headings, danger accents, icons' },
  sage: { hex: '#8FA96D', contrastOnWhite: 2.60, contrastOnSunken: 2.46, role: 'Non-text graphics only' },
  sand: { hex: '#F8DBA9', contrastOnWhite: 1.33, contrastOnSunken: 1.26, role: 'Background fill only' },
  slate: { hex: '#6B7C8C', contrastOnWhite: 3.92, contrastOnSunken: 3.71, role: 'Large headings, secondary icons' },
  plum: { hex: '#8C7A9B', contrastOnWhite: 3.11, contrastOnSunken: 2.94, role: 'Large accents, secondary series' },
  clay: { hex: '#B98A72', contrastOnWhite: 2.67, contrastOnSunken: 2.53, role: 'Non-text graphics only' },
  stone: { hex: '#A8A196', contrastOnWhite: 2.28, contrastOnSunken: 2.16, role: 'Decorative borders and dividers' }
};

export const LIGHT_PALETTE: Record<string, { hex: string; contrastWithInk: number; role: string }> = {
  tealLight: { hex: '#9CC8D1', contrastWithInk: 9.82, role: 'Informational highlight fills' },
  roseLight: { hex: '#C985A3', contrastWithInk: 6.84, role: 'Missing evidence warning fills' },
  sageLight: { hex: '#AFC29C', contrastWithInk: 9.47, role: 'Evidence found success fills' },
  sandLight: { hex: '#FDF5E5', contrastWithInk: 15.34, role: 'Caution and exception fills' },
  slateLight: { hex: '#C3CCD4', contrastWithInk: 10.63, role: 'Neutral state fills' },
  plumLight: { hex: '#D3C9DC', contrastWithInk: 10.98, role: 'Accent highlight fills' },
  clayLight: { hex: '#EAD5C9', contrastWithInk: 12.35, role: 'High-risk callout fills' },
  stoneLight: { hex: '#E4E0D9', contrastWithInk: 13.51, role: 'Note container fills' },
  neutralSurface: { hex: '#F9F7F6', contrastWithInk: 15.25, role: 'Outermost container background' },
  white: { hex: '#FFFFFF', contrastWithInk: 16.10, role: 'Content card surface' }
};

export const TEXT_PALETTE: Record<string, { hex: string; contrastOnWhite: number; role: string }> = {
  inkPrimary: { hex: '#1A1C1E', contrastOnWhite: 16.10, role: 'Standard primary body text' },
  inkSecondary: { hex: '#333333', contrastOnWhite: 12.60, role: 'Supporting descriptions and metadata' },
  tealText: { hex: '#3D7480', contrastOnWhite: 5.24, role: 'Accessible teal text' },
  roseText: { hex: '#93506F', contrastOnWhite: 5.42, role: 'Accessible rose text' },
  sageText: { hex: '#5B7243', contrastOnWhite: 5.04, role: 'Accessible sage text' },
  sandText: { hex: '#85652B', contrastOnWhite: 5.01, role: 'Accessible sand text' },
  slateText: { hex: '#4E5D6B', contrastOnWhite: 6.06, role: 'Accessible slate text' },
  plumText: { hex: '#6A5A79', contrastOnWhite: 5.48, role: 'Accessible plum text' },
  clayText: { hex: '#8A5A42', contrastOnWhite: 5.36, role: 'Accessible clay text' },
  stoneText: { hex: '#6B655C', contrastOnWhite: 5.08, role: 'Accessible stone text' }
};

/** Semantic spacing scale used across all views; components never write raw 'space.*' tokens. */
export const SPACE = {
  page: 'space.250',
  section: 'space.200',
  group: 'space.150',
  item: 'space.100',
  compact: 'space.075',
  sub: 'space.050',
  tight: 'space.025',
  indent: 'space.200',
  none: 'space.0'
} as const;

/** Semantic text colour roles mapped to Atlassian light/dark theme tokens. */
export const TEXT_ROLE = {
  primary: 'color.text',
  secondary: 'color.text.subtle',
  muted: 'color.text.subtlest',
  accentTeal: 'color.text.accent.teal.bolder',
  danger: 'color.text.danger',
  warning: 'color.text.warning',
  success: 'color.text.success'
} as const;

export const TOKENS = {
  surfaceApp: 'elevation.surface.sunken',
  surfaceSection: 'elevation.surface',
  surfaceNote: 'color.background.neutral',
  surfaceSubtle: 'color.background.neutral.subtle',
  surfaceBrandTeal: 'color.background.accent.teal.subtlest',
  surfaceBrandRose: 'color.background.accent.magenta.subtlest',
  surfaceBrandSage: 'color.background.accent.lime.subtlest',
  surfaceBrandSand: 'color.background.accent.orange.subtlest',
  borderSection: 'color.border',
  borderSubtle: 'color.border',
  borderBrandTeal: 'color.border.accent.teal',
  borderBrandTealSubtle: 'color.border.accent.teal.subtle',
  borderBrandRose: 'color.border.accent.magenta',
  borderBrandSage: 'color.border.accent.green',
  borderBrandSand: 'color.border.accent.orange',
  shadowCard: 'elevation.shadow.raised',
  textPrimary: 'color.text',
  textSecondary: 'color.text.subtle',
  textSubtlest: 'color.text.subtlest',
  spacePage: 'space.250',
  spaceSection: 'space.200',
  spaceGroup: 'space.150',
  spaceItem: 'space.100',
  spaceSub: 'space.050',
  spaceIndent: 'space.200',
  radiusSection: 'radius.medium',
  radiusChip: 'radius.small'
} as const;

export type LozengeAppearance = 'default' | 'success' | 'removed' | 'inprogress' | 'new' | 'moved';

export function statusToAppearance(state: string, verification?: string): LozengeAppearance {
  switch (state) {
    case 'FOUND':
      return verification === 'NOT_VERIFIED' ? 'inprogress' : 'success';
    case 'MISSING':
      return 'removed';
    case 'REPORTED':
      return 'inprogress';
    case 'EXCEPTED':
      return 'moved';
    case 'NEEDS_RECHECK':
      return 'inprogress';
    case 'NOT_APPLICABLE':
    default:
      return 'default';
  }
}
