"""F-12 live check: the Approval seal entry in the details column of an issue, expanded. Reads only.
Usage: python3 context_entry.py KEY
Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import sys
from playwright.sync_api import sync_playwright
from ls_live import open_browser, SITE, OUT

key = sys.argv[1]
with sync_playwright() as p:
    b, ctx = open_browser(p, 1600, 1100, 1.0)
    pg = ctx.new_page()
    pg.goto(f'{SITE}/browse/{key}', wait_until='domcontentloaded', timeout=150000)
    pg.get_by_text('Approval seal', exact=True).first.wait_for(timeout=90000)
    # Expand the entry by its header row (the module title), in the details column
    label = pg.get_by_text('Approval seal', exact=True).last
    box = label.bounding_box()
    # Click the module title "LedgerSeal" in the same row, then wait for the entry's content to load
    title = [e for e in pg.get_by_text('LedgerSeal', exact=True).all() if e.bounding_box() and abs(e.bounding_box()['y'] - box['y']) < 15]
    (title[0] if title else label).click()
    try:
        pg.get_by_text('Approval seal:', exact=False).last.wait_for(timeout=40000)
    except Exception:
        pass
    pg.wait_for_timeout(2000)
    txt = pg.locator('body').inner_text()
    i = txt.find('Approval seal:')
    print('entry shows:', txt[i:i + 300] if i >= 0 else 'no status text')
    pg.screenshot(path=str(OUT / f'context-{key}.png'))
    b.close()
