"""Tries LSP-1's move to Done in the issue view; the Require Valid LedgerSeal validator blocks it, so the status does
not change. Saves a full screenshot to the output folder. Usage: python3 blocked.py KEY
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser, SITE, OUT, rest

key = sys.argv[1]
with sync_playwright() as p:
    b, ctx = open_browser(p, 1600, 1000, 1.0)
    pg = ctx.new_page()
    pg.goto(f'{SITE}/browse/{key}', wait_until='domcontentloaded', timeout=150000)
    pg.wait_for_timeout(12000)
    before = rest(pg, 'GET', f'/rest/api/3/issue/{key}?fields=status')['json']['fields']['status']['name']
    pg.locator('button').filter(has_text=before).first.click()
    pg.wait_for_timeout(2500)
    pg.get_by_role('option', name='Done').first.click() if pg.get_by_role('option', name='Done').count() else pg.get_by_text('Done', exact=True).last.click()
    pg.wait_for_timeout(8000)
    pg.screenshot(path=str(OUT / f'blocked-{key}.png'))
    after = rest(pg, 'GET', f'/rest/api/3/issue/{key}?fields=status')['json']['fields']['status']['name']
    print('status before', before, 'after', after)
    txt = pg.locator('body').inner_text()
    i = txt.find('LedgerSeal:')
    print(txt[i:i + 400])
    b.close()
