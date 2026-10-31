/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: error banner for failed writes. It stays until the user dismisses it (UR-02).
 */

export function showErrorBanner(message: string): void {
  const banner = document.getElementById('syncBanner');
  const text = document.getElementById('syncBannerText');
  if (!banner || !text) return;
  text.textContent = message;
  banner.hidden = false;
}

export function hideErrorBanner(): void {
  const banner = document.getElementById('syncBanner');
  if (banner) banner.hidden = true;
}

export function initErrorBanner(): void {
  const btn = document.getElementById('btnDismissSync');
  if (btn) btn.addEventListener('click', hideErrorBanner);
}
