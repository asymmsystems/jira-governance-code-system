"""Renders the CascadePlan Marketplace media (BL-7) to PNG at exact sizes with headless Chromium.

Usage, from this folder:  python3 render.py
Writes ../banner.png (1120 x 548) and ../highlight-1.png .. ../highlight-3.png (580 x 330).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent
CHROME = '/opt/google/chrome/chrome'
JOBS = [('banner.html', 'banner.png', 1120, 548)] + [(f'highlight-{i}.html', f'highlight-{i}.png', 580, 330) for i in (1, 2, 3)]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    for src, out, w, h in JOBS:
        if not (HERE / src).exists():
            continue
        pg = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1).new_page()
        pg.goto((HERE / src).as_uri())
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(OUT / out), clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        print('wrote', out, w, h)
    b.close()
