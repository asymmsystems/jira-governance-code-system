"""Seals an issue through the panel as the signed-in user (a live write: the seal record and its property).
Usage: python3 seal_pay.py KEY [ROLE_LABEL]
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser, OUT
from ls_panel import open_issue, click_text

key = sys.argv[1]
role = sys.argv[2] if len(sys.argv) > 2 else 'Approved'
with sync_playwright() as p:
    b, ctx = open_browser(p, 2300, 1300, 1.0)
    pg = ctx.new_page()
    open_issue(pg, key)
    click_text(pg, 'Seal this issue')
    pg.get_by_label(role, exact=True).check()
    pg.get_by_label('I agree to the declaration above.').check()
    pg.wait_for_timeout(800)
    click_text(pg, 'Sign and seal')
    pg.get_by_text('SEALED', exact=True).first.wait_for(timeout=90000)
    pg.wait_for_timeout(2000)
    pg.screenshot(path=str(OUT / f'sealed-{key}.png'))
    print('sealed', key)
    b.close()
