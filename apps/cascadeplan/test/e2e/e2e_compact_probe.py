"""Harness check: the hidden-columns banner shows when the user hides columns, not in Compact view.

Compact (Key and Summary only) is a view with its own toggle, so the planner does not warn about
the columns it hides; hiding a column by hand still shows the banner.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg)
    shown = lambda: pg.evaluate("getComputedStyle(document.getElementById('hiddenColsAlertBar')).display") != 'none'
    pg.click('#btnCompactColumns'); pg.wait_for_timeout(500)
    compact = shown()
    pg.click('#btnCompactColumns'); pg.wait_for_timeout(500)
    none_hidden = shown()
    pg.click('#btnManageColumns'); pg.wait_for_timeout(300)
    pg.locator('#columnOptionsList input[type=checkbox]:not([disabled])').first.click(); pg.wait_for_timeout(500)
    one_hidden = shown()
    b.close()
srv.shutdown()
ok = not compact and not none_hidden and one_hidden
print(('PASS' if ok else 'FAIL') + f' hidden-columns banner: compact={compact} none_hidden={none_hidden} one_hidden={one_hidden}')
sys.exit(0 if ok else 1)
