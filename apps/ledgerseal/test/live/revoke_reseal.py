"""Revokes the seal of an issue and seals it again through the panel (live writes on that issue's seal record and
its property). On a record from before ADR-011 the revoke first converts the record (the redaction event).
Usage: python3 revoke_reseal.py KEY
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser, OUT
from ls_panel import open_issue, click_text

key = sys.argv[1]
with sync_playwright() as p:
    b, ctx = open_browser(p, 2300, 1300, 1.0)
    pg = ctx.new_page()
    open_issue(pg, key)
    click_text(pg, 'Revoke seal')
    pg.locator('textarea').first.fill('LedgerSeal live check: revoke and seal again (ADR-011 conversion)')
    pg.wait_for_timeout(800)
    click_text(pg, 'Revoke')
    pg.get_by_text('REVOKED', exact=True).first.wait_for(timeout=90000)
    pg.wait_for_timeout(1500)
    print('revoked', key)
    click_text(pg, 'Seal this issue')
    area = pg.locator('textarea')
    if area.count():
        area.first.fill('Approved again after the LedgerSeal live check')
    pg.get_by_label('Approved', exact=True).check()
    pg.get_by_label('I agree to the declaration above.').check()
    pg.wait_for_timeout(800)
    click_text(pg, 'Sign and seal')
    pg.get_by_text('SEALED', exact=True).first.wait_for(timeout=90000)
    pg.wait_for_timeout(2000)
    pg.screenshot(path=str(OUT / f'resealed-{key}.png'))
    print('sealed again', key)
    b.close()
