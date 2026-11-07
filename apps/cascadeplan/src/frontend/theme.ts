/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: Atlassian theming (B-17, INV-14). Theming is enabled before the first paint, colours
 * are read from resolved ADS token custom properties, and a change of the Jira theme is reported so
 * that anything drawn outside CSS (the canvas timeline) can repaint.
 */

import { view } from '@forge/bridge';
import { logFailure } from '../logger';

/** Asks Jira to apply its theme (light, dark) and the ADS token sheet to this iframe. */
export async function enableTheme(): Promise<void> {
  try {
    await view.theme.enable();
  } catch (err) {
    logFailure('theming not available, using light fallbacks', err);
  }
}

/** Resolved value of a CSS custom property, or the fallback when it is not set. */
export function cssToken(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Calls back when Jira switches theme (data-color-mode or data-theme on <html>). */
export function onThemeChange(callback: () => void): MutationObserver {
  const observer = new MutationObserver(() => callback());
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode', 'data-theme'] });
  return observer;
}
